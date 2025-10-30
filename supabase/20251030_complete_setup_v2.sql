-- ============================================================================
-- COMPLETE LEVEL2B DATABASE SETUP V2
-- Multi-tenant CRM with proper RLS policies (no recursion)
-- Updated: 2025-10-30
-- Changes from V1: source as TEXT[], activities enhancements, helper functions
-- Run this on a fresh database to set everything up
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 1: FOUNDATION TABLES
-- ============================================================================

-- PUBLIC USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- USER_ORGS TABLE (Junction/Membership)
CREATE TABLE IF NOT EXISTS public.user_orgs (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_orgs_user_id ON public.user_orgs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org_id ON public.user_orgs(org_id);

-- ============================================================================
-- PART 2: CRM TABLES
-- ============================================================================

-- LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'meeting_scheduled', 'closed', 'lost')),
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    source TEXT[] DEFAULT '{}', -- Array of source tags (e.g., ["LinkedIn", "Referral"])
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ,
    UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source_gin ON leads USING GIN (source); -- GIN index for array searches

-- ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('email', 'call', 'meeting', 'note', 'status_change', 'task')),
    subject TEXT,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    scheduled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_id ON activities(org_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);
CREATE INDEX IF NOT EXISTS idx_activities_scheduled_at ON activities(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_org_created ON activities(org_id, created_at DESC);

-- TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES auth.users(id),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- NOTES TABLE
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_notes_org_id ON notes(org_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- DEALS TABLE
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    value DECIMAL(12, 2),
    currency TEXT DEFAULT 'EUR',
    stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    probability INTEGER CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,
    notes TEXT,
    lost_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_org_id ON deals(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY - FOUNDATION TABLES
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_orgs ENABLE ROW LEVEL SECURITY;

-- USERS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- USER_ORGS policies (simple, no recursion)
DROP POLICY IF EXISTS "user_orgs_select_own" ON public.user_orgs;
CREATE POLICY "user_orgs_select_own"
    ON public.user_orgs FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_orgs_insert" ON public.user_orgs;
CREATE POLICY "user_orgs_insert"
    ON public.user_orgs FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR
        NOT EXISTS (
            SELECT 1 FROM public.user_orgs
            WHERE org_id = user_orgs.org_id
            LIMIT 1
        )
    );

DROP POLICY IF EXISTS "user_orgs_delete_own" ON public.user_orgs;
CREATE POLICY "user_orgs_delete_own"
    ON public.user_orgs FOR DELETE
    USING (user_id = auth.uid());

-- ORGANIZATIONS policies
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select"
    ON public.organizations FOR SELECT
    USING (
        id IN (
            SELECT org_id FROM public.user_orgs
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update"
    ON public.organizations FOR UPDATE
    USING (
        id IN (
            SELECT org_id FROM public.user_orgs
            WHERE user_id = auth.uid()
            AND role = 'owner'
        )
    );

DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
CREATE POLICY "organizations_insert"
    ON public.organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 4: ROW LEVEL SECURITY - CRM TABLES
-- ============================================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- LEADS policies
DROP POLICY IF EXISTS "leads_select" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "leads_insert" ON leads;
CREATE POLICY "leads_insert" ON leads FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "leads_update" ON leads;
CREATE POLICY "leads_update" ON leads FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "leads_delete" ON leads;
CREATE POLICY "leads_delete" ON leads FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ACTIVITIES policies
DROP POLICY IF EXISTS "activities_select" ON activities;
CREATE POLICY "activities_select" ON activities FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert" ON activities FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "activities_update" ON activities;
CREATE POLICY "activities_update" ON activities FOR UPDATE
    USING (created_by = auth.uid() AND org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "activities_delete" ON activities;
CREATE POLICY "activities_delete" ON activities FOR DELETE
    USING (created_by = auth.uid() AND org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- TASKS policies
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- NOTES policies
DROP POLICY IF EXISTS "notes_select" ON notes;
CREATE POLICY "notes_select" ON notes FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "notes_insert" ON notes;
CREATE POLICY "notes_insert" ON notes FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "notes_update" ON notes;
CREATE POLICY "notes_update" ON notes FOR UPDATE
    USING (created_by = auth.uid() AND org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "notes_delete" ON notes;
CREATE POLICY "notes_delete" ON notes FOR DELETE
    USING (created_by = auth.uid() AND org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- DEALS policies
DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select" ON deals FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deals_insert" ON deals;
CREATE POLICY "deals_insert" ON deals FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deals_update" ON deals;
CREATE POLICY "deals_update" ON deals FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "deals_delete" ON deals;
CREATE POLICY "deals_delete" ON deals FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ============================================================================
-- PART 5: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_updated_at trigger to all relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

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

-- Function to auto-create activity on lead status change
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

-- Function to auto-create public user on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_full_name TEXT;
    user_avatar TEXT;
    new_org_id UUID;
    default_org_name TEXT;
BEGIN
    -- Extract name and avatar from raw_user_meta_data
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

    user_avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture'
    );

    -- Create public.users record
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        user_avatar
    );

    -- Auto-create a default organization for the new user
    default_org_name := user_full_name || '''s Organization';

    INSERT INTO public.organizations (name)
    VALUES (default_org_name)
    RETURNING id INTO new_org_id;

    -- Add user as owner of their default organization
    INSERT INTO public.user_orgs (user_id, org_id, role)
    VALUES (NEW.id, new_org_id, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to create organization with owner (used by app)
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    org_name TEXT,
    org_slug TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_org_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Create organization
    INSERT INTO public.organizations (name, slug)
    VALUES (org_name, org_slug)
    RETURNING id INTO new_org_id;

    -- Add creator as owner
    INSERT INTO public.user_orgs (user_id, org_id, role)
    VALUES (current_user_id, new_org_id, 'owner');

    RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT) TO authenticated;

-- Function to join organization by ID
CREATE OR REPLACE FUNCTION public.join_organization(
    org_id_to_join UUID,
    join_as_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if organization exists
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id_to_join) THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM public.user_orgs
        WHERE user_id = current_user_id AND org_id = org_id_to_join
    ) THEN
        RAISE EXCEPTION 'Already a member of this organization';
    END IF;

    -- Add user to organization
    INSERT INTO public.user_orgs (user_id, org_id, role)
    VALUES (current_user_id, org_id_to_join, join_as_role);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.join_organization(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 6: HELPER FUNCTIONS FOR LEADS
-- ============================================================================

-- Helper function to get all unique sources across organization
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_org_sources(UUID) TO authenticated;

-- ============================================================================
-- PART 7: HELPER FUNCTIONS FOR ACTIVITIES
-- ============================================================================

-- Function to get recent activities across organization with lead information
-- Used for org-wide activity feed
CREATE OR REPLACE FUNCTION get_recent_org_activities(
    org_uuid UUID,
    activity_limit INTEGER DEFAULT 50,
    activity_types TEXT[] DEFAULT NULL,
    user_filter UUID DEFAULT NULL,
    date_from TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    activity_id UUID,
    activity_type TEXT,
    activity_subject TEXT,
    activity_content TEXT,
    activity_created_at TIMESTAMPTZ,
    activity_scheduled_at TIMESTAMPTZ,
    lead_id UUID,
    lead_name TEXT,
    lead_email TEXT,
    lead_company TEXT,
    creator_id UUID,
    creator_name TEXT,
    creator_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.type,
        a.subject,
        a.content,
        a.created_at,
        a.scheduled_at,
        l.id,
        l.name,
        l.email,
        l.company,
        u.id,
        u.full_name,
        u.email
    FROM activities a
    INNER JOIN leads l ON a.lead_id = l.id
    LEFT JOIN public.users u ON a.created_by = u.id
    WHERE a.org_id = org_uuid
        AND (activity_types IS NULL OR a.type = ANY(activity_types))
        AND (user_filter IS NULL OR a.created_by = user_filter)
        AND (date_from IS NULL OR a.created_at >= date_from)
    ORDER BY a.created_at DESC
    LIMIT activity_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get activity statistics for an organization
CREATE OR REPLACE FUNCTION get_org_activity_stats(
    org_uuid UUID,
    date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    activity_type TEXT,
    activity_count BIGINT,
    unique_leads BIGINT,
    unique_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.type,
        COUNT(*) as activity_count,
        COUNT(DISTINCT a.lead_id) as unique_leads,
        COUNT(DISTINCT a.created_by) as unique_users
    FROM activities a
    WHERE a.org_id = org_uuid
        AND a.created_at >= date_from
        AND a.created_at <= date_to
    GROUP BY a.type
    ORDER BY activity_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get scheduled activities (future activities)
CREATE OR REPLACE FUNCTION get_scheduled_activities(
    org_uuid UUID,
    days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE(
    activity_id UUID,
    activity_type TEXT,
    activity_subject TEXT,
    activity_content TEXT,
    activity_scheduled_at TIMESTAMPTZ,
    lead_id UUID,
    lead_name TEXT,
    lead_email TEXT,
    creator_id UUID,
    creator_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.type,
        a.subject,
        a.content,
        a.scheduled_at,
        l.id,
        l.name,
        l.email,
        u.id,
        u.full_name
    FROM activities a
    INNER JOIN leads l ON a.lead_id = l.id
    LEFT JOIN public.users u ON a.created_by = u.id
    WHERE a.org_id = org_uuid
        AND a.scheduled_at IS NOT NULL
        AND a.scheduled_at >= NOW()
        AND a.scheduled_at <= NOW() + (days_ahead || ' days')::INTERVAL
    ORDER BY a.scheduled_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_recent_org_activities(UUID, INTEGER, TEXT[], UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_activity_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_scheduled_activities(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- PART 8: COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.users IS 'Public user profiles - extends auth.users';
COMMENT ON TABLE public.organizations IS 'Organizations/workspaces for multi-tenancy';
COMMENT ON TABLE public.user_orgs IS 'Junction table linking users to organizations with roles';
COMMENT ON TABLE leads IS 'Stores all contact/lead information for CRM';
COMMENT ON TABLE activities IS 'Activity timeline - tracks all interactions with leads';
COMMENT ON TABLE tasks IS 'Task management - follow-ups and to-dos';
COMMENT ON TABLE notes IS 'Internal notes and comments on leads';
COMMENT ON TABLE deals IS 'Sales pipeline - tracks opportunities and deals';

COMMENT ON COLUMN leads.source IS 'Array of source tags (e.g., ["LinkedIn", "Referral", "Conference"])';

COMMENT ON FUNCTION get_org_sources IS 'Returns all unique source tags used in an organization for autocomplete';
COMMENT ON FUNCTION get_recent_org_activities IS 'Returns recent activities across organization with lead and creator info for activity feed';
COMMENT ON FUNCTION get_org_activity_stats IS 'Returns activity statistics by type for an organization within a date range';
COMMENT ON FUNCTION get_scheduled_activities IS 'Returns upcoming scheduled activities for an organization';

COMMENT ON INDEX idx_leads_source_gin IS 'GIN index for efficient array contains operations on source tags';
COMMENT ON INDEX idx_activities_created_by IS 'Index for filtering activities by creator/user';
COMMENT ON INDEX idx_activities_scheduled_at IS 'Index for querying scheduled/future activities';
COMMENT ON INDEX idx_activities_org_created IS 'Composite index for org-wide activity feed queries';

-- ============================================================================
-- COMPLETE! Your database is now ready for use.
-- V2 Changes:
-- - Source field is TEXT[] for multiple tags
-- - Enhanced activities indexes for performance
-- - Helper functions for org-wide activity feed
-- - Activity statistics and scheduled activities support
-- ============================================================================
