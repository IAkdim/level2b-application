-- ============================================================================
-- SIMPLEST RLS FIX - No subqueries, no recursion
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization admins can view all members" ON public.user_orgs;
DROP POLICY IF EXISTS "Users can view members of orgs where they are admin" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can invite members" ON public.user_orgs;
DROP POLICY IF EXISTS "Users can add members to their orgs" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can update member roles" ON public.user_orgs;
DROP POLICY IF EXISTS "Users can update members in their orgs" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can remove members" ON public.user_orgs;
DROP POLICY IF EXISTS "Users can remove members from their orgs" ON public.user_orgs;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- ============================================================================
-- SIMPLEST APPROACH: Just allow users to see rows where they're the user
-- For team features, we'll query differently from the application layer
-- ============================================================================

-- USER_ORGS: Only show memberships for the current user
CREATE POLICY "user_orgs_select_own"
    ON public.user_orgs FOR SELECT
    USING (user_id = auth.uid());

-- USER_ORGS: Only insert if you're adding yourself OR if org is empty
CREATE POLICY "user_orgs_insert"
    ON public.user_orgs FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR
        NOT EXISTS (
            SELECT 1 FROM public.user_orgs
            WHERE org_id = user_orgs.org_id
            LIMIT 1
        )
    );

-- USER_ORGS: Can't update memberships (simplest approach)
-- If needed later, we can add via application logic

-- USER_ORGS: Can only delete your own membership (leave org)
CREATE POLICY "user_orgs_delete_own"
    ON public.user_orgs FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- ORGANIZATIONS: Show orgs where user has membership
-- This uses a simple subquery that only checks user_id (no recursion)
-- ============================================================================

CREATE POLICY "organizations_select"
    ON public.organizations FOR SELECT
    USING (
        id IN (
            SELECT org_id FROM public.user_orgs
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "organizations_update"
    ON public.organizations FOR UPDATE
    USING (
        id IN (
            SELECT org_id FROM public.user_orgs
            WHERE user_id = auth.uid()
            AND role = 'owner'
        )
    );

CREATE POLICY "organizations_insert"
    ON public.organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test query (run as your user):
-- SELECT * FROM user_orgs WHERE user_id = auth.uid();
--
-- Should show your memberships without recursion error
-- ============================================================================
