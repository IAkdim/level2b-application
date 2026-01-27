-- =============================================================================
-- FIX LEAD STATUS HISTORY TRIGGERS
-- =============================================================================
-- The triggers were referencing org_id which no longer exists on leads table.
-- Updated to use user_id instead.

-- First, check if lead_status_history has user_id column, add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_status_history' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE lead_status_history ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make user_id not null if org_id exists and has data, migrate first
DO $$
BEGIN
  -- Check if org_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_status_history' 
    AND column_name = 'org_id'
  ) THEN
    -- Drop the not null constraint on org_id if it exists
    ALTER TABLE lead_status_history ALTER COLUMN org_id DROP NOT NULL;
  END IF;
END $$;

-- Create index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_lead_status_history_user_date 
  ON lead_status_history(user_id, changed_date DESC);

-- ============================================================================
-- TRIGGER: Track lead status changes automatically (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_status_history (user_id, lead_id, old_status, new_status, changed_by)
    VALUES (NEW.user_id, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Track new leads (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION track_new_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Track the initial status
  INSERT INTO lead_status_history (user_id, lead_id, old_status, new_status, changed_by)
  VALUES (NEW.user_id, NEW.id, NULL, NEW.status, auth.uid());
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the lead insert if history tracking fails
    RAISE WARNING 'Failed to track new lead: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
DROP TRIGGER IF EXISTS lead_status_change_trigger ON leads;
CREATE TRIGGER lead_status_change_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION track_lead_status_change();

DROP TRIGGER IF EXISTS new_lead_trigger ON leads;
CREATE TRIGGER new_lead_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION track_new_lead();

-- Update RLS policies for lead_status_history
DROP POLICY IF EXISTS "Users can view own lead status history" ON lead_status_history;
CREATE POLICY "Users can view own lead status history"
  ON lead_status_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert lead status history" ON lead_status_history;
CREATE POLICY "Users can insert lead status history"
  ON lead_status_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all
DROP POLICY IF EXISTS "Service role full access to lead_status_history" ON lead_status_history;
CREATE POLICY "Service role full access to lead_status_history"
  ON lead_status_history FOR ALL
  USING (true);
