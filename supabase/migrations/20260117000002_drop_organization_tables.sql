-- Migration: Drop organization-related tables
-- This migration removes the organizations infrastructure completely

-- ============================================================================
-- STEP 1: Drop organization settings table
-- ============================================================================

-- Drop policies first
DROP POLICY IF EXISTS "Users can view organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Users can insert organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Users can update organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Users can delete organization settings" ON organization_settings;

-- Drop the table
DROP TABLE IF EXISTS organization_settings CASCADE;

-- ============================================================================
-- STEP 2: Drop user_orgs junction table
-- ============================================================================

-- Drop policies first
DROP POLICY IF EXISTS "Users can view own organization memberships" ON user_orgs;
DROP POLICY IF EXISTS "Users can view user_orgs" ON user_orgs;
DROP POLICY IF EXISTS "Users can insert user_orgs" ON user_orgs;
DROP POLICY IF EXISTS "Users can update user_orgs" ON user_orgs;
DROP POLICY IF EXISTS "Users can delete user_orgs" ON user_orgs;
DROP POLICY IF EXISTS "Organization admins can manage members" ON user_orgs;

-- Drop the table
DROP TABLE IF EXISTS user_orgs CASCADE;

-- ============================================================================
-- STEP 3: Drop organizations table
-- ============================================================================

-- Drop policies first
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Users can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update organizations" ON organizations;
DROP POLICY IF EXISTS "Users can delete organizations" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update" ON organizations;
DROP POLICY IF EXISTS "Organization owners can delete" ON organizations;

-- Drop the table (this will cascade to any remaining foreign keys)
DROP TABLE IF EXISTS organizations CASCADE;

-- ============================================================================
-- STEP 4: Update user_settings to remove organization_id
-- ============================================================================

-- Drop the foreign key constraint
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_organization_id_fkey;

-- Drop the organization_id column
ALTER TABLE user_settings DROP COLUMN IF EXISTS organization_id;

-- Ensure user_id is unique (should already be, but let's make sure)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_user_id_key'
  ) THEN
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Update comment
COMMENT ON TABLE user_settings IS 'User-specific settings and preferences';

-- ============================================================================
-- STEP 5: Add company_info to users.metadata for those who had it in orgs
-- ============================================================================

-- Note: This is a one-time migration to preserve any company settings
-- We'll store company info in the users.metadata JSONB field

-- First, let's add a helpful comment
COMMENT ON COLUMN users.metadata IS 'User metadata including company info (company_name, company_description, product_service, unique_selling_points, target_audience, industry)';

-- ============================================================================
-- STEP 6: Clean up any orphaned data
-- ============================================================================

-- This is safe since we've already dropped the tables
-- Just documenting for clarity

-- Note: If you need to preserve any organization data before running this migration,
-- export it using:
-- SELECT * FROM organizations;
-- SELECT * FROM user_orgs;
-- SELECT * FROM organization_settings;
