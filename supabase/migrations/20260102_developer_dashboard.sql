-- ============================================
-- DEVELOPER DASHBOARD DATABASE SCHEMA
-- ============================================
-- Security: Strikte RLS policies, alleen admin access
-- Created: 2026-01-02

-- ============================================
-- 1. ADMIN USERS TABLE
-- ============================================
-- Tracks which users have admin/developer access
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'developer')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX idx_admin_users_user_id ON admin_users(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_admin_users_role ON admin_users(role) WHERE revoked_at IS NULL;

COMMENT ON TABLE admin_users IS 'Admin/developer role assignments - CRITICAL SECURITY TABLE';

-- ============================================
-- 2. SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_settings_key ON system_settings(key);

COMMENT ON TABLE system_settings IS 'Global system configuration (maintenance mode, debug mode, etc.)';

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('maintenance_mode', 'false'::jsonb, 'System-wide maintenance mode'),
  ('debug_mode', 'false'::jsonb, 'Debug mode (enables verbose logging)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. FEATURE FLAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  key TEXT NOT NULL UNIQUE, -- Technical key (e.g., 'lead_generator_v2')
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  
  -- Targeting (for later)
  target_user_ids UUID[],
  target_org_ids UUID[],
  
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);

COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollouts and A/B testing';

-- Insert example flags
INSERT INTO feature_flags (name, key, description, enabled) VALUES
  ('Lead Generator V2', 'lead_generator_v2', 'New AI-powered lead generation engine', false),
  ('Advanced Analytics', 'advanced_analytics', 'Enhanced analytics dashboard with predictions', false),
  ('Email Templates AI', 'email_templates_ai', 'AI-generated email templates', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 4. SYSTEM LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  context JSONB, -- Additional structured data
  
  -- Source tracking
  source TEXT, -- 'api', 'edge_function', 'frontend', etc.
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  
  -- Error details
  error_code TEXT,
  stack_trace TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_logs_level ON system_logs(level, created_at DESC);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id, created_at DESC);
CREATE INDEX idx_system_logs_source ON system_logs(source, created_at DESC);

COMMENT ON TABLE system_logs IS 'Centralized system logging for debugging and monitoring';

-- ============================================
-- 5. ADMIN AUDIT LOG TABLE
-- ============================================
-- CRITICAL: Log ALL admin actions for security
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'user_suspended', 'flag_toggled', 'setting_changed', etc.
  resource_type TEXT NOT NULL, -- 'user', 'feature_flag', 'system_setting'
  resource_id TEXT, -- UUID or identifier of affected resource
  
  old_value JSONB,
  new_value JSONB,
  
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX idx_admin_audit_log_resource ON admin_audit_log(resource_type, resource_id);

COMMENT ON TABLE admin_audit_log IS 'CRITICAL SECURITY: Immutable audit trail of all admin actions';

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin Users: Only admins can view
CREATE POLICY "Only admins can view admin_users"
  ON admin_users FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users 
      WHERE revoked_at IS NULL
    )
  );

-- System Settings: Only admins can view
CREATE POLICY "Only admins can view system_settings"
  ON system_settings FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users 
      WHERE revoked_at IS NULL
    )
  );

-- Feature Flags: Users can view enabled flags, admins can view all
CREATE POLICY "Users can view enabled feature_flags"
  ON feature_flags FOR SELECT
  USING (
    enabled = true
    OR auth.uid() IN (
      SELECT user_id FROM admin_users 
      WHERE revoked_at IS NULL
    )
  );

-- System Logs: Only admins can view
CREATE POLICY "Only admins can view system_logs"
  ON system_logs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users 
      WHERE revoked_at IS NULL
    )
  );

-- Admin Audit Log: Only admins can view
CREATE POLICY "Only admins can view admin_audit_log"
  ON admin_audit_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users 
      WHERE revoked_at IS NULL
    )
  );

-- Service role can do anything (for RPC functions)
CREATE POLICY "Service role can manage admin_users"
  ON admin_users FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage system_settings"
  ON system_settings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage feature_flags"
  ON feature_flags FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage system_logs"
  ON system_logs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage admin_audit_log"
  ON admin_audit_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = is_admin.user_id
      AND revoked_at IS NULL
  );
END;
$$;

-- Get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM admin_users
  WHERE user_id = auth.uid()
    AND revoked_at IS NULL;
  
  RETURN COALESCE(user_role, 'user');
END;
$$;

-- Log admin action (used by all admin RPC functions)
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    resource_type,
    resource_id,
    old_value,
    new_value,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_value,
    p_new_value,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create system log entry
CREATE OR REPLACE FUNCTION create_system_log(
  p_level TEXT,
  p_message TEXT,
  p_context JSONB DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_stack_trace TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO system_logs (
    level,
    message,
    context,
    source,
    user_id,
    error_code,
    stack_trace
  ) VALUES (
    p_level,
    p_message,
    p_context,
    p_source,
    auth.uid(),
    p_error_code,
    p_stack_trace
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================
-- ADMIN RPC FUNCTIONS
-- ============================================

-- Get dashboard overview stats
CREATE OR REPLACE FUNCTION admin_get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- TODO: Calculate real metrics
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'active_users_24h', 0, -- TODO: Track last_seen
    'error_count_24h', (
      SELECT COUNT(*) FROM system_logs 
      WHERE level = 'error' 
        AND created_at > NOW() - INTERVAL '24 hours'
    ),
    'total_organizations', (SELECT COUNT(*) FROM organizations),
    'system_status', 'operational' -- TODO: Calculate from logs/metrics
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Get all users with pagination
CREATE OR REPLACE FUNCTION admin_get_users(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_suspended BOOLEAN,
  organization_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    (u.banned_until IS NOT NULL AND u.banned_until > NOW()) AS is_suspended,
    (SELECT COUNT(*)::INTEGER FROM organization_members om WHERE om.user_id = u.id) AS organization_count
  FROM auth.users u
  WHERE p_search IS NULL 
    OR u.email ILIKE '%' || p_search || '%'
  ORDER BY u.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get user details
CREATE OR REPLACE FUNCTION admin_get_user_details(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'is_suspended', (u.banned_until IS NOT NULL AND u.banned_until > NOW()),
    'banned_until', u.banned_until,
    'organizations', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'role', om.role,
        'joined_at', om.created_at
      ))
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = u.id
    )
  )
  INTO v_result
  FROM auth.users u
  WHERE u.id = p_user_id;
  
  RETURN v_result;
END;
$$;

-- Suspend user
CREATE OR REPLACE FUNCTION admin_suspend_user(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get user email for audit log
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  
  -- Suspend for 100 years (effectively permanent)
  UPDATE auth.users
  SET banned_until = NOW() + INTERVAL '100 years'
  WHERE id = p_user_id;
  
  -- Log action
  PERFORM log_admin_action(
    'user_suspended',
    'user',
    p_user_id::TEXT,
    jsonb_build_object('email', v_user_email),
    jsonb_build_object('reason', p_reason)
  );
  
  RETURN TRUE;
END;
$$;

-- Unsuspend user
CREATE OR REPLACE FUNCTION admin_unsuspend_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get user email for audit log
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  
  UPDATE auth.users
  SET banned_until = NULL
  WHERE id = p_user_id;
  
  -- Log action
  PERFORM log_admin_action(
    'user_unsuspended',
    'user',
    p_user_id::TEXT,
    jsonb_build_object('email', v_user_email),
    NULL
  );
  
  RETURN TRUE;
END;
$$;

-- Get system logs
CREATE OR REPLACE FUNCTION admin_get_system_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_level TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  level TEXT,
  message TEXT,
  source TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    sl.id,
    sl.level,
    sl.message,
    sl.source,
    sl.user_id,
    sl.created_at
  FROM system_logs sl
  WHERE p_level IS NULL OR sl.level = p_level
  ORDER BY sl.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get all feature flags
CREATE OR REPLACE FUNCTION admin_get_feature_flags()
RETURNS TABLE (
  id UUID,
  name TEXT,
  key TEXT,
  description TEXT,
  enabled BOOLEAN,
  rollout_percentage INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    ff.id,
    ff.name,
    ff.key,
    ff.description,
    ff.enabled,
    ff.rollout_percentage,
    ff.updated_at
  FROM feature_flags ff
  ORDER BY ff.name;
END;
$$;

-- Toggle feature flag
CREATE OR REPLACE FUNCTION admin_toggle_feature_flag(
  p_flag_id UUID,
  p_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flag_key TEXT;
  v_old_enabled BOOLEAN;
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get current state
  SELECT key, enabled INTO v_flag_key, v_old_enabled
  FROM feature_flags
  WHERE id = p_flag_id;
  
  -- Update flag
  UPDATE feature_flags
  SET 
    enabled = p_enabled,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_flag_id;
  
  -- Log action
  PERFORM log_admin_action(
    'feature_flag_toggled',
    'feature_flag',
    p_flag_id::TEXT,
    jsonb_build_object('key', v_flag_key, 'enabled', v_old_enabled),
    jsonb_build_object('key', v_flag_key, 'enabled', p_enabled)
  );
  
  RETURN TRUE;
END;
$$;

-- Get system settings
CREATE OR REPLACE FUNCTION admin_get_system_settings()
RETURNS TABLE (
  key TEXT,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    ss.key,
    ss.value,
    ss.description,
    ss.updated_at
  FROM system_settings ss
  ORDER BY ss.key;
END;
$$;

-- Update system setting
CREATE OR REPLACE FUNCTION admin_update_system_setting(
  p_key TEXT,
  p_value JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_value JSONB;
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Get old value
  SELECT value INTO v_old_value
  FROM system_settings
  WHERE key = p_key;
  
  -- Update setting
  UPDATE system_settings
  SET 
    value = p_value,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE key = p_key;
  
  -- Log action
  PERFORM log_admin_action(
    'system_setting_changed',
    'system_setting',
    p_key,
    v_old_value,
    p_value
  );
  
  RETURN TRUE;
END;
$$;

-- Get admin audit log
CREATE OR REPLACE FUNCTION admin_get_audit_log(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  admin_email TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    aal.id,
    u.email AS admin_email,
    aal.action,
    aal.resource_type,
    aal.resource_id,
    aal.old_value,
    aal.new_value,
    aal.created_at
  FROM admin_audit_log aal
  JOIN auth.users u ON u.id = aal.admin_user_id
  ORDER BY aal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- MAINTENANCE & CLEANUP
-- ============================================

-- Cleanup old logs (run daily via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_old_system_logs(p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM system_logs
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL
    AND level != 'critical'; -- Keep critical logs forever
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_old_system_logs IS 'Remove system logs older than X days (except critical)';
