-- Migration: Replace label with campaign_name in email_tracking_metadata
-- Date: 2026-01-27
-- Description: Move from Gmail-specific labels to provider-agnostic campaigns

-- Step 1: Add campaign_name column
ALTER TABLE email_tracking_metadata
  ADD COLUMN IF NOT EXISTS campaign_name TEXT;

-- Step 2: Migrate existing label data to campaign_name
UPDATE email_tracking_metadata
  SET campaign_name = label
  WHERE label IS NOT NULL AND campaign_name IS NULL;

-- Step 3: Drop the label column (it's now replaced by campaign_name)
ALTER TABLE email_tracking_metadata
  DROP COLUMN IF EXISTS label;

-- Step 4: Add index for campaign filtering
CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign_name
  ON email_tracking_metadata(campaign_name) WHERE campaign_name IS NOT NULL;

-- Step 5: Update comments
COMMENT ON COLUMN email_tracking_metadata.campaign_name IS
  'Campaign identifier (provider-agnostic). Used to group related emails without relying on Gmail labels.';

COMMENT ON TABLE email_tracking_metadata IS
  'Email tracking metadata - stores only IDs (thread_id, message_id) in a GDPR-compliant way.
   PRIMARY table for thread/message/lead correlation.
   Uses campaign_name instead of provider-specific labels for grouping.';
