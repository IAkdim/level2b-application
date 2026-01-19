-- Migration: Add company/business settings columns to user_settings table
-- These columns are needed for email generation and template functionality

-- ============================================================================
-- STEP 1: Add company/business columns
-- ============================================================================

-- Company name
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Company description
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS company_description TEXT;

-- Product or service description
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS product_service TEXT;

-- Unique selling points (stored as JSONB array)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS unique_selling_points JSONB DEFAULT '[]'::jsonb;

-- Target audience
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS target_audience TEXT;

-- Industry
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS industry TEXT;

-- ============================================================================
-- STEP 2: Add Calendly integration columns
-- ============================================================================

-- Calendly access token (encrypted in production)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendly_access_token TEXT;

-- Calendly refresh token (encrypted in production)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendly_refresh_token TEXT;

-- Calendly event type URI
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendly_event_type_uri TEXT;

-- Calendly scheduling URL (public link for meeting invitations)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendly_scheduling_url TEXT;

-- Calendly event type name
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendly_event_type_name TEXT;

-- ============================================================================
-- STEP 3: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN user_settings.company_name IS 'User company name for email templates';
COMMENT ON COLUMN user_settings.company_description IS 'Description of the company';
COMMENT ON COLUMN user_settings.product_service IS 'Product or service being offered';
COMMENT ON COLUMN user_settings.unique_selling_points IS 'Array of unique selling points';
COMMENT ON COLUMN user_settings.target_audience IS 'Target audience description';
COMMENT ON COLUMN user_settings.industry IS 'Industry/sector of the company';
COMMENT ON COLUMN user_settings.calendly_scheduling_url IS 'Public Calendly link for meeting bookings';
