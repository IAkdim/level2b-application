-- Notifications system for real-time alerts
-- Created: 2025-12-11

-- ============================================================================
-- PART 1: NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('meeting_scheduled', 'meeting_canceled', 'email_received', 'email_bounced', 'lead_status_changed', 'campaign_completed', 'daily_limit_warning', 'info', 'success', 'warning', 'error')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
WITH CHECK (user_id = auth.uid() OR org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- PART 2: HELPER FUNCTIONS
-- ============================================================================

-- Function to create notification for all users in an org
CREATE OR REPLACE FUNCTION create_org_notification(
    p_org_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_action_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Insert notification for each user in the organization
    FOR v_user_id IN 
        SELECT user_id FROM user_orgs WHERE org_id = p_org_id
    LOOP
        INSERT INTO notifications (user_id, org_id, type, title, message, action_url, metadata)
        VALUES (v_user_id, p_org_id, p_type, p_title, p_message, p_action_url, p_metadata);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE notifications
    SET read = TRUE
    WHERE user_id = p_user_id AND read = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: TRIGGERS FOR AUTO-NOTIFICATIONS
-- ============================================================================

-- NOTE: Meeting notifications trigger commented out until meetings table exists
-- Will be added later when Calendly integration creates meetings table

-- Trigger: Lead status changed notification
CREATE OR REPLACE FUNCTION notify_lead_status_changed()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Only notify for important status changes
        IF NEW.status IN ('qualified', 'meeting_scheduled', 'won', 'lost') THEN
            PERFORM create_org_notification(
                NEW.org_id,
                'lead_status_changed',
                'Lead status gewijzigd',
                'Lead ' || NEW.name || ' status is gewijzigd naar ' || NEW.status,
                '/leads/' || NEW.id,
                jsonb_build_object('lead_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_status_notification_trigger ON leads;
CREATE TRIGGER lead_status_notification_trigger
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION notify_lead_status_changed();

-- Trigger: New note added to lead
CREATE OR REPLACE FUNCTION notify_note_added()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.lead_id IS NOT NULL THEN
        -- Get lead info
        DECLARE
            v_lead_name TEXT;
        BEGIN
            SELECT name INTO v_lead_name FROM leads WHERE id = NEW.lead_id;
            
            PERFORM create_org_notification(
                NEW.org_id,
                'info',
                'Nieuwe notitie toegevoegd',
                'Notitie toegevoegd aan lead ' || COALESCE(v_lead_name, 'Unknown'),
                '/leads/' || NEW.lead_id,
                jsonb_build_object('note_id', NEW.id, 'lead_id', NEW.lead_id)
            );
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS note_notification_trigger ON notes;
CREATE TRIGGER note_notification_trigger
    AFTER INSERT ON notes
    FOR EACH ROW
    EXECUTE FUNCTION notify_note_added();

-- Trigger: Task due soon or completed
CREATE OR REPLACE FUNCTION notify_task_updates()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.due_date IS NOT NULL THEN
        -- Check if due within 24 hours
        IF NEW.due_date <= NOW() + INTERVAL '24 hours' AND NEW.due_date > NOW() THEN
            PERFORM create_org_notification(
                NEW.org_id,
                'warning',
                'Taak vervalt binnenkort',
                'Taak "' || NEW.title || '" vervalt op ' || to_char(NEW.due_date, 'DD-MM-YYYY HH24:MI'),
                '/leads',
                jsonb_build_object('task_id', NEW.id, 'due_date', NEW.due_date)
            );
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
        PERFORM create_org_notification(
            NEW.org_id,
            'success',
            'Taak afgerond',
            'Taak "' || NEW.title || '" is voltooid',
            '/leads',
            jsonb_build_object('task_id', NEW.id)
        );
    ELSIF TG_OP = 'UPDATE' AND NEW.due_date IS NOT NULL AND OLD.due_date IS DISTINCT FROM NEW.due_date THEN
        -- Due date changed
        IF NEW.due_date <= NOW() + INTERVAL '24 hours' AND NEW.due_date > NOW() THEN
            PERFORM create_org_notification(
                NEW.org_id,
                'warning',
                'Taak deadline gewijzigd',
                'Taak "' || NEW.title || '" vervalt nu op ' || to_char(NEW.due_date, 'DD-MM-YYYY HH24:MI'),
                '/leads',
                jsonb_build_object('task_id', NEW.id, 'due_date', NEW.due_date)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_notification_trigger ON tasks;
CREATE TRIGGER task_notification_trigger
    AFTER INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_updates();

-- Trigger: Activity logged (email sent, call made, etc.)
CREATE OR REPLACE FUNCTION notify_activity_logged()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.type IN ('email', 'call') THEN
        -- Get lead info
        SELECT name INTO v_lead_name FROM leads WHERE id = NEW.lead_id;
        
        IF NEW.type = 'email' THEN
            PERFORM create_org_notification(
                NEW.org_id,
                'info',
                'Email verzonden',
                'Email verzonden naar ' || COALESCE(v_lead_name, 'lead'),
                '/leads/' || NEW.lead_id,
                jsonb_build_object('activity_id', NEW.id, 'lead_id', NEW.lead_id)
            );
        ELSIF NEW.type = 'call' THEN
            PERFORM create_org_notification(
                NEW.org_id,
                'info',
                'Gesprek gelogd',
                'Gesprek met ' || COALESCE(v_lead_name, 'lead') || ' gelogd',
                '/leads/' || NEW.lead_id,
                jsonb_build_object('activity_id', NEW.id, 'lead_id', NEW.lead_id)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_notification_trigger ON activities;
CREATE TRIGGER activity_notification_trigger
    AFTER INSERT ON activities
    FOR EACH ROW
    EXECUTE FUNCTION notify_activity_logged();

COMMENT ON TABLE notifications IS 'Real-time notifications for users about important events';
COMMENT ON FUNCTION create_org_notification IS 'Helper function to create notifications for all users in an organization';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Mark all notifications as read for a specific user';
