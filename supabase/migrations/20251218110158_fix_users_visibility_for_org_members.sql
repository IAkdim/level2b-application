-- ============================================================================
-- FIX: Users Table Visibility for Organization Members
-- ============================================================================
-- Migration Name: fix_users_visibility_for_org_members
-- Created: 2025-12-18
-- Status: Applied to production
--
-- ISSUE: Users stuck on organization selector, cannot see teammate profiles
-- ROOT CAUSE: Users table policy only allowed viewing own profile
-- SOLUTION: Allow viewing profiles of users in same organizations
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
TO public
USING (auth.uid() = id);

-- Policy 2: Users can view profiles of members in their organizations
-- This is essential for organization member lists and user joins in queries
CREATE POLICY "Users can view org members profiles"
ON users FOR SELECT
TO public
USING (
  id IN (
    SELECT user_id
    FROM user_orgs
    WHERE org_id IN (
      SELECT org_id
      FROM user_orgs
      WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================================
-- AFFECTED FEATURES:
-- - Organization member list with user details
-- - OrganizationContext loading (OrganizationContext.tsx line 28-37)
-- - Organization management page (OrganizationManagement.tsx)
-- - Any queries joining user_orgs with users table
--
-- SECURITY NOTES:
-- - Users can see profiles of teammates in same organizations
-- - Users cannot see profiles of users outside their organizations
-- - Maintains multi-tenant data isolation
-- ============================================================================
