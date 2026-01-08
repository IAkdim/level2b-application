-- Migration: Rollback sentiment persistence tables
-- Date: 2026-01-08
-- Description: Remove email_threads and email_messages tables created for sentiment persistence

-- Drop tables (cascade to remove foreign keys and dependencies)
DROP TABLE IF EXISTS public.email_messages CASCADE;
DROP TABLE IF EXISTS public.email_threads CASCADE;

-- Drop update trigger function if no other tables use it
-- (Skip this if other tables still need it)
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
