-- Add daily usage limits functionality
-- This migration adds tables and functions to track and enforce daily usage limits

-- Add usage limit columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS daily_template_limit INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS daily_email_limit INTEGER DEFAULT 50;

-- Create daily usage tracking table
CREATE TABLE IF NOT EXISTS daily_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  templates_generated INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per org per day
  UNIQUE(org_id, usage_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_usage_org_date ON daily_usage(org_id, usage_date);

-- Function to get current usage for an organization
CREATE OR REPLACE FUNCTION get_daily_usage(p_org_id UUID)
RETURNS TABLE(
  templates_generated INTEGER,
  emails_sent INTEGER,
  template_limit INTEGER,
  email_limit INTEGER,
  templates_remaining INTEGER,
  emails_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(du.templates_generated, 0)::INTEGER,
    COALESCE(du.emails_sent, 0)::INTEGER,
    o.daily_template_limit,
    o.daily_email_limit,
    (o.daily_template_limit - COALESCE(du.templates_generated, 0))::INTEGER,
    (o.daily_email_limit - COALESCE(du.emails_sent, 0))::INTEGER
  FROM organizations o
  LEFT JOIN daily_usage du ON du.org_id = o.id AND du.usage_date = CURRENT_DATE
  WHERE o.id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if action is allowed
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_org_id UUID,
  p_action_type TEXT -- 'template' or 'email'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage INTEGER;
  v_limit INTEGER;
BEGIN
  -- Get current usage and limit
  IF p_action_type = 'template' THEN
    SELECT 
      COALESCE(du.templates_generated, 0),
      o.daily_template_limit
    INTO v_current_usage, v_limit
    FROM organizations o
    LEFT JOIN daily_usage du ON du.org_id = o.id AND du.usage_date = CURRENT_DATE
    WHERE o.id = p_org_id;
  ELSIF p_action_type = 'email' THEN
    SELECT 
      COALESCE(du.emails_sent, 0),
      o.daily_email_limit
    INTO v_current_usage, v_limit
    FROM organizations o
    LEFT JOIN daily_usage du ON du.org_id = o.id AND du.usage_date = CURRENT_DATE
    WHERE o.id = p_org_id;
  ELSE
    RETURN FALSE;
  END IF;
  
  -- Check if under limit
  RETURN v_current_usage < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
  p_org_id UUID,
  p_action_type TEXT, -- 'template' or 'email'
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  -- Check if allowed
  v_allowed := check_usage_limit(p_org_id, p_action_type);
  
  IF NOT v_allowed THEN
    RETURN FALSE;
  END IF;
  
  -- Insert or update usage record
  IF p_action_type = 'template' THEN
    INSERT INTO daily_usage (org_id, usage_date, templates_generated)
    VALUES (p_org_id, CURRENT_DATE, p_amount)
    ON CONFLICT (org_id, usage_date)
    DO UPDATE SET 
      templates_generated = daily_usage.templates_generated + p_amount,
      updated_at = NOW();
  ELSIF p_action_type = 'email' THEN
    INSERT INTO daily_usage (org_id, usage_date, emails_sent)
    VALUES (p_org_id, CURRENT_DATE, p_amount)
    ON CONFLICT (org_id, usage_date)
    DO UPDATE SET 
      emails_sent = daily_usage.emails_sent + p_amount,
      updated_at = NOW();
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily usage (for testing or manual reset)
CREATE OR REPLACE FUNCTION reset_daily_usage(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM daily_usage 
  WHERE org_id = p_org_id 
  AND usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on daily_usage table
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their org's usage
CREATE POLICY "Users can view their organization's usage"
ON daily_usage
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM user_orgs
    WHERE user_id = auth.uid()
  )
);

-- Policy: Only system can insert/update usage (via functions)
CREATE POLICY "System can manage usage"
ON daily_usage
FOR ALL
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM user_orgs
    WHERE user_id = auth.uid()
  )
);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_daily_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_usage_limit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_daily_usage(UUID) TO authenticated;

-- Insert default usage limits for existing organizations
UPDATE organizations 
SET 
  daily_template_limit = 10,
  daily_email_limit = 50
WHERE daily_template_limit IS NULL 
   OR daily_email_limit IS NULL;

-- Add comment
COMMENT ON TABLE daily_usage IS 'Tracks daily usage of templates and emails per organization';
COMMENT ON FUNCTION get_daily_usage(UUID) IS 'Returns current daily usage and limits for an organization';
COMMENT ON FUNCTION check_usage_limit(UUID, TEXT) IS 'Checks if organization is under daily limit for action type';
COMMENT ON FUNCTION increment_usage(UUID, TEXT, INTEGER) IS 'Increments usage counter if under limit, returns false if limit reached';
