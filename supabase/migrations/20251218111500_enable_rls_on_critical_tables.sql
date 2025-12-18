-- ============================================================================
-- CRITICAL SECURITY FIX: Enable RLS on Critical Tables
-- ============================================================================
-- Migration Name: enable_rls_on_critical_tables
-- Created: 2025-12-18
-- Status: Applied to production
--
-- ISSUE: RLS policies existed but RLS was DISABLED on users and user_orgs tables
-- SEVERITY: CRITICAL - Anyone could access all user data and organization memberships
-- SOLUTION: Enable RLS on these tables to enforce security policies
-- ============================================================================

-- Enable Row Level Security on critical authentication tables
ALTER TABLE user_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION:
-- After applying this migration, verify RLS is enabled:
--
-- SELECT schemaname, tablename, rowsecurity as rls_enabled
-- FROM pg_tables
-- WHERE tablename IN ('users', 'user_orgs', 'organizations')
-- AND schemaname = 'public';
--
-- Expected result: All three tables should show rls_enabled = true
-- ============================================================================

-- ============================================================================
-- SECURITY IMPACT:
-- Before: Anyone could query all users and organization memberships
-- After: Only authorized users can see data based on RLS policies:
--   - users: Can see own profile + teammates in same organizations
--   - user_orgs: Can see members of organizations you belong to
--   - organizations: Can see all orgs (needed for join feature)
-- ============================================================================
