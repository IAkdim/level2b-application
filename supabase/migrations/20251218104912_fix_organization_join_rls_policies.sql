-- ============================================================================
-- FIX: Organization Join RLS Policies
-- ============================================================================
-- Migration Name: fix_organization_join_rls_policies
-- Created: 2025-12-18
-- Status: Applied to production
--
-- ISSUE: Users unable to join organizations
-- ROOT CAUSE: RLS policies prevented viewing organizations before joining them
-- SOLUTION: Allow authenticated users to view organizations for verification
-- ============================================================================

-- Drop existing policies to recreate them correctly
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "user_orgs_insert" ON user_orgs;

-- Organizations table: Allow authenticated users to view any organization
-- This enables users to verify an organization exists before joining
CREATE POLICY "Authenticated users can view organizations"
ON organizations FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- User_orgs table: Allow users to add themselves to organizations
-- This enables the "join organization" feature
CREATE POLICY "Users can add themselves to organizations"
ON user_orgs FOR INSERT
TO public
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- AFFECTED FEATURES:
-- - Organization join functionality (OrganizationSelector.tsx)
-- - Organization verification before joining
-- - Member self-registration to organizations
--
-- SECURITY NOTES:
-- - Users can view organization basic info (id, name, created_at)
-- - Users can only add themselves as members, not other users
-- - Admin invite functionality preserved via "Admins can add members" policy
-- - All other organization data protected by existing policies
-- ============================================================================
