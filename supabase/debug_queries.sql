-- ============================================================================
-- DEBUG QUERIES - Run these in Supabase SQL Editor to diagnose the issue
-- ============================================================================

-- 1. Check if you have a public.users record
SELECT id, email, full_name, created_at
FROM public.users
WHERE id = auth.uid();

-- 2. Check if you have any user_orgs records (bypassing RLS)
SELECT user_id, org_id, role, created_at
FROM public.user_orgs
WHERE user_id = auth.uid();

-- 3. Check if you have any organizations
SELECT id, name, created_at
FROM public.organizations;

-- 4. Check all policies on user_orgs
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_orgs';

-- 5. Check all policies on organizations
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'organizations';

-- 6. Try the problematic query directly
SELECT user_id, org_id, role, created_at
FROM public.user_orgs
WHERE user_id = auth.uid();
