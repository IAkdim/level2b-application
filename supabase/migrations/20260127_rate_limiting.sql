-- =============================================================================
-- RATE LIMITING FOR LEAD GENERATION
-- =============================================================================
-- This migration adds daily rate limiting for lead generation
-- Works with the existing subscriptions table (plan_tier, leads_per_week_limit)
-- Free tier gets 0 leads (only demo mode provides a few)

-- Rate limits table to track daily usage
CREATE TABLE IF NOT EXISTS lead_generation_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_start DATE NOT NULL,
    leads_generated INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, day_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_day 
ON lead_generation_rate_limits(user_id, day_start);

-- Enable RLS
ALTER TABLE lead_generation_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limits
DROP POLICY IF EXISTS "Users can view own rate limits" ON lead_generation_rate_limits;
CREATE POLICY "Users can view own rate limits"
ON lead_generation_rate_limits FOR SELECT
USING (auth.uid() = user_id);

-- Service role can manage rate limits
DROP POLICY IF EXISTS "Service role can manage rate limits" ON lead_generation_rate_limits;
CREATE POLICY "Service role can manage rate limits"
ON lead_generation_rate_limits FOR ALL
USING (true);

-- API usage logs table (optional - for analytics)
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(50),
    leads_requested INTEGER DEFAULT 0,
    leads_generated INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    duration_ms INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_user_created 
ON api_usage_logs(user_id, created_at);

-- Enable RLS
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own logs
DROP POLICY IF EXISTS "Users can view own api logs" ON api_usage_logs;
CREATE POLICY "Users can view own api logs"
ON api_usage_logs FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert
DROP POLICY IF EXISTS "Service role can manage api logs" ON api_usage_logs;
CREATE POLICY "Service role can manage api logs"
ON api_usage_logs FOR ALL
USING (true);

-- =============================================================================
-- FUNCTIONS - Integrated with existing subscriptions table
-- =============================================================================

-- Get the daily rate limit status for a user
-- Uses the existing subscriptions.leads_per_week_limit and plan_tier
-- Free tier (no subscription) = 0 leads, must subscribe to generate
CREATE OR REPLACE FUNCTION get_daily_rate_limit(
    p_user_id UUID,
    p_org_id UUID DEFAULT NULL  -- Kept for compatibility, not used
)
RETURNS TABLE (
    day_start DATE,
    leads_generated INTEGER,
    daily_limit INTEGER,
    limit_remaining INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_start DATE;
    v_leads_generated INTEGER;
    v_daily_limit INTEGER;
    v_plan_tier TEXT;
    v_weekly_limit INTEGER;
    v_is_enterprise BOOLEAN;
BEGIN
    -- Get current day start (UTC)
    v_day_start := CURRENT_DATE;
    
    -- Get user's subscription from existing subscriptions table
    SELECT 
        s.plan_tier,
        s.leads_per_week_limit,
        s.is_enterprise
    INTO v_plan_tier, v_weekly_limit, v_is_enterprise
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.subscription_status IN ('active', 'trialing', 'past_due');
    
    -- Calculate daily limit based on plan
    -- Weekly limit divided by 7 days
    IF v_is_enterprise OR v_plan_tier = 'enterprise' THEN
        -- Enterprise: very high limit (essentially unlimited)
        v_daily_limit := 5000;
    ELSIF v_plan_tier = 'pro' THEN
        -- Pro: unlimited leads, high daily limit
        v_daily_limit := 1000;
    ELSIF v_plan_tier = 'starter' THEN
        -- Starter: weekly limit / 7, e.g. 1000/week = ~143/day
        v_daily_limit := GREATEST(100, COALESCE(v_weekly_limit, 1000) / 7);
    ELSE
        -- No subscription (free tier / none): 0 leads - must subscribe
        v_daily_limit := 0;
    END IF;
    
    -- Get leads generated today
    SELECT COALESCE(rl.leads_generated, 0) INTO v_leads_generated
    FROM lead_generation_rate_limits rl
    WHERE rl.user_id = p_user_id 
    AND rl.day_start = v_day_start;
    
    IF v_leads_generated IS NULL THEN
        v_leads_generated := 0;
    END IF;
    
    RETURN QUERY SELECT 
        v_day_start,
        v_leads_generated,
        v_daily_limit,
        GREATEST(0, v_daily_limit - v_leads_generated);
END;
$$;

-- Keep old function name as alias for backward compatibility
CREATE OR REPLACE FUNCTION get_hourly_rate_limit(
    p_user_id UUID,
    p_org_id UUID DEFAULT NULL
)
RETURNS TABLE (
    hour_start TIMESTAMPTZ,
    leads_generated INTEGER,
    hourly_limit INTEGER,
    limit_remaining INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Call the new daily function and adapt the return format
    SELECT * INTO v_result FROM get_daily_rate_limit(p_user_id, p_org_id);
    
    RETURN QUERY SELECT 
        v_result.day_start::TIMESTAMPTZ,
        v_result.leads_generated,
        v_result.daily_limit,
        v_result.limit_remaining;
END;
$$;

-- Increment the rate limit counter (daily)
CREATE OR REPLACE FUNCTION increment_rate_limit(
    p_user_id UUID,
    p_org_id UUID DEFAULT NULL,  -- Kept for compatibility, not used
    p_leads_count INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_start DATE;
BEGIN
    v_day_start := CURRENT_DATE;
    
    INSERT INTO lead_generation_rate_limits (user_id, day_start, leads_generated)
    VALUES (p_user_id, v_day_start, p_leads_count)
    ON CONFLICT (user_id, day_start)
    DO UPDATE SET 
        leads_generated = lead_generation_rate_limits.leads_generated + p_leads_count,
        updated_at = NOW();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_rate_limit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_rate_limit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_hourly_rate_limit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_rate_limit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_rate_limit(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_rate_limit(UUID, UUID, INTEGER) TO service_role;
