-- Migration: Convert source from TEXT to TEXT[] for tag support
-- This allows leads to have multiple sources (e.g., both "LinkedIn" and "Referral")

-- Step 1: Add new array column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing data
-- Convert single source values to single-element arrays
UPDATE leads
SET sources = CASE
  WHEN source IS NOT NULL AND source != '' THEN ARRAY[source]
  ELSE '{}'::TEXT[]
END
WHERE sources = '{}'::TEXT[] OR sources IS NULL;

-- Step 3: Drop old column
ALTER TABLE leads DROP COLUMN IF EXISTS source;

-- Step 4: Rename new column to replace old one
ALTER TABLE leads RENAME COLUMN sources TO source;

-- Step 5: Add GIN index for efficient array searches
-- GIN (Generalized Inverted Index) is perfect for array contains operations
CREATE INDEX IF NOT EXISTS idx_leads_source_gin ON leads USING GIN (source);

-- Step 6: Add helper function to get all unique sources across organization
CREATE OR REPLACE FUNCTION get_org_sources(org_uuid UUID)
RETURNS TABLE(source_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT unnest(source) as source_name
  FROM leads
  WHERE org_id = org_uuid
    AND source IS NOT NULL
    AND array_length(source, 1) > 0
  ORDER BY source_name;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON COLUMN leads.source IS 'Array of source tags (e.g., ["LinkedIn", "Referral", "Conference"])';
COMMENT ON FUNCTION get_org_sources IS 'Returns all unique source tags used in an organization for autocomplete';
