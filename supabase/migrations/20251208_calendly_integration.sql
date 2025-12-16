-- ============================================================================
-- CALENDLY INTEGRATION MIGRATION
-- Adds support for Calendly OAuth, meeting sync, and scheduling links
-- ============================================================================

-- ============================================================================
-- PART 1: ORGANIZATION SETTINGS TABLE FOR CALENDLY TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Calendly OAuth
    calendly_access_token TEXT,
    calendly_refresh_token TEXT,
    calendly_token_expires_at TIMESTAMPTZ,
    calendly_user_uri TEXT, -- Calendly user URI (e.g., https://api.calendly.com/users/XXXXX)
    
    -- Selected scheduling link
    calendly_scheduling_url TEXT, -- The full scheduling link URL
    calendly_event_type_uri TEXT, -- The event type URI for API calls
    calendly_event_type_name TEXT, -- Display name (e.g., "30 Min Meeting")
    
    -- Company info (moved from localStorage for server-side access)
    company_name TEXT,
    company_description TEXT,
    product_service TEXT,
    target_audience TEXT,
    industry TEXT,
    unique_selling_points JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organization_settings_org_id ON organization_settings(org_id);

-- Enable RLS
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "organization_settings_select" ON organization_settings;
CREATE POLICY "organization_settings_select" ON organization_settings FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "organization_settings_insert" ON organization_settings;
CREATE POLICY "organization_settings_insert" ON organization_settings FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "organization_settings_update" ON organization_settings;
CREATE POLICY "organization_settings_update" ON organization_settings FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "organization_settings_delete" ON organization_settings;
CREATE POLICY "organization_settings_delete" ON organization_settings FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ============================================================================
-- PART 2: MEETINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Meeting details
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER, -- Duration in minutes
    
    -- Location/Link
    location TEXT, -- Physical location or "Online"
    meeting_url TEXT, -- Join URL (Calendly event link, Google Meet, Zoom, etc.)
    
    -- Status
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled',
        'confirmed',
        'completed',
        'canceled',
        'no_show',
        'rescheduled'
    )),
    
    -- Calendly integration
    calendly_event_uri TEXT UNIQUE, -- Calendly event URI for sync
    calendly_invitee_uri TEXT, -- Calendly invitee URI
    calendly_cancel_url TEXT, -- URL to cancel the meeting
    calendly_reschedule_url TEXT, -- URL to reschedule the meeting
    
    -- Attendees
    attendee_name TEXT,
    attendee_email TEXT,
    attendee_timezone TEXT,
    
    -- Tracking
    created_by UUID REFERENCES auth.users(id),
    canceled_by UUID REFERENCES auth.users(id),
    canceled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}', -- Flexible field for additional data
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_org_id ON meetings(org_id);
CREATE INDEX IF NOT EXISTS idx_meetings_lead_id ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_event_uri ON meetings(calendly_event_uri);
CREATE INDEX IF NOT EXISTS idx_meetings_attendee_email ON meetings(attendee_email);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "meetings_select" ON meetings;
CREATE POLICY "meetings_select" ON meetings FOR SELECT
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "meetings_insert" ON meetings;
CREATE POLICY "meetings_insert" ON meetings FOR INSERT
    WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "meetings_update" ON meetings;
CREATE POLICY "meetings_update" ON meetings FOR UPDATE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "meetings_delete" ON meetings;
CREATE POLICY "meetings_delete" ON meetings FOR DELETE
    USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ============================================================================
-- PART 3: TRIGGERS
-- ============================================================================

-- Auto-update updated_at for organization_settings
DROP TRIGGER IF EXISTS update_organization_settings_updated_at ON organization_settings;
CREATE TRIGGER update_organization_settings_updated_at
    BEFORE UPDATE ON organization_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at for meetings
DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create activity when meeting is created or status changes
CREATE OR REPLACE FUNCTION create_meeting_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- New meeting created
        INSERT INTO activities (org_id, lead_id, type, subject, content, created_by, scheduled_at, metadata)
        VALUES (
            NEW.org_id,
            NEW.lead_id,
            'meeting',
            'Meeting scheduled: ' || NEW.title,
            COALESCE(NEW.description, 'Meeting scheduled via Calendly'),
            NEW.created_by,
            NEW.scheduled_at,
            jsonb_build_object(
                'meeting_id', NEW.id,
                'meeting_url', NEW.meeting_url,
                'duration_minutes', NEW.duration_minutes,
                'attendee_email', NEW.attendee_email
            )
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Meeting status changed
        INSERT INTO activities (org_id, lead_id, type, subject, content, created_by, metadata)
        VALUES (
            NEW.org_id,
            NEW.lead_id,
            'meeting',
            'Meeting status updated: ' || NEW.title,
            'Meeting status changed from ' || OLD.status || ' to ' || NEW.status,
            NEW.canceled_by,
            jsonb_build_object(
                'meeting_id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'cancel_reason', NEW.cancel_reason
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS meeting_activity_trigger ON meetings;
CREATE TRIGGER meeting_activity_trigger
    AFTER INSERT OR UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION create_meeting_activity();

-- ============================================================================
-- PART 4: HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create organization settings
CREATE OR REPLACE FUNCTION get_or_create_org_settings(p_org_id UUID)
RETURNS UUID AS $$
DECLARE
    settings_id UUID;
BEGIN
    -- Try to get existing settings
    SELECT id INTO settings_id
    FROM organization_settings
    WHERE org_id = p_org_id;
    
    -- If not exists, create new
    IF settings_id IS NULL THEN
        INSERT INTO organization_settings (org_id)
        VALUES (p_org_id)
        RETURNING id INTO settings_id;
    END IF;
    
    RETURN settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_or_create_org_settings(UUID) TO authenticated;

-- Function to find lead by email (for webhook matching)
CREATE OR REPLACE FUNCTION find_lead_by_email(p_org_id UUID, p_email TEXT)
RETURNS UUID AS $$
DECLARE
    lead_id UUID;
BEGIN
    SELECT id INTO lead_id
    FROM leads
    WHERE org_id = p_org_id
    AND LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    RETURN lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION find_lead_by_email(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 5: COMMENTS
-- ============================================================================

COMMENT ON TABLE organization_settings IS 'Organization-specific settings including Calendly OAuth tokens and company info';
COMMENT ON TABLE meetings IS 'Scheduled meetings with Calendly sync support';
COMMENT ON FUNCTION create_meeting_activity() IS 'Auto-creates activity timeline entries for meeting events';
COMMENT ON FUNCTION get_or_create_org_settings(UUID) IS 'Helper function to ensure organization settings exist';
COMMENT ON FUNCTION find_lead_by_email(UUID, TEXT) IS 'Helper function to match meeting attendee with lead';

-- ============================================================================
-- COMPLETE! Calendly integration tables ready.
-- ============================================================================
