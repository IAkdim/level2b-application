-- Add language support to leads and templates
-- Migration: 20251218_add_language_support.sql

-- Add language column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' CHECK (language IN ('en', 'nl', 'de', 'fr', 'es', 'it', 'pt'));

-- Add language column to email_templates table
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' CHECK (language IN ('en', 'nl', 'de', 'fr', 'es', 'it', 'pt'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_language ON leads(language);
CREATE INDEX IF NOT EXISTS idx_email_templates_language ON email_templates(language);

-- Comment on columns
COMMENT ON COLUMN leads.language IS 'Language code for outreach (en, nl, de, fr, es, it, pt)';
COMMENT ON COLUMN email_templates.language IS 'Language the template is written in';
