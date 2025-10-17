-- ============================================================================
-- COMPLETE RLS POLICY FIX - Non-recursive policies
-- This fixes the infinite recursion by using SECURITY DEFINER functions
-- ============================================================================

-- First, drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization admins can view all members" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can invite members" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can update member roles" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can remove members" ON public.user_orgs;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;

-- ============================================================================
-- Create helper function that bypasses RLS to check membership
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_orgs
        WHERE user_id = auth.uid()
        AND org_id = check_org_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_orgs
        WHERE user_id = auth.uid()
        AND org_id = check_org_id
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_first_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.user_orgs
        WHERE org_id = check_org_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- USER_ORGS POLICIES - Using SECURITY DEFINER functions
-- ============================================================================

CREATE POLICY "Users can view their own memberships"
    ON public.user_orgs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Organization admins can view all members"
    ON public.user_orgs FOR SELECT
    USING (public.user_is_org_admin(org_id));

CREATE POLICY "Organization owners and admins can invite members"
    ON public.user_orgs FOR INSERT
    WITH CHECK (
        public.user_is_org_admin(org_id)
        OR
        public.is_first_org_member(org_id)
    );

CREATE POLICY "Organization owners and admins can update member roles"
    ON public.user_orgs FOR UPDATE
    USING (public.user_is_org_admin(org_id));

CREATE POLICY "Organization owners and admins can remove members"
    ON public.user_orgs FOR DELETE
    USING (public.user_is_org_admin(org_id));

-- ============================================================================
-- ORGANIZATIONS POLICIES - Using helper functions
-- ============================================================================

CREATE POLICY "Users can view their organizations"
    ON public.organizations FOR SELECT
    USING (public.user_is_org_member(id));

CREATE POLICY "Organization owners can update their organization"
    ON public.organizations FOR UPDATE
    USING (public.user_is_org_admin(id));

CREATE POLICY "Users can create organizations"
    ON public.organizations FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- Verify policies
-- ============================================================================

-- Run this to check policies are created:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('user_orgs', 'organizations');
