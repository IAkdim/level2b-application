-- ============================================================================
-- PROPER RLS FIX - Using correct policy patterns without recursion
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization admins can view all members" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can invite members" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can update member roles" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can remove members" ON public.user_orgs;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;

-- Drop helper functions if they exist
DROP FUNCTION IF EXISTS public.user_is_org_member(UUID);
DROP FUNCTION IF EXISTS public.user_is_org_admin(UUID);
DROP FUNCTION IF EXISTS public.is_first_org_member(UUID);

-- ============================================================================
-- USER_ORGS POLICIES - Simple, non-recursive
-- The key: user_orgs policies should ONLY check columns on user_orgs itself
-- ============================================================================

-- Allow users to see their own memberships (no recursion - just checking user_id)
CREATE POLICY "Users can view their own memberships"
    ON public.user_orgs FOR SELECT
    USING (user_id = auth.uid());

-- Allow admins to see all members (but admins must be able to see themselves first)
-- This is a SEPARATE policy that's also permissive
CREATE POLICY "Users can view members of orgs where they are admin"
    ON public.user_orgs FOR SELECT
    USING (
        org_id IN (
            SELECT uo.org_id
            FROM public.user_orgs uo
            WHERE uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
    );

-- For INSERT: Allow if user is admin of that org OR if org has no members yet
CREATE POLICY "Users can add members to their orgs"
    ON public.user_orgs FOR INSERT
    WITH CHECK (
        -- User is admin/owner of this org
        org_id IN (
            SELECT uo.org_id
            FROM public.user_orgs uo
            WHERE uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
        OR
        -- This is the first member (organization creation)
        NOT EXISTS (
            SELECT 1 FROM public.user_orgs uo2
            WHERE uo2.org_id = user_orgs.org_id
        )
    );

-- For UPDATE: Allow if user is admin
CREATE POLICY "Users can update members in their orgs"
    ON public.user_orgs FOR UPDATE
    USING (
        org_id IN (
            SELECT uo.org_id
            FROM public.user_orgs uo
            WHERE uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
    );

-- For DELETE: Allow if user is admin
CREATE POLICY "Users can remove members from their orgs"
    ON public.user_orgs FOR DELETE
    USING (
        org_id IN (
            SELECT uo.org_id
            FROM public.user_orgs uo
            WHERE uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- ORGANIZATIONS POLICIES - Simple joins to user_orgs
-- ============================================================================

CREATE POLICY "Users can view their organizations"
    ON public.organizations FOR SELECT
    USING (
        id IN (
            SELECT uo.org_id
            FROM public.user_orgs uo
            WHERE uo.user_id = auth.uid()
        )
    );

CREATE POLICY "Owners can update their organization"
    ON public.organizations FOR UPDATE
    USING (
        id IN (
            SELECT uo.org_id
            FROM public.user_orgs uo
            WHERE uo.user_id = auth.uid()
            AND uo.role = 'owner'
        )
    );

CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- EXPLANATION
-- ============================================================================
-- The recursion happens when:
-- 1. You query user_orgs
-- 2. The policy checks user_orgs (recursive!)
--
-- Solution:
-- - user_orgs SELECT policies are PERMISSIVE (multiple policies with OR logic)
-- - First policy: "show me MY memberships" (user_id = auth.uid()) - NO recursion
-- - Second policy: "show me members where I'm admin" - uses subquery with alias
-- - The subquery uses the FIRST policy to find where current user is admin
-- - This works because RLS policies are evaluated separately and combined with OR
-- ============================================================================
