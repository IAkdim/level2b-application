-- ============================================================================
-- CLEANUP SCRIPT - Drop all existing policies before re-running migrations
-- Run this FIRST, then run the foundation and CRM migrations
-- ============================================================================

-- Drop all policies on user_orgs
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization admins can view all members" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can invite members" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can update member roles" ON public.user_orgs;
DROP POLICY IF EXISTS "Organization owners and admins can remove members" ON public.user_orgs;

-- Drop all policies on organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;

-- Drop all policies on users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Drop all policies on leads (if they exist)
DROP POLICY IF EXISTS "Users can view leads in their organization" ON leads;
DROP POLICY IF EXISTS "Users can insert leads in their organization" ON leads;
DROP POLICY IF EXISTS "Users can update leads in their organization" ON leads;
DROP POLICY IF EXISTS "Users can delete leads in their organization" ON leads;

-- Drop all policies on activities (if they exist)
DROP POLICY IF EXISTS "Users can view activities in their organization" ON activities;
DROP POLICY IF EXISTS "Users can insert activities in their organization" ON activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;

-- Drop all policies on tasks (if they exist)
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their organization" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their organization" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their organization" ON tasks;

-- Drop all policies on notes (if they exist)
DROP POLICY IF EXISTS "Users can view notes in their organization" ON notes;
DROP POLICY IF EXISTS "Users can insert notes in their organization" ON notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;

-- Drop all policies on deals (if they exist)
DROP POLICY IF EXISTS "Users can view deals in their organization" ON deals;
DROP POLICY IF EXISTS "Users can insert deals in their organization" ON deals;
DROP POLICY IF EXISTS "Users can update deals in their organization" ON deals;
DROP POLICY IF EXISTS "Users can delete deals in their organization" ON deals;

-- Verification: List all remaining policies
-- Uncomment to check if any policies remain:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
