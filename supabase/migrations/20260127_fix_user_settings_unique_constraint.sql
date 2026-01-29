-- Migration: Ensure user_settings has a unique constraint on user_id
-- This fixes the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error

-- ============================================================================
-- STEP 1: Drop old unique constraint that includes organization_id (if exists)
-- ============================================================================

-- Drop the old composite unique constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_user_id_organization_id_key'
  ) THEN
    ALTER TABLE user_settings DROP CONSTRAINT user_settings_user_id_organization_id_key;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Ensure user_id unique constraint exists
-- ============================================================================

-- Add unique constraint on user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_user_id_key'
  ) THEN
    -- First, delete any duplicate rows keeping only the most recent one
    WITH duplicates AS (
      SELECT id, user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
      FROM user_settings
    )
    DELETE FROM user_settings
    WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
    
    -- Now add the unique constraint
    ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add helpful comment
-- ============================================================================

COMMENT ON CONSTRAINT user_settings_user_id_key ON user_settings IS 'Ensures one settings record per user';
