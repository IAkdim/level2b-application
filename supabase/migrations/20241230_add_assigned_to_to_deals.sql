-- Add assigned_to column to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);

-- Update RLS policies if needed (deals should already have org-based RLS)
