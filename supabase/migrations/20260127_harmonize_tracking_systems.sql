-- Migration: Harmonize Email Tracking Systems
-- Date: 2026-01-27
-- Description: Links email_tracking with email_tracking_metadata and removes duplication
--
-- BACKGROUND:
-- We have two tracking systems with different purposes:
--   1. email_tracking_metadata (PRIMARY) - Thread/message/lead correlation (IDs only, GDPR-compliant)
--   2. email_tracking (SECONDARY) - Engagement metrics (opens, user agent, etc.)
--
-- This migration:
--   - Links the two tables via foreign key
--   - Removes duplicate fields from email_tracking
--   - Deprecates email_threads/email_messages (content-storing tables)

-- ============================================================================
-- STEP 1: Add foreign key to link tables
-- ============================================================================

-- Add tracking_metadata_id column to email_tracking
-- This creates a 1:1 optional relationship (email can be sent without tracking pixel)
ALTER TABLE email_tracking
  ADD COLUMN IF NOT EXISTS tracking_metadata_id UUID REFERENCES email_tracking_metadata(id) ON DELETE SET NULL;

-- Index for joins
CREATE INDEX IF NOT EXISTS idx_email_tracking_metadata_id
  ON email_tracking(tracking_metadata_id);

COMMENT ON COLUMN email_tracking.tracking_metadata_id IS
  'Links to email_tracking_metadata (PRIMARY correlation table). NULL if tracking pixel was not used.';

-- ============================================================================
-- STEP 2: Remove duplicate fields from email_tracking
-- ============================================================================

-- These fields are now in email_tracking_metadata (primary source of truth)
-- Note: We keep gmail_message_id and gmail_thread_id temporarily for backwards compatibility
-- They can be removed in a future migration after data backfill

-- Remove subject (now queried from provider on-demand)
ALTER TABLE email_tracking DROP COLUMN IF EXISTS subject;

-- Remove label_name (now in email_tracking_metadata.label)
ALTER TABLE email_tracking DROP COLUMN IF EXISTS label_name;

-- Update comments
COMMENT ON TABLE email_tracking IS
  'Email open tracking (SECONDARY) - stores engagement metrics only.
   For message/thread/lead correlation, use email_tracking_metadata.';

-- ============================================================================
-- STEP 3: Deprecate content-storing tables
-- ============================================================================

-- Mark email_threads and email_messages as deprecated
-- These tables store full email content, violating our GDPR-compliant on-demand fetching approach
-- DO NOT use these tables in new code. Use emailService + email_tracking_metadata instead.

COMMENT ON TABLE email_threads IS
  'DEPRECATED: Stores full email content (violates GDPR on-demand fetching principle).
   Use emailService.getEmailThread() for on-demand fetching.
   Use email_tracking_metadata for thread/lead correlation.
   This table will be removed in a future migration.';

COMMENT ON TABLE email_messages IS
  'DEPRECATED: Stores full email content (violates GDPR on-demand fetching principle).
   Use emailService.getEmailThread() for on-demand fetching.
   Use email_tracking_metadata for message/lead correlation.
   This table will be removed in a future migration.';

-- ============================================================================
-- STEP 4: Create helper function to get enriched tracking data
-- ============================================================================

-- Function to get email tracking data with metadata in one query
CREATE OR REPLACE FUNCTION get_enriched_email_tracking(
  p_user_id UUID,
  p_label TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  -- From email_tracking_metadata
  message_id TEXT,
  thread_id TEXT,
  lead_id UUID,
  provider TEXT,
  label TEXT,
  sent_at TIMESTAMPTZ,

  -- From email_tracking (optional, NULL if no tracking pixel)
  tracking_id UUID,
  is_opened BOOLEAN,
  open_count INTEGER,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  open_user_agent TEXT,
  open_ip_country TEXT,
  is_apple_mpp BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- From email_tracking_metadata (always present)
    etm.message_id,
    etm.thread_id,
    etm.lead_id,
    etm.provider,
    etm.label,
    etm.sent_at,

    -- From email_tracking (optional, NULL if no tracking pixel)
    et.tracking_id,
    et.is_opened,
    et.open_count,
    et.first_opened_at,
    et.last_opened_at,
    et.open_user_agent,
    et.open_ip_country,
    et.is_apple_mpp
  FROM email_tracking_metadata etm
  LEFT JOIN email_tracking et ON et.tracking_metadata_id = etm.id
  WHERE etm.user_id = p_user_id
    AND (p_label IS NULL OR etm.label = p_label)
    AND (p_start_date IS NULL OR etm.sent_at >= p_start_date)
    AND (p_end_date IS NULL OR etm.sent_at <= p_end_date)
  ORDER BY etm.sent_at DESC;
END;
$$;

COMMENT ON FUNCTION get_enriched_email_tracking IS
  'Gets email tracking data with engagement metrics in one query.
   Joins email_tracking_metadata (PRIMARY) with email_tracking (SECONDARY).
   Returns all sent emails even if tracking pixel was not used (tracking fields will be NULL).';

-- ============================================================================
-- STEP 5: Update record_email_open_simple to work with new schema
-- ============================================================================

-- The function already exists and works fine, but add a note
COMMENT ON FUNCTION record_email_open_simple IS
  'Records an email open event in email_tracking table.
   Called by tracking pixel Edge Function.
   Note: This only updates engagement metrics. Message correlation is in email_tracking_metadata.';
