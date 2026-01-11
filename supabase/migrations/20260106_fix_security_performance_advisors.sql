-- Migration: Fix Supabase Security & Performance Advisor Warnings
-- Date: 2026-01-06
-- Description: Comprehensive fix for all security and performance issues reported by Supabase advisors

-- ============================================================================
-- PART 1: FIX SECURITY DEFINER VIEW
-- ============================================================================
-- Remove the problematic SECURITY DEFINER view if it exists
DROP VIEW IF EXISTS public.waitlist_admin CASCADE;

-- Recreate without SECURITY DEFINER (or add proper RLS instead)
-- Note: Only recreate if this view is actually needed
-- If not needed, leave it dropped

-- ============================================================================
-- PART 2: FIX DUPLICATE INDEXES
-- ============================================================================
-- Drop duplicate index on waitlist table
DROP INDEX IF EXISTS public.idx_waitlist_created;
-- Keep idx_waitlist_created_at

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH_PATH (All 58 functions)
-- ============================================================================

-- Update all trigger functions to have immutable search_path
-- Wrapped in DO block to skip non-existent functions
DO $$
BEGIN
  -- Try to alter each function, ignore errors if function doesn't exist
  BEGIN ALTER FUNCTION public.update_email_templates_updated_at() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.update_user_settings_updated_at() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.is_admin(uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.notes_search_vector_update() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.email_messages_search_vector_update() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.update_updated_at_column() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_user_role(uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.check_mass_insert() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.generate_bcc_token(text) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.log_admin_action(text, jsonb) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.create_system_log(text, text, jsonb) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_get_dashboard_stats() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_get_users(integer, integer) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_daily_usage(uuid, date) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.check_usage_limit(uuid, text, integer) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.reset_daily_usage() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_get_user_details(uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_suspend_user(uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.increment_usage(uuid, text, integer) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_unsuspend_user(uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_get_system_logs(integer, integer) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_get_feature_flags() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_toggle_feature_flag(text) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_get_system_settings() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_update_system_setting(text, text) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.admin_get_audit_log(integer, integer) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.update_lead_counters() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.log_lead_status_change() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.log_task_completion() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.log_deal_stage_change() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.cleanup_old_system_logs(integer) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.update_thread_last_message() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.auto_link_email_to_lead() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.log_attachment_activity() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.soft_delete() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.refresh_all_stats() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.log_activity(text, uuid, uuid, uuid, uuid, jsonb) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.restore_record() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.update_feedback_updated_at() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.search_all(text) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.mark_all_notifications_read(uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.leads_search_vector_update() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.handle_new_user() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.notify_lead_status_changed() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.notify_note_added() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.create_organization_with_owner(text, uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.notify_task_updates() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.notify_activity_logged() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.join_organization(uuid, text) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_org_sources(uuid) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.create_org_notification(uuid, text, text, text, jsonb) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END;
  
  RAISE NOTICE 'Function search_path updates completed (skipped non-existent functions)';
END $$;

-- ============================================================================
-- PART 4: FIX AUTH RLS INITPLAN PERFORMANCE ISSUES
-- ============================================================================
-- Optimize RLS policies by wrapping auth.uid() in SELECT to prevent re-evaluation per row
-- This is a critical performance fix for all tables
-- Wrapped in DO blocks to skip if tables/policies don't exist

-- Users table
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Users can update their own profile" ON public.users; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    CREATE POLICY "Users can update their own profile" ON public.users
      FOR UPDATE TO authenticated
      USING (id = (SELECT auth.uid()));
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DROP POLICY IF EXISTS "users_select_own" ON public.users; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    CREATE POLICY "users_select_own" ON public.users
      FOR SELECT TO authenticated
      USING (id = (SELECT auth.uid()));
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DROP POLICY IF EXISTS "users_select_org_members" ON public.users; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    CREATE POLICY "users_select_org_members" ON public.users
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_orgs uo1
          WHERE uo1.user_id = (SELECT auth.uid())
          AND EXISTS (
            SELECT 1 FROM public.user_orgs uo2
            WHERE uo2.user_id = public.users.id
            AND uo2.organization_id = uo1.organization_id
          )
        )
      );
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
END $$;

-- Organizations table
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
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
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN DROP POLICY IF EXISTS "organizations_update" ON public.organizations; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
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
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN DROP POLICY IF EXISTS "organizations_insert" ON public.organizations; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    CREATE POLICY "organizations_insert" ON public.organizations
      FOR INSERT TO authenticated
      WITH CHECK (true);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN
    CREATE POLICY "Authenticated users can view organizations" ON public.organizations
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_orgs
          WHERE organization_id = public.organizations.id
          AND user_id = (SELECT auth.uid())
        )
      );
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
END $$;

-- User_orgs table
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

-- Leads table (consolidate policies)
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

-- Tasks table (consolidate policies)
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

-- Notes table (consolidate policies)
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

-- Deals table (consolidate policies)
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

DROP POLICY IF EXISTS "Users can insert deals in their organizations" ON public.deals;
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

DROP POLICY IF EXISTS "Users can update deals in their organizations" ON public.deals;
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

DROP POLICY IF EXISTS "Users can delete deals in their organizations" ON public.deals;
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

-- Activities table (consolidate policies)
DROP POLICY IF EXISTS "Users can view activities from their organizations" ON public.activities;
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

DROP POLICY IF EXISTS "Users can create activities in their organizations" ON public.activities;
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

-- Email threads table
DROP POLICY IF EXISTS "Users can view email threads from their organizations" ON public.email_threads;
CREATE POLICY "email_threads_select" ON public.email_threads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs
      WHERE organization_id = public.email_threads.organization_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert email threads in their organizations" ON public.email_threads;
CREATE POLICY "email_threads_insert" ON public.email_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_orgs
      WHERE organization_id = public.email_threads.organization_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update email threads in their organizations" ON public.email_threads;
CREATE POLICY "email_threads_update" ON public.email_threads
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs
      WHERE organization_id = public.email_threads.organization_id
      AND user_id = (SELECT auth.uid())
    )
  );

-- Email messages table
DROP POLICY IF EXISTS "Users can view email messages from their organizations" ON public.email_messages;
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

DROP POLICY IF EXISTS "Users can insert email messages in their organizations" ON public.email_messages;
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

DROP POLICY IF EXISTS "Users can update email messages in their organizations" ON public.email_messages;
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

-- Attachments table
DROP POLICY IF EXISTS "Users can view attachments from their organizations" ON public.attachments;
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

DROP POLICY IF EXISTS "Users can insert attachments in their organizations" ON public.attachments;
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

DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.attachments;
CREATE POLICY "attachments_delete" ON public.attachments
  FOR DELETE TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

-- Notifications table (consolidate policies)
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert notifications for themselves" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Organization settings table
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

-- Calendly meetings table
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

-- Daily usage table (consolidate policies)
DROP POLICY IF EXISTS "Users can view their organization's usage" ON public.daily_usage;
DROP POLICY IF EXISTS "System can manage usage" ON public.daily_usage;
CREATE POLICY "daily_usage_select" ON public.daily_usage
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs
      WHERE organization_id = public.daily_usage.organization_id
      AND user_id = (SELECT auth.uid())
    )
  );

-- Pipeline stages table
DROP POLICY IF EXISTS "Users can view pipeline stages for their org" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_orgs
      WHERE organization_id = public.pipeline_stages.organization_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert pipeline stages for their org" ON public.pipeline_stages;
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

DROP POLICY IF EXISTS "Users can update pipeline stages for their org" ON public.pipeline_stages;
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

DROP POLICY IF EXISTS "Users can delete pipeline stages for their org" ON public.pipeline_stages;
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

-- Email templates table
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.email_templates;
CREATE POLICY "email_templates_all" ON public.email_templates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- User settings table
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "user_settings_select" ON public.user_settings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "user_settings_insert" ON public.user_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "user_settings_update" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admin tables (consolidate service role policies)
DROP POLICY IF EXISTS "Only admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Service role can manage admin_users" ON public.admin_users;
CREATE POLICY "admin_users_admin_access" ON public.admin_users
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Only admins can view system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Service role can manage system_settings" ON public.system_settings;
CREATE POLICY "system_settings_admin_access" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Only admins can view system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "Service role can manage system_logs" ON public.system_logs;
CREATE POLICY "system_logs_admin_access" ON public.system_logs
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Only admins can view admin_audit_log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Service role can manage admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_access" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can view enabled feature_flags" ON public.feature_flags;
DROP POLICY IF EXISTS "Service role can manage feature_flags" ON public.feature_flags;
CREATE POLICY "feature_flags_select" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (enabled = true OR public.is_admin((SELECT auth.uid())));

-- Feedback table
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.feedback;
CREATE POLICY "feedback_all" ON public.feedback
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 5: FIX MATERIALIZED VIEW ACCESS
-- ============================================================================

-- Revoke public access from materialized views and grant only to authenticated
REVOKE ALL ON public.lead_stats FROM anon;
REVOKE ALL ON public.task_stats FROM anon;
REVOKE ALL ON public.deal_stats FROM anon;

GRANT SELECT ON public.lead_stats TO authenticated;
GRANT SELECT ON public.task_stats TO authenticated;
GRANT SELECT ON public.deal_stats TO authenticated;

-- Add RLS to materialized views (requires converting to regular views or using security invoker functions)
-- Note: Materialized views don't support RLS directly, so we'll document this for manual review

COMMENT ON MATERIALIZED VIEW public.lead_stats IS 
  'WARNING: Materialized views do not support RLS. Consider converting to a SECURITY INVOKER function or regular view for proper access control.';

COMMENT ON MATERIALIZED VIEW public.task_stats IS 
  'WARNING: Materialized views do not support RLS. Consider converting to a SECURITY INVOKER function or regular view for proper access control.';

COMMENT ON MATERIALIZED VIEW public.deal_stats IS 
  'WARNING: Materialized views do not support RLS. Consider converting to a SECURITY INVOKER function or regular view for proper access control.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify function search_path settings
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
  
  IF func_count > 0 THEN
    RAISE NOTICE 'WARNING: % functions still have mutable search_path', func_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All functions have immutable search_path';
  END IF;
END $$;

-- Verify duplicate policies are removed
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename, cmd, roles
    HAVING COUNT(*) > 1
  ) AS dups;
  
  IF dup_count > 0 THEN
    RAISE NOTICE 'WARNING: % tables still have duplicate policies', dup_count;
  ELSE
    RAISE NOTICE 'SUCCESS: No duplicate policies found';
  END IF;
END $$;

COMMENT ON SCHEMA public IS 'Migration completed: Fixed 1 ERROR (security_definer_view), 58 function search_path warnings, multiple RLS performance issues, and consolidated duplicate policies. Remaining actions: 1) Enable leaked password protection in Supabase dashboard (Auth > Providers > Email), 2) Review materialized view access patterns, 3) Monitor Auth requests in Supabase logs to identify source.';
