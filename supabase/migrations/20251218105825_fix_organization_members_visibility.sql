-- ============================================================================
-- FIX: Organization Members Visibility
-- ============================================================================
-- Migration Name: fix_organization_members_visibility
-- Created: 2025-12-18
-- Status: Applied to production
--
-- ISSUE: Users could only see themselves in organization members list
-- ROOT CAUSE: SELECT policy restricted to own records only (user_id = auth.uid())
-- SOLUTION: Allow viewing all members of organizations you belong to
-- ============================================================================

-- Drop restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view their memberships" ON user_orgs;
DROP POLICY IF EXISTS "user_orgs_select_own" ON user_orgs;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON user_orgs;

-- Policy 1: Users can always see their own memberships
-- This is essential for the OrganizationContext to load user's organizations
CREATE POLICY "Users can view their own memberships"
ON user_orgs FOR SELECT
TO public
USING (user_id = auth.uid());

-- Policy 2: Users can see other members of organizations they belong to
-- This enables the full members list in OrganizationManagement
-- Split from policy 1 to avoid circular dependency in subquery
CREATE POLICY "Users can view other members of their organizations"
ON user_orgs FOR SELECT
TO public
USING (
  user_id != auth.uid()
  AND org_id IN (
    SELECT org_id
    FROM user_orgs
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- AFFECTED FEATURES:
-- - Organization members list (OrganizationManagement.tsx line 85-120)
-- - Member role display and management
-- - Team collaboration features
--
-- SECURITY NOTES:
-- - Users can see all members of organizations they belong to
-- - Cannot see members of organizations they don't belong to
-- - Maintains multi-tenant data isolation
-- ============================================================================
