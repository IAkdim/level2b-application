-- ============================================================================
-- FOUNDATIONAL SCHEMA FOR LEVEL2B
-- Complete setup including users, organizations, and auth triggers
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PUBLIC USERS TABLE
-- Extends Supabase auth.users with profile information
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Profile Information
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- ============================================================================
-- ORGANIZATIONS TABLE
-- Multi-tenancy: Each organization is a separate workspace
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organization Details
    name TEXT NOT NULL,
    slug TEXT UNIQUE, -- URL-friendly identifier (optional)

    -- Settings
    settings JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- Enable RLS (policies added after user_orgs table is created)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USER_ORGS TABLE (Junction/Membership Table)
-- Links users to organizations with roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_orgs (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Role-based access control
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, org_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_orgs_user_id ON public.user_orgs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org_id ON public.user_orgs(org_id);

-- Enable RLS
ALTER TABLE public.user_orgs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_orgs
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_orgs;
CREATE POLICY "Users can view their own memberships"
    ON public.user_orgs FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Organization admins can view all members" ON public.user_orgs;
CREATE POLICY "Organization admins can view all members"
    ON public.user_orgs FOR SELECT
    USING (
        -- Allow if user is admin/owner of this org (using EXISTS to avoid recursion)
        EXISTS (
            SELECT 1 FROM public.user_orgs uo
            WHERE uo.org_id = user_orgs.org_id
            AND uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Organization owners and admins can invite members" ON public.user_orgs;
CREATE POLICY "Organization owners and admins can invite members"
    ON public.user_orgs FOR INSERT
    WITH CHECK (
        -- Allow if user is admin/owner (checking the INCOMING org_id)
        EXISTS (
            SELECT 1 FROM public.user_orgs uo
            WHERE uo.org_id = user_orgs.org_id
            AND uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
        OR
        -- OR if this is the first member (creating as owner)
        NOT EXISTS (SELECT 1 FROM public.user_orgs WHERE org_id = user_orgs.org_id)
    );

DROP POLICY IF EXISTS "Organization owners and admins can update member roles" ON public.user_orgs;
CREATE POLICY "Organization owners and admins can update member roles"
    ON public.user_orgs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_orgs uo
            WHERE uo.org_id = user_orgs.org_id
            AND uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Organization owners and admins can remove members" ON public.user_orgs;
CREATE POLICY "Organization owners and admins can remove members"
    ON public.user_orgs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_orgs uo
            WHERE uo.org_id = user_orgs.org_id
            AND uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- RLS POLICIES FOR ORGANIZATIONS (now that user_orgs exists)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
CREATE POLICY "Users can view their organizations"
    ON public.organizations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_orgs uo
            WHERE uo.org_id = organizations.id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
CREATE POLICY "Organization owners can update their organization"
    ON public.organizations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_orgs uo
            WHERE uo.org_id = organizations.id
            AND uo.user_id = auth.uid()
            AND uo.role = 'owner'
        )
    );

DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations"
    ON public.organizations FOR INSERT
    WITH CHECK (true); -- Any authenticated user can create an org

-- ============================================================================
-- TRIGGER: AUTO-CREATE PUBLIC USER ON AUTH SIGNUP
-- Handles both email/password and OAuth (Google) signups
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_full_name TEXT;
    user_avatar TEXT;
    new_org_id UUID;
    default_org_name TEXT;
BEGIN
    -- Extract name and avatar from raw_user_meta_data (works for both email and OAuth)
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1) -- Fallback: use email prefix
    );

    user_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture' -- Google OAuth uses 'picture'
    );

    -- Create public.users record
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        user_avatar
    );

    -- Auto-create a default organization for the new user
    default_org_name := user_full_name || '''s Organization';

    INSERT INTO public.organizations (name)
    VALUES (default_org_name)
    RETURNING id INTO new_org_id;

    -- Add user as owner of their default organization
    INSERT INTO public.user_orgs (user_id, org_id, role)
    VALUES (NEW.id, new_org_id, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- TRIGGER: UPDATE UPDATED_AT TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTION: CREATE ORGANIZATION WITH OWNER
-- Call this from your frontend when creating a new organization
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    org_name TEXT,
    org_slug TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_org_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Create organization
    INSERT INTO public.organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO new_org_id;

    -- Add creator as owner
    INSERT INTO public.user_orgs (user_id, org_id, role)
    VALUES (current_user_id, new_org_id, 'owner');

    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: JOIN ORGANIZATION BY ID
-- Users can join an organization if they have the org ID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_organization(
    org_id_to_join UUID,
    join_as_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if organization exists
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id_to_join) THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM public.user_orgs
        WHERE user_id = current_user_id AND org_id = org_id_to_join
    ) THEN
        RAISE EXCEPTION 'Already a member of this organization';
    END IF;

    -- Add user to organization
    INSERT INTO public.user_orgs (user_id, org_id, role)
    VALUES (current_user_id, org_id_to_join, join_as_role);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- Uncomment if you want to test with sample data
-- ============================================================================

-- Example: Insert a test organization (only if running in development)
-- INSERT INTO public.organizations (id, name, slug)
-- VALUES (
--     '00000000-0000-0000-0000-000000000001'::UUID,
--     'Test Organization',
--     'test-org'
-- );

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.users IS 'Public user profiles - extends auth.users with additional information';
COMMENT ON TABLE public.organizations IS 'Organizations/workspaces for multi-tenancy';
COMMENT ON TABLE public.user_orgs IS 'Junction table linking users to organizations with roles';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates public.users record when auth.users is created (email or OAuth)';
COMMENT ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) IS 'Helper function to create org and assign creator as owner';
COMMENT ON FUNCTION public.join_organization(UUID, TEXT) IS 'Helper function for users to join existing organizations';

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these after migration to verify everything worked
-- ============================================================================

-- Check all tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('users', 'organizations', 'user_orgs');

-- Check trigger exists
-- SELECT trigger_name, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public' OR event_object_schema = 'auth';

-- Check RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public';
