-- Migration: Fix email_threads lead_id constraint
-- Date: 2026-01-08
-- Description: Make lead_id nullable and drop foreign key if leads table doesn't exist

-- Drop foreign key constraint if it exists
DO $$ 
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%email_threads%lead%'
    AND table_name = 'email_threads'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.email_threads DROP CONSTRAINT ' || constraint_name || ';'
      FROM information_schema.table_constraints 
      WHERE constraint_name LIKE '%email_threads%lead%'
      AND table_name = 'email_threads'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1
    );
    
    RAISE NOTICE 'Dropped foreign key constraint on lead_id';
  END IF;
END $$;

-- Make sure lead_id is nullable
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_threads' 
    AND column_name = 'lead_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.email_threads 
    ALTER COLUMN lead_id DROP NOT NULL;
    
    RAISE NOTICE 'Made lead_id nullable in email_threads';
  END IF;
END $$;

-- If leads table exists in the future, recreate the constraint with:
-- ALTER TABLE public.email_threads 
-- ADD CONSTRAINT email_threads_lead_id_fkey 
-- FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
