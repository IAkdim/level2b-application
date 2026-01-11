-- Migration: Add sentiment tracking to email_messages
-- Date: 2026-01-08
-- Description: Add sentiment and sentiment_analyzed_at columns for persistent sentiment storage

-- Add sentiment column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_messages' 
    AND column_name = 'sentiment'
  ) THEN
    ALTER TABLE public.email_messages 
    ADD COLUMN sentiment TEXT CHECK (sentiment IN ('positive', 'doubtful', 'not_interested'));
    
    RAISE NOTICE 'Added sentiment column to email_messages';
  END IF;
END $$;

-- Add sentiment_analyzed_at timestamp
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_messages' 
    AND column_name = 'sentiment_analyzed_at'
  ) THEN
    ALTER TABLE public.email_messages 
    ADD COLUMN sentiment_analyzed_at TIMESTAMPTZ;
    
    RAISE NOTICE 'Added sentiment_analyzed_at column to email_messages';
  END IF;
END $$;

-- Add sentiment_confidence column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_messages' 
    AND column_name = 'sentiment_confidence'
  ) THEN
    ALTER TABLE public.email_messages 
    ADD COLUMN sentiment_confidence NUMERIC(3,2) CHECK (sentiment_confidence >= 0 AND sentiment_confidence <= 1);
    
    RAISE NOTICE 'Added sentiment_confidence column to email_messages';
  END IF;
END $$;

-- Add sentiment_reasoning column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_messages' 
    AND column_name = 'sentiment_reasoning'
  ) THEN
    ALTER TABLE public.email_messages 
    ADD COLUMN sentiment_reasoning TEXT;
    
    RAISE NOTICE 'Added sentiment_reasoning column to email_messages';
  END IF;
END $$;

-- Create index on sentiment for faster filtering
CREATE INDEX IF NOT EXISTS idx_email_messages_sentiment 
ON public.email_messages(sentiment) 
WHERE sentiment IS NOT NULL AND deleted_at IS NULL;

-- Create index on sentiment_analyzed_at
CREATE INDEX IF NOT EXISTS idx_email_messages_sentiment_analyzed_at 
ON public.email_messages(sentiment_analyzed_at DESC) 
WHERE sentiment_analyzed_at IS NOT NULL AND deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN public.email_messages.sentiment IS 'AI-analyzed sentiment: positive (interested), doubtful (uncertain), not_interested (rejected)';
COMMENT ON COLUMN public.email_messages.sentiment_analyzed_at IS 'Timestamp when sentiment was last analyzed';
COMMENT ON COLUMN public.email_messages.sentiment_confidence IS 'Confidence score of sentiment analysis (0.0 to 1.0)';
COMMENT ON COLUMN public.email_messages.sentiment_reasoning IS 'AI reasoning for sentiment classification';
