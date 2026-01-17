-- Migration: Create email_threads and email_messages tables
-- Date: 2026-01-08
-- Description: Create tables for email tracking with sentiment analysis support

-- Create email_threads table
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Email provider details
  provider TEXT NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook', 'manual')),
  thread_id TEXT NOT NULL, -- External thread ID from provider
  
  -- Thread metadata
  subject TEXT,
  snippet TEXT, -- First few lines for preview
  
  -- Related lead (nullable - can be linked later when leads table exists)
  lead_id UUID, -- No foreign key constraint for now
  
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
  
  -- Prevent duplicate threads per org
  CONSTRAINT unique_thread_per_org UNIQUE(org_id, provider, thread_id)
);

-- Create email_messages table
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
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
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Prevent duplicate messages per org
  CONSTRAINT unique_message_per_org UNIQUE(org_id, message_id)
);

-- Create indexes for email_threads
CREATE INDEX IF NOT EXISTS idx_email_threads_org_id 
  ON email_threads(org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_threads_last_message 
  ON email_threads(last_message_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_threads_participants_gin 
  ON email_threads USING GIN(participants) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_threads_labels_gin 
  ON email_threads USING GIN(labels) WHERE deleted_at IS NULL;

-- Create indexes for email_messages
CREATE INDEX IF NOT EXISTS idx_email_messages_org_id 
  ON email_messages(org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id 
  ON email_messages(thread_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_from_email 
  ON email_messages(from_email) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at 
  ON email_messages(sent_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_sentiment 
  ON email_messages(sentiment) WHERE sentiment IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_sentiment_analyzed_at 
  ON email_messages(sentiment_analyzed_at DESC) WHERE sentiment_analyzed_at IS NOT NULL AND deleted_at IS NULL;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_email_threads_updated_at ON email_threads;
CREATE TRIGGER update_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_messages_updated_at ON email_messages;
CREATE TRIGGER update_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_threads
DROP POLICY IF EXISTS "Users can view email_threads in their organizations" ON email_threads;
CREATE POLICY "Users can view email_threads in their organizations" 
  ON email_threads FOR SELECT 
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert email_threads in their organizations" ON email_threads;
CREATE POLICY "Users can insert email_threads in their organizations" 
  ON email_threads FOR INSERT 
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update email_threads in their organizations" ON email_threads;
CREATE POLICY "Users can update email_threads in their organizations" 
  ON email_threads FOR UPDATE 
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- RLS Policies for email_messages
DROP POLICY IF EXISTS "Users can view email_messages in their organizations" ON email_messages;
CREATE POLICY "Users can view email_messages in their organizations" 
  ON email_messages FOR SELECT 
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert email_messages in their organizations" ON email_messages;
CREATE POLICY "Users can insert email_messages in their organizations" 
  ON email_messages FOR INSERT 
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update email_messages in their organizations" ON email_messages;
CREATE POLICY "Users can update email_messages in their organizations" 
  ON email_messages FOR UPDATE 
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
