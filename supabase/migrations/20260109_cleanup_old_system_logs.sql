-- ============================================================================
-- SYSTEM_LOGS CLEANUP: Automatically remove old records using pg_cron
-- ============================================================================
-- System logs older than 30 days are not needed and should be cleaned up.
-- pg_cron schedules a daily cleanup job.
-- ============================================================================

-- Step 1: Drop ALL existing versions of this function
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid::regprocedure as func_signature
    FROM pg_proc 
    WHERE proname = 'cleanup_old_system_logs'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- Step 2: Create the cleanup function
CREATE FUNCTION cleanup_old_system_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM system_logs 
  WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Schedule the cleanup job to run daily at 00:15 UTC
SELECT cron.schedule(
  'cleanup-old-system-logs',
  '15 0 * * *',
  $$SELECT cleanup_old_system_logs()$$
);

-- Step 4: Run once now to clean existing old records
SELECT cleanup_old_system_logs();
