-- Migration: Remove organization columns and simplify RLS policies
-- This migration removes org_id from all tables and creates user-only RLS policies

-- ============================================================================
-- STEP 1: Drop all existing RLS policies that reference org_id
-- ============================================================================

-- Leads policies
DROP POLICY IF EXISTS "Users can view own leads or shared leads" ON leads;
DROP POLICY IF EXISTS "Users can view leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads or org leads" ON leads;
DROP POLICY IF EXISTS "Users can update leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads or org leads" ON leads;
DROP POLICY IF EXISTS "Users can delete leads" ON leads;

-- Tasks policies
DROP POLICY IF EXISTS "Users can view own tasks or shared tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks or org tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks or org tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;

-- Notes policies
DROP POLICY IF EXISTS "Users can view own notes or shared notes" ON notes;
DROP POLICY IF EXISTS "Users can view notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes or org notes" ON notes;
DROP POLICY IF EXISTS "Users can update notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes or org notes" ON notes;
DROP POLICY IF EXISTS "Users can delete notes" ON notes;

-- Deals policies
DROP POLICY IF EXISTS "Users can view own deals or shared deals" ON deals;
DROP POLICY IF EXISTS "Users can view deals" ON deals;
DROP POLICY IF EXISTS "Users can insert own deals" ON deals;
DROP POLICY IF EXISTS "Users can insert deals" ON deals;
DROP POLICY IF EXISTS "Users can update own deals or org deals" ON deals;
DROP POLICY IF EXISTS "Users can update deals" ON deals;
DROP POLICY IF EXISTS "Users can delete own deals or org deals" ON deals;
DROP POLICY IF EXISTS "Users can delete deals" ON deals;

-- Email templates policies
DROP POLICY IF EXISTS "Users can view own templates or shared templates" ON email_templates;
DROP POLICY IF EXISTS "Users can view templates" ON email_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON email_templates;
DROP POLICY IF EXISTS "Users can insert templates" ON email_templates;
DROP POLICY IF EXISTS "Users can update own templates or org templates" ON email_templates;
DROP POLICY IF EXISTS "Users can update templates" ON email_templates;
DROP POLICY IF EXISTS "Users can delete own templates or org templates" ON email_templates;
DROP POLICY IF EXISTS "Users can delete templates" ON email_templates;

-- Activities policies
DROP POLICY IF EXISTS "Users can view activities" ON activities;
DROP POLICY IF EXISTS "Users can insert activities" ON activities;
DROP POLICY IF EXISTS "Users can update activities" ON activities;
DROP POLICY IF EXISTS "Users can delete activities" ON activities;

-- Attachments policies
DROP POLICY IF EXISTS "Users can view attachments" ON attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete attachments" ON attachments;

-- Pipeline stages policies
DROP POLICY IF EXISTS "Users can view pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can insert pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can update pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can delete pipeline stages" ON pipeline_stages;

-- Calendly meetings policies
DROP POLICY IF EXISTS "Users can view calendly meetings" ON calendly_meetings;
DROP POLICY IF EXISTS "Users can insert calendly meetings" ON calendly_meetings;
DROP POLICY IF EXISTS "Users can update calendly meetings" ON calendly_meetings;
DROP POLICY IF EXISTS "Users can delete calendly meetings" ON calendly_meetings;

-- Daily usage policies
DROP POLICY IF EXISTS "Users can view daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Users can insert daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Users can update daily usage" ON daily_usage;

-- Email tracking policies
DROP POLICY IF EXISTS "Users can view email tracking" ON email_tracking;
DROP POLICY IF EXISTS "Users can insert email tracking" ON email_tracking;

-- Lead status history policies
DROP POLICY IF EXISTS "Users can view lead status history" ON lead_status_history;
DROP POLICY IF EXISTS "Users can insert lead status history" ON lead_status_history;

-- Analytics events policies
DROP POLICY IF EXISTS "Users can view analytics events" ON analytics_events;
DROP POLICY IF EXISTS "Users can insert analytics events" ON analytics_events;

-- Notifications policies
DROP POLICY IF EXISTS "Users can view notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON notifications;

-- Feedback policies
DROP POLICY IF EXISTS "Users can view feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;

-- ============================================================================
-- STEP 2: Drop foreign key constraints referencing org_id
-- ============================================================================

-- Leads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_org_id_fkey;

-- Tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_org_id_fkey;

-- Notes
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_org_id_fkey;

-- Deals
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_org_id_fkey;

-- Activities
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_org_id_fkey;

-- Attachments
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_org_id_fkey;

-- Email templates
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_org_id_fkey;

-- Pipeline stages
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_org_id_fkey;

-- Calendly meetings
ALTER TABLE calendly_meetings DROP CONSTRAINT IF EXISTS calendly_meetings_org_id_fkey;

-- Daily usage
ALTER TABLE daily_usage DROP CONSTRAINT IF EXISTS daily_usage_org_id_fkey;

-- Email tracking
ALTER TABLE email_tracking DROP CONSTRAINT IF EXISTS email_tracking_org_id_fkey;

-- Lead status history
ALTER TABLE lead_status_history DROP CONSTRAINT IF EXISTS lead_status_history_org_id_fkey;

-- Analytics events
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_org_id_fkey;

-- Notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_org_id_fkey;

-- Feedback
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_org_id_fkey;

-- ============================================================================
-- STEP 3: Drop org_id columns from all tables
-- ============================================================================

ALTER TABLE leads DROP COLUMN IF EXISTS org_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS org_id;
ALTER TABLE notes DROP COLUMN IF EXISTS org_id;
ALTER TABLE deals DROP COLUMN IF EXISTS org_id;
ALTER TABLE activities DROP COLUMN IF EXISTS org_id;
ALTER TABLE attachments DROP COLUMN IF EXISTS org_id;
ALTER TABLE email_templates DROP COLUMN IF EXISTS org_id;
ALTER TABLE pipeline_stages DROP COLUMN IF EXISTS org_id;
ALTER TABLE calendly_meetings DROP COLUMN IF EXISTS org_id;
ALTER TABLE daily_usage DROP COLUMN IF EXISTS org_id;
ALTER TABLE email_tracking DROP COLUMN IF EXISTS org_id;
ALTER TABLE lead_status_history DROP COLUMN IF EXISTS org_id;
ALTER TABLE analytics_events DROP COLUMN IF EXISTS org_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS org_id;
ALTER TABLE feedback DROP COLUMN IF EXISTS org_id;

-- ============================================================================
-- STEP 4: Update comments to reflect user-centric model
-- ============================================================================

COMMENT ON TABLE leads IS 'Stores all contact/lead information for CRM - user-owned';
COMMENT ON TABLE tasks IS 'Task management - follow-ups and to-dos - user-owned';
COMMENT ON TABLE notes IS 'Internal notes and comments on leads - user-owned';
COMMENT ON TABLE deals IS 'Sales pipeline - tracks opportunities and deals - user-owned';
COMMENT ON TABLE email_templates IS 'AI-generated cold email templates - user-owned';
COMMENT ON TABLE activities IS 'Activity timeline - tracks all interactions with leads - user-owned';
COMMENT ON TABLE attachments IS 'File attachments for various entities - user-owned';
COMMENT ON TABLE pipeline_stages IS 'Configurable pipeline stages per user';
COMMENT ON TABLE calendly_meetings IS 'Calendly meeting events synced from Calendly API - user-owned';
COMMENT ON TABLE daily_usage IS 'Tracks daily usage of templates and emails per user';

-- ============================================================================
-- STEP 5: Create simplified user-only RLS policies
-- ============================================================================

-- Leads policies
CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Tasks policies
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Notes policies
CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Deals policies
CREATE POLICY "Users can view own deals"
  ON deals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own deals"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Email templates policies
CREATE POLICY "Users can view own templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Activities policies
CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Attachments policies
CREATE POLICY "Users can view own attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own attachments"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own attachments"
  ON attachments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own attachments"
  ON attachments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Pipeline stages policies
CREATE POLICY "Users can view own pipeline stages"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pipeline stages"
  ON pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pipeline stages"
  ON pipeline_stages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pipeline stages"
  ON pipeline_stages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Calendly meetings policies
CREATE POLICY "Users can view own calendly meetings"
  ON calendly_meetings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own calendly meetings"
  ON calendly_meetings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own calendly meetings"
  ON calendly_meetings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own calendly meetings"
  ON calendly_meetings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Daily usage policies
CREATE POLICY "Users can view own daily usage"
  ON daily_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own daily usage"
  ON daily_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own daily usage"
  ON daily_usage FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Email tracking policies
CREATE POLICY "Users can view own email tracking"
  ON email_tracking FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email tracking"
  ON email_tracking FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Lead status history policies
CREATE POLICY "Users can view own lead status history"
  ON lead_status_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own lead status history"
  ON lead_status_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Analytics events policies
CREATE POLICY "Users can view own analytics events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own analytics events"
  ON analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Notifications policies (user_id is the FK to auth.users)
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Feedback policies (user_id is the FK to auth.users)
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
