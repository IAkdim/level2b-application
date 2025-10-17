-- Level2B CRM Tables Migration
-- Creates all necessary tables for CRM functionality with Row Level Security

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- LEADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact Information
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    title TEXT, -- Job title

    -- Status & Tracking
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'meeting_scheduled', 'closed', 'lost')),
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    source TEXT, -- Where did this lead come from? (import, manual, form, etc.)

    -- Additional Data
    notes TEXT,
    metadata JSONB DEFAULT '{}', -- Flexible field for custom data

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(org_id, email) -- Prevent duplicate emails within an org
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
DROP POLICY IF EXISTS "Users can view leads in their organization" ON leads;
CREATE POLICY "Users can view leads in their organization"
    ON leads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = leads.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert leads in their organization" ON leads;
CREATE POLICY "Users can insert leads in their organization"
    ON leads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = leads.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update leads in their organization" ON leads;
CREATE POLICY "Users can update leads in their organization"
    ON leads FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = leads.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete leads in their organization" ON leads;
CREATE POLICY "Users can delete leads in their organization"
    ON leads FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = leads.org_id
            AND uo.user_id = auth.uid()
        )
    );

-- ============================================================================
-- ACTIVITIES TABLE (Timeline/History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Activity Details
    type TEXT NOT NULL CHECK (type IN ('email', 'call', 'meeting', 'note', 'status_change', 'task')),
    subject TEXT,
    content TEXT,

    -- Metadata (flexible JSON for type-specific data)
    metadata JSONB DEFAULT '{}', -- e.g., { "duration": 30, "outcome": "positive" } for calls

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- For scheduled activities
    scheduled_at TIMESTAMPTZ
);

-- Indexes for efficient timeline queries
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_id ON activities(org_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);

-- Enable RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities
DROP POLICY IF EXISTS "Users can view activities in their organization" ON activities;
CREATE POLICY "Users can view activities in their organization"
    ON activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = activities.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert activities in their organization" ON activities;
CREATE POLICY "Users can insert activities in their organization"
    ON activities FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = activities.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
CREATE POLICY "Users can update their own activities"
    ON activities FOR UPDATE
    USING (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = activities.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own activities" ON activities;
CREATE POLICY "Users can delete their own activities"
    ON activities FOR DELETE
    USING (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = activities.org_id
            AND uo.user_id = auth.uid()
        )
    );

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE, -- Optional: task can be lead-specific

    -- Task Details
    title TEXT NOT NULL,
    description TEXT,

    -- Status & Priority
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),

    -- Timestamps
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON tasks;
CREATE POLICY "Users can view tasks in their organization"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = tasks.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert tasks in their organization" ON tasks;
CREATE POLICY "Users can insert tasks in their organization"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = tasks.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update tasks in their organization" ON tasks;
CREATE POLICY "Users can update tasks in their organization"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = tasks.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete tasks in their organization" ON tasks;
CREATE POLICY "Users can delete tasks in their organization"
    ON tasks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = tasks.org_id
            AND uo.user_id = auth.uid()
        )
    );

-- ============================================================================
-- NOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Note Content
    content TEXT NOT NULL,

    -- Metadata
    is_pinned BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_notes_org_id ON notes(org_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes
DROP POLICY IF EXISTS "Users can view notes in their organization" ON notes;
CREATE POLICY "Users can view notes in their organization"
    ON notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = notes.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert notes in their organization" ON notes;
CREATE POLICY "Users can insert notes in their organization"
    ON notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = notes.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
CREATE POLICY "Users can update their own notes"
    ON notes FOR UPDATE
    USING (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = notes.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
CREATE POLICY "Users can delete their own notes"
    ON notes FOR DELETE
    USING (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = notes.org_id
            AND uo.user_id = auth.uid()
        )
    );

-- ============================================================================
-- DEALS TABLE (Sales Pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Deal Information
    title TEXT NOT NULL,
    value DECIMAL(12, 2), -- Deal value in currency
    currency TEXT DEFAULT 'EUR',

    -- Pipeline Stage
    stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    probability INTEGER CHECK (probability >= 0 AND probability <= 100), -- Win probability percentage

    -- Dates
    expected_close_date DATE,
    actual_close_date DATE,

    -- Additional Info
    notes TEXT,
    lost_reason TEXT, -- Why was it lost?

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON deals(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);

-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deals
DROP POLICY IF EXISTS "Users can view deals in their organization" ON deals;
CREATE POLICY "Users can view deals in their organization"
    ON deals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = deals.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert deals in their organization" ON deals;
CREATE POLICY "Users can insert deals in their organization"
    ON deals FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = deals.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update deals in their organization" ON deals;
CREATE POLICY "Users can update deals in their organization"
    ON deals FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = deals.org_id
            AND uo.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete deals in their organization" ON deals;
CREATE POLICY "Users can delete deals in their organization"
    ON deals FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_orgs uo
            WHERE uo.org_id = deals.org_id
            AND uo.user_id = auth.uid()
        )
    );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER TO AUTO-CREATE ACTIVITY ON LEAD STATUS CHANGE
-- ============================================================================

CREATE OR REPLACE FUNCTION create_status_change_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO activities (org_id, lead_id, type, subject, content, created_by, metadata)
        VALUES (
            NEW.org_id,
            NEW.id,
            'status_change',
            'Status changed',
            'Status changed from ' || OLD.status || ' to ' || NEW.status,
            auth.uid(),
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_status_change_activity ON leads;
CREATE TRIGGER lead_status_change_activity AFTER UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION create_status_change_activity();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE leads IS 'Stores all contact/lead information for CRM';
COMMENT ON TABLE activities IS 'Activity timeline - tracks all interactions with leads';
COMMENT ON TABLE tasks IS 'Task management - follow-ups and to-dos';
COMMENT ON TABLE notes IS 'Internal notes and comments on leads';
COMMENT ON TABLE deals IS 'Sales pipeline - tracks opportunities and deals';
