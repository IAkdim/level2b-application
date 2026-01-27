-- Migration: Email Tables Recreation + Open Tracking System
-- Date: 2026-01-21
-- Description: Recreates email tables with user_id ownership and adds email open tracking
--
-- NOTE: The original email_threads and email_messages tables were dropped when the
-- organizations table was dropped with CASCADE. This migration recreates them using
-- user_id for ownership, consistent with the user-centric data model.

-- ============================================================================
-- STEP 1: DROP OLD TABLES IF THEY EXIST (cleanup from cascade)
-- ============================================================================

DROP TABLE IF EXISTS public.email_open_events CASCADE;
DROP TABLE IF EXISTS public.email_messages CASCADE;
DROP TABLE IF EXISTS public.email_threads CASCADE;

-- ============================================================================
-- STEP 2: CREATE EMAIL_THREADS TABLE (with user_id instead of org_id)
-- ============================================================================

CREATE TABLE public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email provider details
  provider TEXT NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook', 'manual')),
  thread_id TEXT NOT NULL, -- External thread ID from provider
  
  -- Thread metadata
  subject TEXT,
  snippet TEXT, -- First few lines for preview
  
  -- Related lead (nullable - can be linked later)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Participants (array of email addresses)
  participants TEXT[] NOT NULL DEFAULT '{}',
  
  -- Labels/tags
  labels TEXT[] DEFAULT '{}',
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  
  -- Timestamps
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Prevent duplicate threads per user
  CONSTRAINT unique_thread_per_user UNIQUE(user_id, provider, thread_id)
);

COMMENT ON TABLE email_threads IS 'Email conversation threads - user-owned';

-- ============================================================================
-- STEP 3: CREATE EMAIL_MESSAGES TABLE (with user_id and open tracking columns)
-- ============================================================================

CREATE TABLE public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  
  -- Gmail/Email provider details
  message_id TEXT NOT NULL, -- External message ID
  
  -- Message details
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  
  subject TEXT,
  body_text TEXT, -- Plain text version
  body_html TEXT, -- HTML version
  
  -- Message metadata
  is_from_me BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,
  
  -- Sentiment analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'doubtful', 'not_interested')),
  sentiment_analyzed_at TIMESTAMPTZ,
  sentiment_confidence NUMERIC(3,2) CHECK (sentiment_confidence >= 0 AND sentiment_confidence <= 1),
  sentiment_reasoning TEXT,
  
  -- Open tracking columns (added directly to avoid ALTER TABLE)
  tracking_id UUID UNIQUE DEFAULT gen_random_uuid(),
  has_tracking BOOLEAN DEFAULT false,
  is_opened BOOLEAN DEFAULT false,
  first_opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Prevent duplicate messages per user
  CONSTRAINT unique_message_per_user UNIQUE(user_id, message_id)
);

COMMENT ON TABLE email_messages IS 'Individual email messages within threads - user-owned';

-- ============================================================================
-- STEP 4: CREATE EMAIL_OPEN_EVENTS TABLE
-- Stores deduplicated email open events (one record per recipient per email)
-- ============================================================================

CREATE TABLE public.email_open_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to sent email
  email_message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  
  -- Recipient tracking (hashed for privacy)
  recipient_email_hash TEXT NOT NULL,
  
  -- First open is what we count for open rate
  first_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Track total opens for analytics
  open_count INTEGER NOT NULL DEFAULT 1,
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata for analytics
  user_agent TEXT,
  ip_country TEXT,  -- Country derived from IP, not raw IP for privacy
  is_apple_mpp BOOLEAN DEFAULT false,  -- Flagged if from Apple Mail Privacy Protection
  
  -- User ownership for RLS
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each recipient can only have one open record per email
  CONSTRAINT unique_open_per_recipient UNIQUE(email_message_id, recipient_email_hash)
);

COMMENT ON TABLE email_open_events IS 'Tracking pixel open events with deduplication - user-owned';

-- ============================================================================
-- STEP 5: CREATE INDEXES FOR EMAIL_THREADS
-- ============================================================================

CREATE INDEX idx_email_threads_user_id 
  ON email_threads(user_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_threads_last_message 
  ON email_threads(last_message_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_threads_participants_gin 
  ON email_threads USING GIN(participants) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_threads_labels_gin 
  ON email_threads USING GIN(labels) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_threads_lead_id
  ON email_threads(lead_id) WHERE lead_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- STEP 6: CREATE INDEXES FOR EMAIL_MESSAGES
-- ============================================================================

CREATE INDEX idx_email_messages_user_id 
  ON email_messages(user_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_messages_thread_id 
  ON email_messages(thread_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_messages_from_email 
  ON email_messages(from_email) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_messages_sent_at 
  ON email_messages(sent_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_email_messages_sentiment 
  ON email_messages(sentiment) WHERE sentiment IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_email_messages_opened 
  ON email_messages(user_id, is_opened, sent_at DESC) 
  WHERE is_from_me = true AND deleted_at IS NULL;

CREATE INDEX idx_email_messages_tracking_id 
  ON email_messages(tracking_id) 
  WHERE tracking_id IS NOT NULL;

-- ============================================================================
-- STEP 7: CREATE INDEXES FOR EMAIL_OPEN_EVENTS
-- ============================================================================

CREATE INDEX idx_email_opens_message 
  ON email_open_events(email_message_id);

CREATE INDEX idx_email_opens_user_date 
  ON email_open_events(user_id, first_opened_at DESC);

CREATE INDEX idx_email_opens_date 
  ON email_open_events(first_opened_at DESC);

CREATE INDEX idx_email_opens_apple_mpp 
  ON email_open_events(user_id, is_apple_mpp) WHERE is_apple_mpp = true;

-- ============================================================================
-- STEP 8: CREATE updated_at TRIGGER FUNCTION IF NOT EXISTS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_open_events_updated_at
  BEFORE UPDATE ON email_open_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 9: TRIGGER TO UPDATE EMAIL_MESSAGES WHEN OPEN IS RECORDED
-- ============================================================================

CREATE OR REPLACE FUNCTION update_email_message_open_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_messages
  SET 
    is_opened = true,
    first_opened_at = COALESCE(first_opened_at, NEW.first_opened_at),
    open_count = COALESCE(open_count, 0) + 1,
    updated_at = NOW()
  WHERE id = NEW.email_message_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_message_on_open
  AFTER INSERT ON email_open_events
  FOR EACH ROW
  EXECUTE FUNCTION update_email_message_open_status();

-- ============================================================================
-- STEP 10: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_open_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 11: CREATE USER-ONLY RLS POLICIES FOR EMAIL_THREADS
-- ============================================================================

CREATE POLICY "Users can view own email_threads"
  ON email_threads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email_threads"
  ON email_threads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own email_threads"
  ON email_threads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own email_threads"
  ON email_threads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- STEP 12: CREATE USER-ONLY RLS POLICIES FOR EMAIL_MESSAGES
-- ============================================================================

CREATE POLICY "Users can view own email_messages"
  ON email_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email_messages"
  ON email_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own email_messages"
  ON email_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own email_messages"
  ON email_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- STEP 13: CREATE USER-ONLY RLS POLICIES FOR EMAIL_OPEN_EVENTS
-- ============================================================================

CREATE POLICY "Users can view own email_open_events"
  ON email_open_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email_open_events"
  ON email_open_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role can insert/update for tracking pixel (runs as service role)
CREATE POLICY "Service role can manage email_open_events"
  ON email_open_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 14: FUNCTION TO RECORD EMAIL OPEN (called by Edge Function)
-- Uses UPSERT for deduplication - only first open counts for open rate
-- ============================================================================

CREATE OR REPLACE FUNCTION record_email_open(
  p_tracking_id UUID,
  p_recipient_email_hash TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_country TEXT DEFAULT NULL,
  p_is_apple_mpp BOOLEAN DEFAULT false
)
RETURNS TABLE(
  success BOOLEAN,
  is_first_open BOOLEAN,
  message_id UUID,
  total_opens INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id UUID;
  v_user_id UUID;
  v_is_first_open BOOLEAN := false;
  v_total_opens INTEGER;
BEGIN
  -- Find the email message by tracking_id
  SELECT em.id, em.user_id, em.open_count
  INTO v_message_id, v_user_id, v_total_opens
  FROM email_messages em
  WHERE em.tracking_id = p_tracking_id
    AND em.has_tracking = true
    AND em.deleted_at IS NULL;
  
  -- If no message found, return failure
  IF v_message_id IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::UUID, 0;
    RETURN;
  END IF;
  
  -- Try to insert new open event (will be deduplicated by constraint)
  BEGIN
    INSERT INTO email_open_events (
      email_message_id,
      recipient_email_hash,
      user_agent,
      ip_country,
      is_apple_mpp,
      user_id
    ) VALUES (
      v_message_id,
      p_recipient_email_hash,
      p_user_agent,
      p_ip_country,
      p_is_apple_mpp,
      v_user_id
    );
    
    -- Insert succeeded - this is a first open for this recipient
    v_is_first_open := true;
    
  EXCEPTION WHEN unique_violation THEN
    -- Recipient already opened - just update the count
    UPDATE email_open_events
    SET 
      open_count = open_count + 1,
      last_opened_at = NOW(),
      updated_at = NOW()
    WHERE email_message_id = v_message_id 
      AND recipient_email_hash = p_recipient_email_hash;
    
    v_is_first_open := false;
  END;
  
  -- Get updated total opens
  SELECT open_count INTO v_total_opens
  FROM email_messages
  WHERE id = v_message_id;
  
  RETURN QUERY SELECT true, v_is_first_open, v_message_id, COALESCE(v_total_opens, 1);
END;
$$;

-- ============================================================================
-- STEP 15: FUNCTION TO GET OPEN RATE FOR A DATE RANGE
-- ============================================================================

CREATE OR REPLACE FUNCTION get_email_open_rate(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_exclude_apple_mpp BOOLEAN DEFAULT false
)
RETURNS TABLE(
  total_sent INTEGER,
  total_with_tracking INTEGER,
  total_opened INTEGER,
  open_rate NUMERIC(5,2),
  unique_recipients_opened INTEGER,
  total_opens INTEGER,  -- Includes multiple opens from same recipient
  apple_mpp_opens INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_sent,
    COUNT(*) FILTER (WHERE em.has_tracking = true)::INTEGER as total_with_tracking,
    COUNT(*) FILTER (WHERE em.is_opened = true AND em.has_tracking = true)::INTEGER as total_opened,
    CASE 
      WHEN COUNT(*) FILTER (WHERE em.has_tracking = true) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE em.is_opened = true AND em.has_tracking = true)::NUMERIC /
           COUNT(*) FILTER (WHERE em.has_tracking = true)::NUMERIC) * 100, 
          2
        )
      ELSE 0
    END as open_rate,
    (
      SELECT COUNT(DISTINCT eoe.recipient_email_hash)::INTEGER
      FROM email_open_events eoe
      JOIN email_messages em2 ON eoe.email_message_id = em2.id
      WHERE em2.user_id = p_user_id
        AND em2.is_from_me = true
        AND em2.deleted_at IS NULL
        AND (p_start_date IS NULL OR em2.sent_at::DATE >= p_start_date)
        AND (p_end_date IS NULL OR em2.sent_at::DATE <= p_end_date)
        AND (NOT p_exclude_apple_mpp OR eoe.is_apple_mpp = false)
    ) as unique_recipients_opened,
    (
      SELECT COALESCE(SUM(eoe.open_count), 0)::INTEGER
      FROM email_open_events eoe
      JOIN email_messages em2 ON eoe.email_message_id = em2.id
      WHERE em2.user_id = p_user_id
        AND em2.is_from_me = true
        AND em2.deleted_at IS NULL
        AND (p_start_date IS NULL OR em2.sent_at::DATE >= p_start_date)
        AND (p_end_date IS NULL OR em2.sent_at::DATE <= p_end_date)
    ) as total_opens,
    (
      SELECT COUNT(*)::INTEGER
      FROM email_open_events eoe
      JOIN email_messages em2 ON eoe.email_message_id = em2.id
      WHERE em2.user_id = p_user_id
        AND em2.is_from_me = true
        AND em2.deleted_at IS NULL
        AND eoe.is_apple_mpp = true
        AND (p_start_date IS NULL OR em2.sent_at::DATE >= p_start_date)
        AND (p_end_date IS NULL OR em2.sent_at::DATE <= p_end_date)
    ) as apple_mpp_opens
  FROM email_messages em
  WHERE em.user_id = p_user_id
    AND em.is_from_me = true
    AND em.deleted_at IS NULL
    AND (p_start_date IS NULL OR em.sent_at::DATE >= p_start_date)
    AND (p_end_date IS NULL OR em.sent_at::DATE <= p_end_date);
END;
$$;

-- ============================================================================
-- STEP 16: FUNCTION TO GET CAMPAIGN/TEMPLATE OPEN RATES
-- Group by subject or label for campaign-level analytics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_campaign_open_rates(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_group_by TEXT DEFAULT 'subject'  -- 'subject' or 'label'
)
RETURNS TABLE(
  campaign_name TEXT,
  total_sent INTEGER,
  total_opened INTEGER,
  open_rate NUMERIC(5,2),
  first_sent_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_group_by = 'label' THEN
    -- Group by first label (thread label)
    RETURN QUERY
    SELECT 
      COALESCE(et.labels[1], 'Unlabeled') as campaign_name,
      COUNT(*)::INTEGER as total_sent,
      COUNT(*) FILTER (WHERE em.is_opened = true)::INTEGER as total_opened,
      CASE 
        WHEN COUNT(*) FILTER (WHERE em.has_tracking = true) > 0 THEN
          ROUND(
            (COUNT(*) FILTER (WHERE em.is_opened = true)::NUMERIC /
             COUNT(*) FILTER (WHERE em.has_tracking = true)::NUMERIC) * 100, 
            2
          )
        ELSE 0
      END as open_rate,
      MIN(em.sent_at) as first_sent_at,
      MAX(em.sent_at) as last_sent_at
    FROM email_messages em
    LEFT JOIN email_threads et ON em.thread_id = et.id
    WHERE em.user_id = p_user_id
      AND em.is_from_me = true
      AND em.deleted_at IS NULL
      AND (p_start_date IS NULL OR em.sent_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR em.sent_at::DATE <= p_end_date)
    GROUP BY et.labels[1]
    ORDER BY total_sent DESC;
  ELSE
    -- Default: Group by subject
    RETURN QUERY
    SELECT 
      COALESCE(em.subject, 'No Subject') as campaign_name,
      COUNT(*)::INTEGER as total_sent,
      COUNT(*) FILTER (WHERE em.is_opened = true)::INTEGER as total_opened,
      CASE 
        WHEN COUNT(*) FILTER (WHERE em.has_tracking = true) > 0 THEN
          ROUND(
            (COUNT(*) FILTER (WHERE em.is_opened = true)::NUMERIC /
             COUNT(*) FILTER (WHERE em.has_tracking = true)::NUMERIC) * 100, 
            2
          )
        ELSE 0
      END as open_rate,
      MIN(em.sent_at) as first_sent_at,
      MAX(em.sent_at) as last_sent_at
    FROM email_messages em
    WHERE em.user_id = p_user_id
      AND em.is_from_me = true
      AND em.deleted_at IS NULL
      AND (p_start_date IS NULL OR em.sent_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR em.sent_at::DATE <= p_end_date)
    GROUP BY em.subject
    ORDER BY total_sent DESC;
  END IF;
END;
$$;

-- ============================================================================
-- STEP 17: ENHANCED ANALYTICS SUMMARY FUNCTION (includes open rate)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_analytics_summary_with_opens(
  p_user_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  emails_sent BIGINT,
  emails_received BIGINT,
  open_rate NUMERIC(5,2),
  total_opened INTEGER,
  total_with_tracking INTEGER,
  templates_generated BIGINT,
  new_leads BIGINT,
  meetings_scheduled BIGINT,
  tasks_completed BIGINT,
  notes_created BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Email stats from email_messages
    (SELECT COUNT(*) FROM email_messages 
      WHERE user_id = p_user_id 
      AND is_from_me = true 
      AND sent_at::DATE BETWEEN p_start_date AND p_end_date 
      AND deleted_at IS NULL)::BIGINT as emails_sent,
    
    (SELECT COUNT(*) FROM email_messages 
      WHERE user_id = p_user_id 
      AND is_from_me = false 
      AND received_at::DATE BETWEEN p_start_date AND p_end_date 
      AND deleted_at IS NULL)::BIGINT as emails_received,
    
    -- Open rate calculation
    COALESCE(
      (SELECT 
        CASE 
          WHEN COUNT(*) FILTER (WHERE has_tracking = true) > 0 THEN
            ROUND(
              (COUNT(*) FILTER (WHERE is_opened = true AND has_tracking = true)::NUMERIC /
               COUNT(*) FILTER (WHERE has_tracking = true)::NUMERIC) * 100, 
              2
            )
          ELSE 0
        END
       FROM email_messages
       WHERE user_id = p_user_id
         AND is_from_me = true
         AND sent_at::DATE BETWEEN p_start_date AND p_end_date
         AND deleted_at IS NULL
      ), 0
    ) as open_rate,
    
    -- Total opened emails
    (SELECT COUNT(*) FILTER (WHERE is_opened = true AND has_tracking = true)
     FROM email_messages
     WHERE user_id = p_user_id
       AND is_from_me = true
       AND sent_at::DATE BETWEEN p_start_date AND p_end_date
       AND deleted_at IS NULL)::INTEGER as total_opened,
    
    -- Total with tracking
    (SELECT COUNT(*) FILTER (WHERE has_tracking = true)
     FROM email_messages
     WHERE user_id = p_user_id
       AND is_from_me = true
       AND sent_at::DATE BETWEEN p_start_date AND p_end_date
       AND deleted_at IS NULL)::INTEGER as total_with_tracking,
    
    -- Templates generated
    (SELECT COUNT(*) FROM email_templates 
      WHERE user_id = p_user_id 
      AND created_at::DATE BETWEEN p_start_date AND p_end_date 
      AND deleted_at IS NULL)::BIGINT as templates_generated,
    
    -- New leads created
    (SELECT COUNT(*) FROM leads 
      WHERE user_id = p_user_id 
      AND created_at::DATE BETWEEN p_start_date AND p_end_date 
      AND deleted_at IS NULL)::BIGINT as new_leads,
    
    -- Meetings scheduled (from calendly_meetings)
    (SELECT COUNT(*) FROM calendly_meetings 
      WHERE user_id = p_user_id 
      AND created_at::DATE BETWEEN p_start_date AND p_end_date)::BIGINT as meetings_scheduled,
    
    -- Tasks completed
    (SELECT COUNT(*) FROM tasks 
      WHERE user_id = p_user_id 
      AND completed_at IS NOT NULL 
      AND completed_at::DATE BETWEEN p_start_date AND p_end_date 
      AND deleted_at IS NULL)::BIGINT as tasks_completed,
    
    -- Notes created
    (SELECT COUNT(*) FROM notes 
      WHERE user_id = p_user_id 
      AND created_at::DATE BETWEEN p_start_date AND p_end_date 
      AND deleted_at IS NULL)::BIGINT as notes_created;
END;
$$;

-- ============================================================================
-- STEP 18: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_email_open_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_open_rates TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_summary_with_opens TO authenticated;

-- Service role needs to call record_email_open from Edge Function
GRANT EXECUTE ON FUNCTION record_email_open TO service_role;

-- ============================================================================
-- STEP 19: ADD TABLE COMMENTS
-- ============================================================================

COMMENT ON COLUMN email_messages.tracking_id IS 'Unique ID used in tracking pixel URL';
COMMENT ON COLUMN email_messages.has_tracking IS 'Whether this email has a tracking pixel embedded';
COMMENT ON COLUMN email_messages.is_opened IS 'Cached: whether this email has been opened at least once';
COMMENT ON COLUMN email_messages.first_opened_at IS 'Cached: timestamp of first open';
COMMENT ON COLUMN email_messages.open_count IS 'Cached: total number of opens (including duplicates)';

COMMENT ON COLUMN email_open_events.recipient_email_hash IS 'SHA-256 hash of recipient email + message_id for privacy';
COMMENT ON COLUMN email_open_events.is_apple_mpp IS 'True if detected as Apple Mail Privacy Protection pre-fetch';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
