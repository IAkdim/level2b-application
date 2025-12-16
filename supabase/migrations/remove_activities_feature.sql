-- ============================================================================
-- REMOVE ACTIVITIES FEATURE
-- ============================================================================
-- This migration removes the activities feature completely from the database
-- including the table, triggers, functions, policies, and indexes.
-- ============================================================================

-- STEP 1: Drop all triggers that create activities
-- ============================================================================
DROP TRIGGER IF EXISTS lead_status_change_activity ON leads;
DROP TRIGGER IF EXISTS on_deal_stage_change ON deals;
DROP TRIGGER IF EXISTS on_task_completion ON tasks;

-- STEP 2: Drop the trigger functions (CASCADE to handle dependencies)
-- ============================================================================
DROP FUNCTION IF EXISTS create_status_change_activity() CASCADE;
DROP FUNCTION IF EXISTS create_deal_stage_activity() CASCADE;
DROP FUNCTION IF EXISTS create_task_completion_activity() CASCADE;

-- STEP 3: Drop helper functions for activities
-- ============================================================================
-- Note: We need to specify exact parameter signatures for functions
DROP FUNCTION IF EXISTS get_recent_org_activities(UUID, INTEGER, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_org_activity_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_scheduled_activities(UUID, INTEGER);

-- STEP 4: Drop RLS policies and indexes (only if table exists)
-- ============================================================================
-- We use DO block to check if table exists before dropping policies/indexes
-- This prevents errors if the table was never created

DO $$
BEGIN
    -- Only drop policies and indexes if the activities table exists
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'activities') THEN
        -- Drop RLS policies
        DROP POLICY IF EXISTS "activities_select" ON activities;
        DROP POLICY IF EXISTS "activities_insert" ON activities;
        DROP POLICY IF EXISTS "activities_update" ON activities;
        DROP POLICY IF EXISTS "activities_delete" ON activities;

        -- Drop older policy names if they exist
        DROP POLICY IF EXISTS "Users can view activities in their organization" ON activities;
        DROP POLICY IF EXISTS "Users can insert activities in their organization" ON activities;
        DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
        DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;

        -- Drop indexes
        DROP INDEX IF EXISTS idx_activities_lead_id;
        DROP INDEX IF EXISTS idx_activities_org_id;
        DROP INDEX IF EXISTS idx_activities_created_at;
        DROP INDEX IF EXISTS idx_activities_type;
        DROP INDEX IF EXISTS idx_activities_created_by;
        DROP INDEX IF EXISTS idx_activities_scheduled_at;
        DROP INDEX IF EXISTS idx_activities_org_created;

        RAISE NOTICE 'Dropped policies and indexes for activities table';
    ELSE
        RAISE NOTICE 'Activities table does not exist - skipping policies and indexes';
    END IF;
END $$;

-- STEP 6: Drop the activities table
-- ============================================================================
DROP TABLE IF EXISTS activities CASCADE;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - uncomment to verify)
-- ============================================================================

-- Verify table is gone:
-- SELECT tablename FROM pg_tables WHERE tablename = 'activities';

-- Verify trigger is gone:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'lead_status_change_activity';

-- Verify functions are gone:
-- SELECT proname FROM pg_proc WHERE proname IN (
--   'create_status_change_activity',
--   'get_recent_org_activities',
--   'get_org_activity_stats',
--   'get_scheduled_activities'
-- );

-- ============================================================================
-- CLEANUP COMPLETE
-- ============================================================================
