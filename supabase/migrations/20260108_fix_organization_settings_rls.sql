-- Fix RLS policies for organization_settings and user_settings
-- The policies were referencing wrong column names

-- Drop ALL existing policies for organization_settings
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "organization_settings_select" ON public.organization_settings;
  DROP POLICY IF EXISTS "organization_settings_insert" ON public.organization_settings;
  DROP POLICY IF EXISTS "organization_settings_update" ON public.organization_settings;
  DROP POLICY IF EXISTS "organization_settings_delete" ON public.organization_settings;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors if policies don't exist
END $$;

-- Create corrected organization_settings policies (using org_id)
CREATE POLICY "organization_settings_select" 
  ON public.organization_settings 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_orgs 
      WHERE user_orgs.org_id = organization_settings.org_id 
        AND user_orgs.user_id = auth.uid()
    )
  );

CREATE POLICY "organization_settings_insert" 
  ON public.organization_settings 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.user_orgs 
      WHERE user_orgs.org_id = organization_settings.org_id 
        AND user_orgs.user_id = auth.uid() 
        AND user_orgs.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "organization_settings_update" 
  ON public.organization_settings 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_orgs 
      WHERE user_orgs.org_id = organization_settings.org_id 
        AND user_orgs.user_id = auth.uid() 
        AND user_orgs.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "organization_settings_delete" 
  ON public.organization_settings 
  FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_orgs 
      WHERE user_orgs.org_id = organization_settings.org_id 
        AND user_orgs.user_id = auth.uid() 
        AND user_orgs.role = 'owner'
    )
  );

-- Drop ALL existing policies for user_settings
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
  DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
  DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
  DROP POLICY IF EXISTS "user_settings_select" ON public.user_settings;
  DROP POLICY IF EXISTS "user_settings_insert" ON public.user_settings;
  DROP POLICY IF EXISTS "user_settings_update" ON public.user_settings;
  DROP POLICY IF EXISTS "user_settings_delete" ON public.user_settings;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors if policies don't exist
END $$;

-- Recreate user_settings policies with correct column references
CREATE POLICY "user_settings_select" 
  ON public.user_settings 
  FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 
      FROM public.user_orgs 
      WHERE user_orgs.org_id = user_settings.organization_id 
        AND user_orgs.user_id = auth.uid()
    )
  );

CREATE POLICY "user_settings_insert" 
  ON public.user_settings 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" 
  ON public.user_settings 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
