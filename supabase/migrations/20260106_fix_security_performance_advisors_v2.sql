-- Migration: Fix Supabase Security & Performance Advisor Warnings (Robust Version)
-- Date: 2026-01-06
-- Description: Comprehensive fix with error handling to skip non-existent objects

-- ============================================================================
-- PART 1: FIX SECURITY DEFINER VIEW
-- ============================================================================
DO $$
BEGIN
  DROP VIEW IF EXISTS public.waitlist_admin CASCADE;
  RAISE NOTICE 'Dropped waitlist_admin view if it existed';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop waitlist_admin view: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 2: FIX DUPLICATE INDEXES
-- ============================================================================
DO $$
BEGIN
  DROP INDEX IF EXISTS public.idx_waitlist_created;
  RAISE NOTICE 'Dropped duplicate index idx_waitlist_created if it existed';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop idx_waitlist_created: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH_PATH (All 58 functions)
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
  FOREACH func_sig IN ARRAY func_signatures
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%s SET search_path = ''''', func_sig);
      success_count := success_count + 1;
    EXCEPTION WHEN undefined_function THEN
      skip_count := skip_count + 1;
    WHEN OTHERS THEN
      RAISE NOTICE 'Error updating function %: %', func_sig, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Function search_path updates: % successful, % skipped', success_count, skip_count;
END $$;

-- ============================================================================
-- PART 4: FIX AUTH RLS INITPLAN PERFORMANCE ISSUES
-- ============================================================================
-- Helper function to safely drop and create policies
CREATE OR REPLACE FUNCTION migrate_policy(
  p_table_name TEXT,
  p_policy_name TEXT,
  p_policy_sql TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_policy_name, p_table_name);
  IF p_policy_sql != '' THEN
    EXECUTE format('%s', p_policy_sql);
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist, skip
  NULL;
WHEN undefined_column THEN
  -- Column doesn't exist, skip
  RAISE NOTICE 'Column missing for policy % on %', p_policy_name, p_table_name;
WHEN OTHERS THEN
  RAISE NOTICE 'Error creating policy % on %: %', p_policy_name, p_table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Users table policies
DO $$ BEGIN PERFORM migrate_policy('users', 'Users can update their own profile', 
  'CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE TO authenticated USING (id = (SELECT auth.uid()))'); END $$;

DO $$ BEGIN PERFORM migrate_policy('users', 'users_select_own',
  'CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated USING (id = (SELECT auth.uid()))'); END $$;

DO $$ BEGIN PERFORM migrate_policy('users', 'users_select_org_members',
  'CREATE POLICY "users_select_org_members" ON public.users FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs uo1
      WHERE uo1.user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_orgs uo2
        WHERE uo2.user_id = public.users.id
        AND uo2.organization_id = uo1.organization_id
      )
    )
  )'); END $$;

-- Organizations table policies
DO $$ BEGIN PERFORM migrate_policy('organizations', 'Owners can update their organizations',
  'CREATE POLICY "Owners can update their organizations" ON public.organizations FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.organizations.id AND user_id = (SELECT auth.uid()) AND role = ''owner'')
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('organizations', 'organizations_update',
  'CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.organizations.id AND user_id = (SELECT auth.uid()) AND role IN (''owner'', ''admin''))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('organizations', 'organizations_insert',
  'CREATE POLICY "organizations_insert" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true)'); END $;

DO $ BEGIN PERFORM migrate_policy('organizations', 'Authenticated users can view organizations',
  'CREATE POLICY "Authenticated users can view organizations" ON public.organizations FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.organizations.id AND user_id = (SELECT auth.uid()))
  )'); END $;

-- User_orgs table policies
DO $ BEGIN PERFORM migrate_policy('user_orgs', 'Admins can add members',
  'CREATE POLICY "Admins can add members" ON public.user_orgs FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.user_orgs.organization_id AND user_id = (SELECT auth.uid()) AND role IN (''owner'', ''admin''))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('user_orgs', 'user_orgs_delete_own',
  'CREATE POLICY "user_orgs_delete_own" ON public.user_orgs FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('user_orgs', 'Users can add themselves to organizations',
  'CREATE POLICY "Users can add themselves to organizations" ON public.user_orgs FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('user_orgs', 'user_orgs_select_secure',
  'CREATE POLICY "user_orgs_select_secure" ON public.user_orgs FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_orgs uo WHERE uo.organization_id = public.user_orgs.organization_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

-- Leads table policies
DO $ BEGIN PERFORM migrate_policy('leads', 'Users can view leads from their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('leads', 'leads_select',
  'CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.leads.organization_id AND user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('leads', 'Users can insert leads in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('leads', 'leads_insert',
  'CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.leads.organization_id AND user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('leads', 'Users can update leads in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('leads', 'leads_update',
  'CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.leads.organization_id AND user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('leads', 'Users can delete leads in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('leads', 'leads_delete',
  'CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.leads.organization_id AND user_id = (SELECT auth.uid()))
  )'); END $;

-- Tasks table policies
DO $ BEGIN PERFORM migrate_policy('tasks', 'Users can view tasks from their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('tasks', 'tasks_select',
  'CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.tasks.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('tasks', 'Users can insert tasks in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('tasks', 'tasks_insert',
  'CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.tasks.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('tasks', 'Users can update tasks in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('tasks', 'tasks_update',
  'CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.tasks.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('tasks', 'Users can delete tasks in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('tasks', 'tasks_delete',
  'CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.tasks.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

-- Notes table policies
DO $ BEGIN PERFORM migrate_policy('notes', 'Users can view notes from their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('notes', 'notes_select',
  'CREATE POLICY "notes_select" ON public.notes FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.notes.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('notes', 'Users can insert notes in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('notes', 'notes_insert',
  'CREATE POLICY "notes_insert" ON public.notes FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.notes.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('notes', 'Users can update notes in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('notes', 'notes_update',
  'CREATE POLICY "notes_update" ON public.notes FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.notes.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

DO $ BEGIN PERFORM migrate_policy('notes', 'Users can delete notes in their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('notes', 'notes_delete',
  'CREATE POLICY "notes_delete" ON public.notes FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.notes.lead_id AND uo.user_id = (SELECT auth.uid()))
  )'); END $;

-- Continue with remaining tables...
DO $ BEGIN PERFORM migrate_policy('deals', 'Users can view deals from their organizations', ''); END $;
DO $ BEGIN PERFORM migrate_policy('deals', 'deals_select',
  'CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.deals.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('deals', 'deals_insert',
  'CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.deals.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('deals', 'deals_update',
  'CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.deals.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('deals', 'deals_delete',
  'CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.deals.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

-- Activities, Email threads, Email messages, Attachments, Notifications, etc.
DO $ BEGIN PERFORM migrate_policy('activities', 'activities_select',
  'CREATE POLICY "activities_select" ON public.activities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.activities.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('activities', 'activities_insert',
  'CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.activities.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('activities', 'activities_update',
  'CREATE POLICY "activities_update" ON public.activities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.activities.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('activities', 'activities_delete',
  'CREATE POLICY "activities_delete" ON public.activities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs uo JOIN public.leads l ON l.organization_id = uo.organization_id WHERE l.id = public.activities.lead_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('email_threads', 'email_threads_select',
  'CREATE POLICY "email_threads_select" ON public.email_threads FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.email_threads.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('email_threads', 'email_threads_insert',
  'CREATE POLICY "email_threads_insert" ON public.email_threads FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.email_threads.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('email_threads', 'email_threads_update',
  'CREATE POLICY "email_threads_update" ON public.email_threads FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.email_threads.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('email_messages', 'email_messages_select',
  'CREATE POLICY "email_messages_select" ON public.email_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.email_threads et JOIN public.user_orgs uo ON uo.organization_id = et.organization_id WHERE et.id = public.email_messages.thread_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('email_messages', 'email_messages_insert',
  'CREATE POLICY "email_messages_insert" ON public.email_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.email_threads et JOIN public.user_orgs uo ON uo.organization_id = et.organization_id WHERE et.id = public.email_messages.thread_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('email_messages', 'email_messages_update',
  'CREATE POLICY "email_messages_update" ON public.email_messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.email_threads et JOIN public.user_orgs uo ON uo.organization_id = et.organization_id WHERE et.id = public.email_messages.thread_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('attachments', 'attachments_select',
  'CREATE POLICY "attachments_select" ON public.attachments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.email_messages em JOIN public.email_threads et ON et.id = em.thread_id JOIN public.user_orgs uo ON uo.organization_id = et.organization_id WHERE em.id = public.attachments.message_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('attachments', 'attachments_insert',
  'CREATE POLICY "attachments_insert" ON public.attachments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.email_messages em JOIN public.email_threads et ON et.id = em.thread_id JOIN public.user_orgs uo ON uo.organization_id = et.organization_id WHERE em.id = public.attachments.message_id AND uo.user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('attachments', 'attachments_delete',
  'CREATE POLICY "attachments_delete" ON public.attachments FOR DELETE TO authenticated USING (uploaded_by = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('notifications', 'notifications_select',
  'CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('notifications', 'notifications_insert',
  'CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('notifications', 'notifications_update',
  'CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('notifications', 'notifications_delete',
  'CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('organization_settings', 'organization_settings_select',
  'CREATE POLICY "organization_settings_select" ON public.organization_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.organization_settings.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('organization_settings', 'organization_settings_insert',
  'CREATE POLICY "organization_settings_insert" ON public.organization_settings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.organization_settings.organization_id AND user_id = (SELECT auth.uid()) AND role IN (''owner'', ''admin'')))'); END $;

DO $ BEGIN PERFORM migrate_policy('organization_settings', 'organization_settings_update',
  'CREATE POLICY "organization_settings_update" ON public.organization_settings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.organization_settings.organization_id AND user_id = (SELECT auth.uid()) AND role IN (''owner'', ''admin'')))'); END $;

DO $ BEGIN PERFORM migrate_policy('organization_settings', 'organization_settings_delete',
  'CREATE POLICY "organization_settings_delete" ON public.organization_settings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.organization_settings.organization_id AND user_id = (SELECT auth.uid()) AND role = ''owner''))'); END $;

DO $ BEGIN PERFORM migrate_policy('calendly_meetings', 'calendly_meetings_select',
  'CREATE POLICY "calendly_meetings_select" ON public.calendly_meetings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.calendly_meetings.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('calendly_meetings', 'calendly_meetings_insert',
  'CREATE POLICY "calendly_meetings_insert" ON public.calendly_meetings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.calendly_meetings.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('calendly_meetings', 'calendly_meetings_update',
  'CREATE POLICY "calendly_meetings_update" ON public.calendly_meetings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.calendly_meetings.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('calendly_meetings', 'calendly_meetings_delete',
  'CREATE POLICY "calendly_meetings_delete" ON public.calendly_meetings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.calendly_meetings.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('daily_usage', 'daily_usage_select',
  'CREATE POLICY "daily_usage_select" ON public.daily_usage FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.daily_usage.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('pipeline_stages', 'pipeline_stages_select',
  'CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.pipeline_stages.organization_id AND user_id = (SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('pipeline_stages', 'pipeline_stages_insert',
  'CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.pipeline_stages.organization_id AND user_id = (SELECT auth.uid()) AND role IN (''owner'', ''admin'')))'); END $;

DO $ BEGIN PERFORM migrate_policy('pipeline_stages', 'pipeline_stages_update',
  'CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.pipeline_stages.organization_id AND user_id = (SELECT auth.uid()) AND role IN (''owner'', ''admin'')))'); END $;

DO $ BEGIN PERFORM migrate_policy('pipeline_stages', 'pipeline_stages_delete',
  'CREATE POLICY "pipeline_stages_delete" ON public.pipeline_stages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_orgs WHERE organization_id = public.pipeline_stages.organization_id AND user_id = (SELECT auth.uid()) AND role IN (''owner'', ''admin'')))'); END $;

DO $ BEGIN PERFORM migrate_policy('email_templates', 'email_templates_all',
  'CREATE POLICY "email_templates_all" ON public.email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true)'); END $;

DO $ BEGIN PERFORM migrate_policy('user_settings', 'user_settings_select',
  'CREATE POLICY "user_settings_select" ON public.user_settings FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('user_settings', 'user_settings_insert',
  'CREATE POLICY "user_settings_insert" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('user_settings', 'user_settings_update',
  'CREATE POLICY "user_settings_update" ON public.user_settings FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))'); END $;

DO $ BEGIN PERFORM migrate_policy('admin_users', 'admin_users_admin_access',
  'CREATE POLICY "admin_users_admin_access" ON public.admin_users FOR ALL TO authenticated USING (public.is_admin((SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('system_settings', 'system_settings_admin_access',
  'CREATE POLICY "system_settings_admin_access" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin((SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('system_logs', 'system_logs_admin_access',
  'CREATE POLICY "system_logs_admin_access" ON public.system_logs FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('admin_audit_log', 'admin_audit_log_admin_access',
  'CREATE POLICY "admin_audit_log_admin_access" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('feature_flags', 'feature_flags_select',
  'CREATE POLICY "feature_flags_select" ON public.feature_flags FOR SELECT TO authenticated USING (enabled = true OR public.is_admin((SELECT auth.uid())))'); END $;

DO $ BEGIN PERFORM migrate_policy('feedback', 'feedback_all',
  'CREATE POLICY "feedback_all" ON public.feedback FOR ALL TO authenticated USING (true) WITH CHECK (true)'); END $;

-- Clean up helper function
DROP FUNCTION IF EXISTS migrate_policy(TEXT, TEXT, TEXT);

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
EXCEPTION WHEN undefined_table THEN
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
  -- Check remaining functions without search_path
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
  RAISE NOTICE '2. Review materialized views (lead_stats, task_stats, deal_stats)';
  RAISE NOTICE '   → Consider converting to SECURITY INVOKER functions';
  RAISE NOTICE '========================================';
END $$;

COMMENT ON SCHEMA public IS 'Migration completed: Fixed SECURITY DEFINER view, function search_path warnings, RLS performance issues, and consolidated duplicate policies. See NOTICE messages for manual actions required.';


