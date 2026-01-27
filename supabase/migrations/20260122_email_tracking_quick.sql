-- Quick Email Tracking Setup
-- Run this in Supabase SQL Editor to enable email open tracking

-- Drop and recreate for clean slate
DROP TABLE IF EXISTS public.email_tracking CASCADE;

-- Create the email_tracking table
CREATE TABLE public.email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_id UUID NOT NULL UNIQUE,
  gmail_message_id TEXT,
  recipient_email TEXT NOT NULL,
  recipient_email_hash TEXT NOT NULL,
  subject TEXT,
  label_name TEXT,
  is_opened BOOLEAN DEFAULT false,
  first_opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  open_user_agent TEXT,
  open_ip_country TEXT,
  is_apple_mpp BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_email_tracking_user_id ON email_tracking(user_id);
CREATE INDEX idx_email_tracking_tracking_id ON email_tracking(tracking_id);
CREATE INDEX idx_email_tracking_gmail ON email_tracking(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE INDEX idx_email_tracking_opened ON email_tracking(user_id, is_opened);

-- Enable RLS
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own email_tracking"
  ON email_tracking FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email_tracking"
  ON email_tracking FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own email_tracking"
  ON email_tracking FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Service role full access (for Edge Function)
CREATE POLICY "Service role full access"
  ON email_tracking FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Success message
DO $$ BEGIN RAISE NOTICE 'email_tracking table created successfully!'; END $$;
