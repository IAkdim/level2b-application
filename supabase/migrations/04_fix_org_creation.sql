-- ============================================================================
-- FIX ORGANIZATION CREATION
-- The issue: When creating an org, the helper function tries to insert into
-- user_orgs, but RLS blocks it because the org doesn't exist yet
-- Solution: Make the function SECURITY DEFINER to bypass RLS
-- ============================================================================

-- Update the create_organization_with_owner function to use SECURITY DEFINER
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT);

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

    -- Add creator as owner (this bypasses RLS due to SECURITY DEFINER)
    INSERT INTO public.user_orgs (user_id, org_id, role)
    VALUES (current_user_id, new_org_id, 'owner');

    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) TO authenticated;

-- Also update the handle_new_user trigger to use SECURITY DEFINER
-- (it already has it, but let's make sure the latest version is correct)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_full_name TEXT;
    user_avatar TEXT;
    new_org_id UUID;
    default_org_name TEXT;
BEGIN
    -- Extract name and avatar from raw_user_meta_data
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    user_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture'
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- EXPLANATION
-- ============================================================================
-- SECURITY DEFINER is appropriate here because:
-- 1. These are administrative functions (creating orgs, adding owners)
-- 2. They run in a trusted context (auth signup, explicit org creation)
-- 3. They validate the user is authenticated before proceeding
-- 4. They only insert data the user should be allowed to create
--
-- This is the correct pattern for "privileged operations" in Supabase
-- ============================================================================
