-- ============================================================================
-- DAILY_USAGE CLEANUP: Automatically remove old records using pg_cron
-- ============================================================================
-- Only today's usage matters - historical data is not needed.
-- pg_cron schedules a daily cleanup job that runs at midnight UTC.
-- ============================================================================

-- Step 1: Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_daily_usage()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM daily_usage 
  WHERE usage_date < CURRENT_DATE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Enable pg_cron extension
-- Note: In Supabase, enable via Dashboard: Database > Extensions > pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 3: Schedule the cleanup job to run daily at 00:05 UTC
SELECT cron.schedule(
  'cleanup-daily-usage',
  '5 0 * * *',
  $$SELECT cleanup_old_daily_usage()$$
);

-- Step 4: Run once now to clean existing old records
SELECT cleanup_old_daily_usage();
