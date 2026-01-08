-- Migration: Fix Supabase Security & Performance Advisor Warnings
-- Date: 2026-01-06
-- Description: Comprehensive fix for all security and performance issues

-- ============================================================================
-- PART 1: FIX SECURITY DEFINER VIEW
-- ============================================================================
DROP VIEW IF EXISTS public.waitlist_admin CASCADE;

-- ============================================================================
-- PART 2: FIX DUPLICATE INDEXES
-- ============================================================================
DROP INDEX IF EXISTS public.idx_waitlist_created;

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH_PATH (All functions)
-- ============================================================================
DO $$
DECLARE
  func_signatures TEXT[] := ARRAY[
    'update_email_templates_updated_at()',
    'update_user_settings_updated_at()',
    'is_admin(uuid)',
    'notes_search_vector_update()',
    'email_messages_search_vector_update()',
    'update_updated_at_column()',
    'get_user_role(uuid)',
    'check_mass_insert()',
    'generate_bcc_token(text)',
    'log_admin_action(text, jsonb)',
    'create_system_log(text, text, jsonb)',
    'admin_get_dashboard_stats()',
    'admin_get_users(integer, integer)',
    'get_daily_usage(uuid, date)',
    'check_usage_limit(uuid, text, integer)',
    'reset_daily_usage()',
    'admin_get_user_details(uuid)',
    'admin_suspend_user(uuid)',
    'increment_usage(uuid, text, integer)',
    'admin_unsuspend_user(uuid)',
    'admin_get_system_logs(integer, integer)',
    'admin_get_feature_flags()',
    'admin_toggle_feature_flag(text)',
    'admin_get_system_settings()',
    'admin_update_system_setting(text, text)',
    'admin_get_audit_log(integer, integer)',
    'update_lead_counters()',
    'log_lead_status_change()',
    'log_task_completion()',
    'log_deal_stage_change()',
    'cleanup_old_system_logs(integer)',
    'update_thread_last_message()',
    'auto_link_email_to_lead()',
    'log_attachment_activity()',
    'soft_delete()',
    'refresh_all_stats()',
    'log_activity(text, uuid, uuid, uuid, uuid, jsonb)',
    'restore_record()',
    'update_feedback_updated_at()',
    'search_all(text)',
    'mark_all_notifications_read(uuid)',
    'leads_search_vector_update()',
    'handle_new_user()',
    'notify_lead_status_changed()',
    'notify_note_added()',
    'create_organization_with_owner(text, uuid)',
    'notify_task_updates()',
    'notify_activity_logged()',
    'join_organization(uuid, text)',
    'get_org_sources(uuid)',
    'create_org_notification(uuid, text, text, text, jsonb)'
  ];
  func_sig TEXT;
  success_count INT := 0;
  skip_count INT := 0;
BEGIN
  FOREACH func_sig IN ARRAY func_signatures LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%s SET search_path = ''''', func_sig);
      success_count := success_count + 1;
    EXCEPTION 
      WHEN undefined_function THEN
        skip_count := skip_count + 1;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error updating function %: %', func_sig, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Function updates: % successful, % skipped', success_count, skip_count;
END $$;

-- ============================================================================
-- PART 4: FIX AUTH RLS PERFORMANCE ISSUES
-- ============================================================================
-- Users table policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users 
  FOR UPDATE TO authenticated 
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users 
  FOR SELECT TO authenticated 
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users_select_org_members" ON public.users;
CREATE POLICY "users_select_org_members" ON public.users 
  FOR SELECT TO authenticated 
  USING (
    id IN (
      SELECT uo2.user_id
      FROM public.user_orgs uo1
      INNER JOIN public.user_orgs uo2 ON uo1.organization_id = uo2.organization_id
      WHERE uo1.user_id = (SELECT auth.uid())
    )
  );

-- Organizations table policies
DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;
CREATE POLICY "Owners can update their organizations" ON public.organizations 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.organizations.id 
      AND user_id = (SELECT auth.uid()) 
      AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.organizations.id 
      AND user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
CREATE POLICY "organizations_insert" ON public.organizations 
  FOR INSERT TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
CREATE POLICY "Authenticated users can view organizations" ON public.organizations 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.organizations.id 
      AND user_id = (SELECT auth.uid())
    )
  );

-- User_orgs table policies
DROP POLICY IF EXISTS "Admins can add members" ON public.user_orgs;
CREATE POLICY "Admins can add members" ON public.user_orgs 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.user_orgs.organization_id 
      AND user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "user_orgs_delete_own" ON public.user_orgs;
CREATE POLICY "user_orgs_delete_own" ON public.user_orgs 
  FOR DELETE TO authenticated 
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can add themselves to organizations" ON public.user_orgs;
CREATE POLICY "Users can add themselves to organizations" ON public.user_orgs 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_orgs_select_secure" ON public.user_orgs;
CREATE POLICY "user_orgs_select_secure" ON public.user_orgs 
  FOR SELECT TO authenticated 
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      WHERE uo.organization_id = public.user_orgs.organization_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

-- Leads table policies
DROP POLICY IF EXISTS "Users can view leads from their organizations" ON public.leads;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.leads.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert leads in their organizations" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.leads.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update leads in their organizations" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.leads.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete leads in their organizations" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.leads.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

-- Tasks table policies
DROP POLICY IF EXISTS "Users can view tasks from their organizations" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.tasks.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert tasks in their organizations" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.tasks.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update tasks in their organizations" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.tasks.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete tasks in their organizations" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.tasks.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

-- Notes table policies  
DROP POLICY IF EXISTS "Users can view notes from their organizations" ON public.notes;
DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.notes.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert notes in their organizations" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
CREATE POLICY "notes_insert" ON public.notes 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.notes.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update notes in their organizations" ON public.notes;
DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.notes.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete notes in their organizations" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_delete" ON public.notes 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.notes.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

-- Deals table policies
DROP POLICY IF EXISTS "Users can view deals from their organizations" ON public.deals;
DROP POLICY IF EXISTS "deals_select" ON public.deals;
CREATE POLICY "deals_select" ON public.deals 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.deals.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "deals_insert" ON public.deals;
CREATE POLICY "deals_insert" ON public.deals 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.deals.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "deals_update" ON public.deals;
CREATE POLICY "deals_update" ON public.deals 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.deals.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "deals_delete" ON public.deals;
CREATE POLICY "deals_delete" ON public.deals 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.deals.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

-- Activities table policies
DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.activities.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.activities.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.activities.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "activities_delete" ON public.activities;
CREATE POLICY "activities_delete" ON public.activities 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo 
      JOIN public.leads l ON l.organization_id = uo.organization_id 
      WHERE l.id = public.activities.lead_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

-- Email threads table policies
DROP POLICY IF EXISTS "email_threads_select" ON public.email_threads;
CREATE POLICY "email_threads_select" ON public.email_threads 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.email_threads.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "email_threads_insert" ON public.email_threads;
CREATE POLICY "email_threads_insert" ON public.email_threads 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.email_threads.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "email_threads_update" ON public.email_threads;
CREATE POLICY "email_threads_update" ON public.email_threads 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.email_threads.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

-- Email messages table policies
DROP POLICY IF EXISTS "email_messages_select" ON public.email_messages;
CREATE POLICY "email_messages_select" ON public.email_messages 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads et 
      JOIN public.user_orgs uo ON uo.organization_id = et.organization_id 
      WHERE et.id = public.email_messages.thread_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "email_messages_insert" ON public.email_messages;
CREATE POLICY "email_messages_insert" ON public.email_messages 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_threads et 
      JOIN public.user_orgs uo ON uo.organization_id = et.organization_id 
      WHERE et.id = public.email_messages.thread_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "email_messages_update" ON public.email_messages;
CREATE POLICY "email_messages_update" ON public.email_messages 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads et 
      JOIN public.user_orgs uo ON uo.organization_id = et.organization_id 
      WHERE et.id = public.email_messages.thread_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

-- Attachments table policies
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
CREATE POLICY "attachments_select" ON public.attachments 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.email_messages em 
      JOIN public.email_threads et ON et.id = em.thread_id 
      JOIN public.user_orgs uo ON uo.organization_id = et.organization_id 
      WHERE em.id = public.attachments.message_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
CREATE POLICY "attachments_insert" ON public.attachments 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_messages em 
      JOIN public.email_threads et ON et.id = em.thread_id 
      JOIN public.user_orgs uo ON uo.organization_id = et.organization_id 
      WHERE em.id = public.attachments.message_id 
      AND uo.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "attachments_delete" ON public.attachments;
CREATE POLICY "attachments_delete" ON public.attachments 
  FOR DELETE TO authenticated 
  USING (uploaded_by = (SELECT auth.uid()));

-- Notifications table policies
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications 
  FOR SELECT TO authenticated 
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications 
  FOR UPDATE TO authenticated 
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications 
  FOR DELETE TO authenticated 
  USING (user_id = (SELECT auth.uid()));

-- Organization settings table policies
DROP POLICY IF EXISTS "organization_settings_select" ON public.organization_settings;
CREATE POLICY "organization_settings_select" ON public.organization_settings 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.organization_settings.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "organization_settings_insert" ON public.organization_settings;
CREATE POLICY "organization_settings_insert" ON public.organization_settings 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.organization_settings.organization_id 
      AND user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "organization_settings_update" ON public.organization_settings;
CREATE POLICY "organization_settings_update" ON public.organization_settings 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.organization_settings.organization_id 
      AND user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "organization_settings_delete" ON public.organization_settings;
CREATE POLICY "organization_settings_delete" ON public.organization_settings 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.organization_settings.organization_id 
      AND user_id = (SELECT auth.uid()) 
      AND role = 'owner'
    )
  );

-- Calendly meetings table policies
DROP POLICY IF EXISTS "calendly_meetings_select" ON public.calendly_meetings;
CREATE POLICY "calendly_meetings_select" ON public.calendly_meetings 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.calendly_meetings.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "calendly_meetings_insert" ON public.calendly_meetings;
CREATE POLICY "calendly_meetings_insert" ON public.calendly_meetings 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.calendly_meetings.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "calendly_meetings_update" ON public.calendly_meetings;
CREATE POLICY "calendly_meetings_update" ON public.calendly_meetings 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.calendly_meetings.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "calendly_meetings_delete" ON public.calendly_meetings;
CREATE POLICY "calendly_meetings_delete" ON public.calendly_meetings 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.calendly_meetings.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

-- Daily usage table policies
DROP POLICY IF EXISTS "daily_usage_select" ON public.daily_usage;
CREATE POLICY "daily_usage_select" ON public.daily_usage 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.daily_usage.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

-- Pipeline stages table policies
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.pipeline_stages.organization_id 
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "pipeline_stages_insert" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.pipeline_stages.organization_id 
      AND user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "pipeline_stages_update" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.pipeline_stages.organization_id 
      AND user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "pipeline_stages_delete" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs 
      WHERE organization_id = public.pipeline_stages.organization_id 
      AND user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
    )
  );

-- Email templates table policies
DROP POLICY IF EXISTS "email_templates_all" ON public.email_templates;
CREATE POLICY "email_templates_all" ON public.email_templates 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- User settings table policies
DROP POLICY IF EXISTS "user_settings_select" ON public.user_settings;
CREATE POLICY "user_settings_select" ON public.user_settings 
  FOR SELECT TO authenticated 
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_settings_insert" ON public.user_settings;
CREATE POLICY "user_settings_insert" ON public.user_settings 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_settings_update" ON public.user_settings;
CREATE POLICY "user_settings_update" ON public.user_settings 
  FOR UPDATE TO authenticated 
  USING (user_id = (SELECT auth.uid()));

-- Admin tables policies
DROP POLICY IF EXISTS "admin_users_admin_access" ON public.admin_users;
CREATE POLICY "admin_users_admin_access" ON public.admin_users 
  FOR ALL TO authenticated 
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "system_settings_admin_access" ON public.system_settings;
CREATE POLICY "system_settings_admin_access" ON public.system_settings 
  FOR ALL TO authenticated 
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "system_logs_admin_access" ON public.system_logs;
CREATE POLICY "system_logs_admin_access" ON public.system_logs 
  FOR SELECT TO authenticated 
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "admin_audit_log_admin_access" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_access" ON public.admin_audit_log 
  FOR SELECT TO authenticated 
  USING (public.is_admin((SELECT auth.uid())));

-- Feature flags table policies
DROP POLICY IF EXISTS "feature_flags_select" ON public.feature_flags;
CREATE POLICY "feature_flags_select" ON public.feature_flags 
  FOR SELECT TO authenticated 
  USING (enabled = true OR public.is_admin((SELECT auth.uid())));

-- Feedback table policies
DROP POLICY IF EXISTS "feedback_all" ON public.feedback;
CREATE POLICY "feedback_all" ON public.feedback 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- ============================================================================
-- PART 5: FIX MATERIALIZED VIEW ACCESS
-- ============================================================================
DO $$
BEGIN
  REVOKE ALL ON public.lead_stats FROM anon;
  REVOKE ALL ON public.task_stats FROM anon;
  REVOKE ALL ON public.deal_stats FROM anon;
  
  GRANT SELECT ON public.lead_stats TO authenticated;
  GRANT SELECT ON public.task_stats TO authenticated;
  GRANT SELECT ON public.deal_stats TO authenticated;
  
  RAISE NOTICE 'Materialized view permissions updated';
EXCEPTION 
  WHEN undefined_table THEN
    RAISE NOTICE 'Some materialized views do not exist, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating materialized view permissions: %', SQLERRM;
END $$;

-- ============================================================================
-- FINAL REPORT
-- ============================================================================
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  AND p.prosecdef = false
  AND (p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) AS config
    WHERE config LIKE 'search_path=%'
  ));
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Functions without search_path: %', func_count;
  RAISE NOTICE '';
  RAISE NOTICE 'MANUAL ACTIONS REQUIRED:';
  RAISE NOTICE '1. Enable leaked password protection in Supabase Dashboard';
  RAISE NOTICE '   → Go to Auth > Providers > Email';
  RAISE NOTICE '2. Run Security Advisor again to verify fixes';
  RAISE NOTICE '========================================';
END $$;
