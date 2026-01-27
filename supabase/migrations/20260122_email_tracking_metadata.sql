-- Migration: Create email_tracking_metadata table (user-centric, minimal tracking)
-- Date: 2026-01-22
-- Description: Lightweight email tracking table that stores only IDs (thread_id, message_id)
--              instead of full email content. GDPR-compliant, on-demand fetching strategy.

CREATE TABLE IF NOT EXISTS public.email_tracking_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Provider-specific IDs (not stored content)
  thread_id TEXT NOT NULL,  -- Gmail threadId / Outlook conversationId
  message_id TEXT NOT NULL, -- Provider's unique message ID
  provider TEXT NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook')),

  -- Minimal metadata
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label TEXT, -- Gmail label or Outlook category used for tracking

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate messages per user per provider
  CONSTRAINT unique_message_per_user_provider UNIQUE(user_id, provider, message_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_tracking_user_id
  ON email_tracking_metadata(user_id);

CREATE INDEX IF NOT EXISTS idx_email_tracking_lead_id
  ON email_tracking_metadata(lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_tracking_thread_id
  ON email_tracking_metadata(thread_id);

CREATE INDEX IF NOT EXISTS idx_email_tracking_sent_at
  ON email_tracking_metadata(sent_at DESC);

-- Enable Row Level Security
ALTER TABLE email_tracking_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies (user-centric)
DROP POLICY IF EXISTS "Users can view own email tracking" ON email_tracking_metadata;
CREATE POLICY "Users can view own email tracking"
  ON email_tracking_metadata FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own email tracking" ON email_tracking_metadata;
CREATE POLICY "Users can insert own email tracking"
  ON email_tracking_metadata FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own email tracking" ON email_tracking_metadata;
CREATE POLICY "Users can delete own email tracking"
  ON email_tracking_metadata FOR DELETE
  USING (user_id = auth.uid());
