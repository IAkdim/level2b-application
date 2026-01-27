-- Migration: Simple Email Tracking Table
-- Date: 2026-01-22
-- Description: Creates a standalone tracking table for email opens
-- This works independently of the email_messages table

-- ============================================================================
-- DROP IF EXISTS (for re-running)
-- ============================================================================
DROP TABLE IF EXISTS public.email_tracking CASCADE;

-- ============================================================================
-- CREATE SIMPLE EMAIL_TRACKING TABLE
-- Stores tracking_id -> recipient mapping for open tracking
-- ============================================================================

CREATE TABLE public.email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The tracking ID embedded in the tracking pixel
  tracking_id UUID NOT NULL UNIQUE,
  
  -- Gmail message ID (for correlation)
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  
  -- Recipient info
  recipient_email TEXT NOT NULL,
  recipient_email_hash TEXT NOT NULL,
  
  -- Email info
  subject TEXT,
  label_name TEXT,
  
  -- Open tracking
  is_opened BOOLEAN DEFAULT false,
  first_opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  
  -- Metadata from open event
  open_user_agent TEXT,
  open_ip_country TEXT,
  is_apple_mpp BOOLEAN DEFAULT false,
  
  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE email_tracking IS 'Simple email open tracking - stores tracking pixels and open events';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_email_tracking_user_id 
  ON email_tracking(user_id);

CREATE INDEX idx_email_tracking_tracking_id 
  ON email_tracking(tracking_id);

CREATE INDEX idx_email_tracking_gmail_message_id 
  ON email_tracking(gmail_message_id) WHERE gmail_message_id IS NOT NULL;

CREATE INDEX idx_email_tracking_recipient 
  ON email_tracking(recipient_email);

CREATE INDEX idx_email_tracking_opened 
  ON email_tracking(user_id, is_opened, sent_at DESC);

CREATE INDEX idx_email_tracking_label 
  ON email_tracking(user_id, label_name) WHERE label_name IS NOT NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own tracking data
CREATE POLICY "Users can view own email_tracking"
  ON email_tracking FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own tracking records
CREATE POLICY "Users can insert own email_tracking"
  ON email_tracking FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tracking records
CREATE POLICY "Users can update own email_tracking"
  ON email_tracking FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (for Edge Function)
CREATE POLICY "Service role full access to email_tracking"
  ON email_tracking FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: Record Email Open (for Edge Function)
-- ============================================================================

CREATE OR REPLACE FUNCTION record_email_open_simple(
  p_tracking_id UUID,
  p_recipient_email_hash TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_country TEXT DEFAULT NULL,
  p_is_apple_mpp BOOLEAN DEFAULT false
)
RETURNS TABLE(
  success BOOLEAN,
  is_first_open BOOLEAN,
  open_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_first_open BOOLEAN := false;
  v_open_count INTEGER;
BEGIN
  -- Find and update the tracking record
  UPDATE email_tracking
  SET 
    is_opened = true,
    first_opened_at = COALESCE(first_opened_at, NOW()),
    last_opened_at = NOW(),
    open_count = open_count + 1,
    open_user_agent = COALESCE(p_user_agent, open_user_agent),
    open_ip_country = COALESCE(p_ip_country, open_ip_country),
    is_apple_mpp = p_is_apple_mpp OR is_apple_mpp,
    updated_at = NOW()
  WHERE tracking_id = p_tracking_id
    AND recipient_email_hash = p_recipient_email_hash
  RETURNING 
    (first_opened_at = NOW()), 
    email_tracking.open_count
  INTO v_is_first_open, v_open_count;
  
  -- If no row was updated, tracking record doesn't exist
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 0;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_is_first_open, v_open_count;
END;
$$;

COMMENT ON FUNCTION record_email_open_simple IS 'Records an email open event - called by tracking pixel Edge Function';

-- ============================================================================
-- FUNCTION: Get Email Open Stats for User
-- ============================================================================

CREATE OR REPLACE FUNCTION get_email_open_stats(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  total_sent BIGINT,
  total_opened BIGINT,
  open_rate NUMERIC,
  unique_recipients BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_sent,
    COUNT(*) FILTER (WHERE et.is_opened)::BIGINT as total_opened,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE et.is_opened)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END as open_rate,
    COUNT(DISTINCT et.recipient_email)::BIGINT as unique_recipients
  FROM email_tracking et
  WHERE et.user_id = p_user_id
    AND (p_start_date IS NULL OR et.sent_at >= p_start_date)
    AND (p_end_date IS NULL OR et.sent_at <= p_end_date);
END;
$$;

COMMENT ON FUNCTION get_email_open_stats IS 'Get aggregate email open statistics for a user';

-- ============================================================================
-- FUNCTION: Get Email Open Stats by Label
-- ============================================================================

CREATE OR REPLACE FUNCTION get_email_open_stats_by_label(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  label_name TEXT,
  total_sent BIGINT,
  total_opened BIGINT,
  open_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(et.label_name, 'No Label') as label_name,
    COUNT(*)::BIGINT as total_sent,
    COUNT(*) FILTER (WHERE et.is_opened)::BIGINT as total_opened,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE et.is_opened)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END as open_rate
  FROM email_tracking et
  WHERE et.user_id = p_user_id
    AND (p_start_date IS NULL OR et.sent_at >= p_start_date)
    AND (p_end_date IS NULL OR et.sent_at <= p_end_date)
  GROUP BY et.label_name
  ORDER BY total_sent DESC;
END;
$$;

COMMENT ON FUNCTION get_email_open_stats_by_label IS 'Get email open statistics grouped by label/campaign';
