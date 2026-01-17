-- ============================================================================
-- ACTIVITIES CLEANUP: Automatically remove old records using pg_cron
-- ============================================================================
-- Activities older than 7 days are not needed and should be cleaned up.
-- pg_cron schedules a weekly cleanup job.
-- ============================================================================

-- Step 1: Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM activities 
  WHERE created_at < CURRENT_DATE - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Schedule the cleanup job to run daily at 00:10 UTC
-- Runs daily to ensure activities are cleaned up promptly after 7 days
SELECT cron.schedule(
  'cleanup-old-activities',
  '10 0 * * *',
  $$SELECT cleanup_old_activities()$$
);

-- Step 3: Run once now to clean existing old records
SELECT cleanup_old_activities();
