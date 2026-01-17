-- Migration: Lead Generator Security Features
-- Rate limiting and API usage monitoring for lead generation
-- Created: 2025-12-30

-- Table: api_usage_logs
-- Tracks all API calls for monitoring and auditing
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- API call details
  endpoint TEXT NOT NULL, -- 'generate-leads', 'templates', etc.
  method TEXT NOT NULL, -- 'google_maps', 'social_media', etc.
  
  -- Request/Response data
  leads_requested INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  
  -- Timing and metadata
  duration_ms INTEGER, -- How long the request took
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_org 
  ON api_usage_logs(organization_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user 
  ON api_usage_logs(user_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint 
  ON api_usage_logs(endpoint, created_at DESC);

-- Table: lead_generation_rate_limits
-- Tracks hourly lead generation per user for rate limiting
CREATE TABLE IF NOT EXISTS lead_generation_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rate limiting
  leads_generated INTEGER NOT NULL DEFAULT 0,
  hour_start TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one record per user per hour
  UNIQUE(user_id, organization_id, hour_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_hour 
  ON lead_generation_rate_limits(user_id, organization_id, hour_start DESC);

-- Enable RLS
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_generation_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_usage_logs
-- Users can only see their own organization's logs
CREATE POLICY "Users can view own organization API logs"
  ON api_usage_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Only system can insert logs (via Edge Function service role)
CREATE POLICY "Service role can insert API logs"
  ON api_usage_logs
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for lead_generation_rate_limits
-- Users can view their own rate limits
CREATE POLICY "Users can view own rate limits"
  ON lead_generation_rate_limits
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can manage rate limits
CREATE POLICY "Service role can manage rate limits"
  ON lead_generation_rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function: Get current hour rate limit for user
CREATE OR REPLACE FUNCTION get_hourly_rate_limit(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS TABLE (
  leads_generated INTEGER,
  hour_start TIMESTAMPTZ,
  limit_remaining INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hour TIMESTAMPTZ;
  v_max_leads_per_hour INTEGER := 50; -- Default limit
  v_leads_count INTEGER := 0;
BEGIN
  -- Get current hour start (truncate to hour)
  v_current_hour := date_trunc('hour', NOW());
  
  -- Get or create rate limit record
  SELECT COALESCE(l.leads_generated, 0)
  INTO v_leads_count
  FROM lead_generation_rate_limits l
  WHERE l.user_id = p_user_id
    AND l.organization_id = p_org_id
    AND l.hour_start = v_current_hour;
  
  -- If no record exists, count is 0
  v_leads_count := COALESCE(v_leads_count, 0);
  
  RETURN QUERY
  SELECT 
    v_leads_count,
    v_current_hour,
    GREATEST(0, v_max_leads_per_hour - v_leads_count) AS limit_remaining;
END;
$$;

-- Function: Increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_user_id UUID,
  p_org_id UUID,
  p_leads_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hour TIMESTAMPTZ;
BEGIN
  v_current_hour := date_trunc('hour', NOW());
  
  -- Upsert: increment if exists, create if not
  INSERT INTO lead_generation_rate_limits (
    user_id,
    organization_id,
    hour_start,
    leads_generated,
    updated_at
  )
  VALUES (
    p_user_id,
    p_org_id,
    v_current_hour,
    p_leads_count,
    NOW()
  )
  ON CONFLICT (user_id, organization_id, hour_start)
  DO UPDATE SET
    leads_generated = lead_generation_rate_limits.leads_generated + p_leads_count,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Function: Clean up old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM lead_generation_rate_limits
  WHERE hour_start < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Function: Get API usage statistics for organization
CREATE OR REPLACE FUNCTION get_api_usage_stats(
  p_org_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_calls INTEGER,
  successful_calls INTEGER,
  failed_calls INTEGER,
  total_leads_requested INTEGER,
  total_leads_generated INTEGER,
  avg_duration_ms NUMERIC,
  calls_by_method JSONB,
  calls_by_day JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_calls,
    COUNT(*) FILTER (WHERE success = true)::INTEGER AS successful_calls,
    COUNT(*) FILTER (WHERE success = false)::INTEGER AS failed_calls,
    COALESCE(SUM(leads_requested), 0)::INTEGER AS total_leads_requested,
    COALESCE(SUM(leads_generated), 0)::INTEGER AS total_leads_generated,
    ROUND(AVG(duration_ms)::NUMERIC, 2) AS avg_duration_ms,
    
    -- Calls by method
    (
      SELECT jsonb_object_agg(method, count)
      FROM (
        SELECT method, COUNT(*)::INTEGER as count
        FROM api_usage_logs
        WHERE organization_id = p_org_id
          AND created_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY method
      ) methods
    ) AS calls_by_method,
    
    -- Calls by day
    (
      SELECT jsonb_object_agg(day, count)
      FROM (
        SELECT 
          DATE(created_at) as day,
          COUNT(*)::INTEGER as count
        FROM api_usage_logs
        WHERE organization_id = p_org_id
          AND created_at > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY day DESC
      ) daily
    ) AS calls_by_day
    
  FROM api_usage_logs
  WHERE organization_id = p_org_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE api_usage_logs IS 'Audit log for all API calls - tracks usage, errors, and performance';
COMMENT ON TABLE lead_generation_rate_limits IS 'Rate limiting per user per hour to prevent abuse';
COMMENT ON FUNCTION get_hourly_rate_limit IS 'Check how many leads a user can still generate this hour';
COMMENT ON FUNCTION increment_rate_limit IS 'Increment the rate limit counter after successful generation';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Maintenance function to remove old rate limit records';
COMMENT ON FUNCTION get_api_usage_stats IS 'Get comprehensive API usage statistics for monitoring';
