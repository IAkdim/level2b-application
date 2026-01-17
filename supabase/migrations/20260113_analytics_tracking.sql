-- Migration: Analytics Tracking System
-- Date: 2026-01-13
-- Description: Create tables and functions for comprehensive analytics tracking

-- ============================================================================
-- ANALYTICS EVENTS TABLE
-- ============================================================================
-- This table tracks all measurable events in the system for analytics

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  
  -- Associated entities (nullable)
  lead_id UUID,
  task_id UUID,
  template_id UUID,
  
  -- Event metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index-friendly date for partitioning/querying
  event_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_events_org_date 
  ON analytics_events(org_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type 
  ON analytics_events(event_type, org_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_category 
  ON analytics_events(event_category, org_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_lead 
  ON analytics_events(lead_id) WHERE lead_id IS NOT NULL;

-- ============================================================================
-- EMAIL TRACKING TABLE (for opens/clicks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Associated email (no FK constraint - email_messages may not exist yet)
  email_message_id UUID,
  lead_id UUID,
  
  -- Tracking type
  tracking_type TEXT NOT NULL CHECK (tracking_type IN ('open', 'click', 'reply', 'bounce')),
  
  -- Tracking metadata
  link_url TEXT, -- For click tracking
  user_agent TEXT,
  ip_address TEXT,
  
  -- Timestamps
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tracked_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_org_date 
  ON email_tracking(org_id, tracked_date DESC);

CREATE INDEX IF NOT EXISTS idx_email_tracking_message 
  ON email_tracking(email_message_id) WHERE email_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_tracking_type 
  ON email_tracking(tracking_type, org_id, tracked_date DESC);

-- ============================================================================
-- LEAD STATUS HISTORY TABLE
-- ============================================================================
-- Track all status changes for leads over time (for funnel analysis)

CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  
  -- Status change
  old_status TEXT,
  new_status TEXT NOT NULL,
  
  -- Who made the change
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_org_date 
  ON lead_status_history(org_id, changed_date DESC);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead 
  ON lead_status_history(lead_id, changed_at DESC);

-- ============================================================================
-- TRIGGER: Track lead status changes automatically
-- ============================================================================
CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_status_history (org_id, lead_id, old_status, new_status, changed_by)
    VALUES (NEW.org_id, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS lead_status_change_trigger ON leads;
CREATE TRIGGER lead_status_change_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION track_lead_status_change();

-- ============================================================================
-- TRIGGER: Track new leads
-- ============================================================================
CREATE OR REPLACE FUNCTION track_new_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Track the initial status
  INSERT INTO lead_status_history (org_id, lead_id, old_status, new_status, changed_by)
  VALUES (NEW.org_id, NEW.id, NULL, NEW.status, auth.uid());
  
  -- Track as analytics event
  INSERT INTO analytics_events (org_id, user_id, event_type, event_category, lead_id, metadata)
  VALUES (NEW.org_id, auth.uid(), 'lead_created', 'leads', NEW.id, 
    jsonb_build_object('source', NEW.source, 'status', NEW.status));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS new_lead_trigger ON leads;
CREATE TRIGGER new_lead_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION track_new_lead();

-- ============================================================================
-- FUNCTION: Get lead funnel metrics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_lead_funnel_metrics(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Set default date range to last 30 days
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  -- Get total for percentage calculation
  SELECT COUNT(*) INTO v_total
  FROM leads l
  WHERE l.org_id = p_org_id
    AND l.created_at::DATE BETWEEN p_start_date AND p_end_date;
  
  RETURN QUERY
  SELECT 
    l.status::TEXT,
    COUNT(*)::BIGINT as count,
    CASE WHEN v_total > 0 
      THEN ROUND((COUNT(*) * 100.0 / v_total), 1)
      ELSE 0 
    END as percentage
  FROM leads l
  WHERE l.org_id = p_org_id
    AND l.created_at::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY l.status
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get leads over time (for timeline chart)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_leads_over_time(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_interval TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE(
  period TEXT,
  period_start DATE,
  total_leads BIGINT,
  new_leads BIGINT,
  contacted_leads BIGINT,
  qualified_leads BIGINT,
  meeting_scheduled_leads BIGINT,
  won_leads BIGINT,
  lost_leads BIGINT
) AS $$
BEGIN
  -- Set default date range
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '6 months');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      CASE p_interval
        WHEN 'day' THEN '1 day'::INTERVAL
        WHEN 'week' THEN '1 week'::INTERVAL
        WHEN 'month' THEN '1 month'::INTERVAL
        ELSE '1 day'::INTERVAL
      END
    )::DATE as period_date
  )
  SELECT 
    CASE p_interval
      WHEN 'day' THEN TO_CHAR(ds.period_date, 'YYYY-MM-DD')
      WHEN 'week' THEN TO_CHAR(ds.period_date, 'IYYY-IW')
      WHEN 'month' THEN TO_CHAR(ds.period_date, 'YYYY-MM')
      ELSE TO_CHAR(ds.period_date, 'YYYY-MM-DD')
    END as period,
    ds.period_date as period_start,
    COUNT(l.id)::BIGINT as total_leads,
    COUNT(CASE WHEN l.status = 'new' THEN 1 END)::BIGINT as new_leads,
    COUNT(CASE WHEN l.status = 'contacted' THEN 1 END)::BIGINT as contacted_leads,
    COUNT(CASE WHEN l.status IN ('qualified', 'replied') THEN 1 END)::BIGINT as qualified_leads,
    COUNT(CASE WHEN l.status = 'meeting_scheduled' THEN 1 END)::BIGINT as meeting_scheduled_leads,
    COUNT(CASE WHEN l.status IN ('won', 'closed') THEN 1 END)::BIGINT as won_leads,
    COUNT(CASE WHEN l.status = 'lost' THEN 1 END)::BIGINT as lost_leads
  FROM date_series ds
  LEFT JOIN leads l ON 
    l.org_id = p_org_id AND
    CASE p_interval
      WHEN 'day' THEN l.created_at::DATE = ds.period_date
      WHEN 'week' THEN DATE_TRUNC('week', l.created_at)::DATE = ds.period_date
      WHEN 'month' THEN DATE_TRUNC('month', l.created_at)::DATE = ds.period_date
      ELSE l.created_at::DATE = ds.period_date
    END
  GROUP BY ds.period_date
  ORDER BY ds.period_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get email metrics over time
-- ============================================================================
CREATE OR REPLACE FUNCTION get_email_metrics_over_time(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_interval TEXT DEFAULT 'day'
)
RETURNS TABLE(
  period TEXT,
  period_start DATE,
  emails_sent BIGINT,
  emails_opened BIGINT,
  emails_replied BIGINT,
  open_rate NUMERIC,
  reply_rate NUMERIC
) AS $$
BEGIN
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '6 months');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      CASE p_interval
        WHEN 'day' THEN '1 day'::INTERVAL
        WHEN 'week' THEN '1 week'::INTERVAL
        WHEN 'month' THEN '1 month'::INTERVAL
        ELSE '1 day'::INTERVAL
      END
    )::DATE as period_date
  ),
  email_counts AS (
    SELECT
      CASE p_interval
        WHEN 'day' THEN em.sent_at::DATE
        WHEN 'week' THEN DATE_TRUNC('week', em.sent_at)::DATE
        WHEN 'month' THEN DATE_TRUNC('month', em.sent_at)::DATE
        ELSE em.sent_at::DATE
      END as period_date,
      COUNT(*) FILTER (WHERE em.is_from_me = true) as sent,
      COUNT(*) FILTER (WHERE em.is_from_me = false) as received
    FROM email_messages em
    WHERE em.org_id = p_org_id
      AND em.sent_at IS NOT NULL
      AND em.sent_at::DATE BETWEEN p_start_date AND p_end_date
      AND em.deleted_at IS NULL
    GROUP BY 1
  ),
  tracking_counts AS (
    SELECT
      CASE p_interval
        WHEN 'day' THEN et.tracked_date
        WHEN 'week' THEN DATE_TRUNC('week', et.tracked_date)::DATE
        WHEN 'month' THEN DATE_TRUNC('month', et.tracked_date)::DATE
        ELSE et.tracked_date
      END as period_date,
      COUNT(*) FILTER (WHERE et.tracking_type = 'open') as opens,
      COUNT(*) FILTER (WHERE et.tracking_type = 'reply') as replies
    FROM email_tracking et
    WHERE et.org_id = p_org_id
      AND et.tracked_date BETWEEN p_start_date AND p_end_date
    GROUP BY 1
  )
  SELECT 
    CASE p_interval
      WHEN 'day' THEN TO_CHAR(ds.period_date, 'YYYY-MM-DD')
      WHEN 'week' THEN TO_CHAR(ds.period_date, 'IYYY-IW')
      WHEN 'month' THEN TO_CHAR(ds.period_date, 'YYYY-MM')
      ELSE TO_CHAR(ds.period_date, 'YYYY-MM-DD')
    END as period,
    ds.period_date as period_start,
    COALESCE(ec.sent, 0)::BIGINT as emails_sent,
    COALESCE(tc.opens, 0)::BIGINT as emails_opened,
    COALESCE(tc.replies, ec.received, 0)::BIGINT as emails_replied,
    CASE WHEN COALESCE(ec.sent, 0) > 0 
      THEN ROUND((COALESCE(tc.opens, 0) * 100.0 / ec.sent), 1)
      ELSE 0 
    END as open_rate,
    CASE WHEN COALESCE(ec.sent, 0) > 0 
      THEN ROUND((COALESCE(tc.replies, ec.received, 0) * 100.0 / ec.sent), 1)
      ELSE 0 
    END as reply_rate
  FROM date_series ds
  LEFT JOIN email_counts ec ON ec.period_date = ds.period_date
  LEFT JOIN tracking_counts tc ON tc.period_date = ds.period_date
  ORDER BY ds.period_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get activity metrics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_activity_metrics(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_leads BIGINT,
  total_emails_sent BIGINT,
  total_emails_received BIGINT,
  total_tasks BIGINT,
  completed_tasks BIGINT,
  total_notes BIGINT,
  total_templates BIGINT,
  templates_used BIGINT
) AS $$
BEGIN
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM leads WHERE org_id = p_org_id AND created_at::DATE BETWEEN p_start_date AND p_end_date)::BIGINT,
    (SELECT COUNT(*) FROM email_messages WHERE org_id = p_org_id AND is_from_me = true AND sent_at::DATE BETWEEN p_start_date AND p_end_date AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM email_messages WHERE org_id = p_org_id AND is_from_me = false AND sent_at::DATE BETWEEN p_start_date AND p_end_date AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM tasks WHERE org_id = p_org_id AND created_at::DATE BETWEEN p_start_date AND p_end_date)::BIGINT,
    (SELECT COUNT(*) FROM tasks WHERE org_id = p_org_id AND status = 'completed' AND completed_at::DATE BETWEEN p_start_date AND p_end_date)::BIGINT,
    (SELECT COUNT(*) FROM notes WHERE org_id = p_org_id AND created_at::DATE BETWEEN p_start_date AND p_end_date)::BIGINT,
    (SELECT COUNT(*) FROM email_templates WHERE org_id = p_org_id)::BIGINT,
    (SELECT COUNT(*) FROM email_templates WHERE org_id = p_org_id AND times_used > 0)::BIGINT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get task completion metrics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_task_metrics_over_time(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_interval TEXT DEFAULT 'day'
)
RETURNS TABLE(
  period TEXT,
  period_start DATE,
  tasks_created BIGINT,
  tasks_completed BIGINT,
  tasks_overdue BIGINT,
  completion_rate NUMERIC
) AS $$
BEGIN
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date,
      p_end_date,
      CASE p_interval
        WHEN 'day' THEN '1 day'::INTERVAL
        WHEN 'week' THEN '1 week'::INTERVAL
        WHEN 'month' THEN '1 month'::INTERVAL
        ELSE '1 day'::INTERVAL
      END
    )::DATE as period_date
  )
  SELECT 
    CASE p_interval
      WHEN 'day' THEN TO_CHAR(ds.period_date, 'YYYY-MM-DD')
      WHEN 'week' THEN TO_CHAR(ds.period_date, 'IYYY-IW')
      WHEN 'month' THEN TO_CHAR(ds.period_date, 'YYYY-MM')
      ELSE TO_CHAR(ds.period_date, 'YYYY-MM-DD')
    END as period,
    ds.period_date as period_start,
    COUNT(CASE WHEN 
      CASE p_interval
        WHEN 'day' THEN t.created_at::DATE = ds.period_date
        WHEN 'week' THEN DATE_TRUNC('week', t.created_at)::DATE = ds.period_date
        WHEN 'month' THEN DATE_TRUNC('month', t.created_at)::DATE = ds.period_date
        ELSE t.created_at::DATE = ds.period_date
      END
    THEN 1 END)::BIGINT as tasks_created,
    COUNT(CASE WHEN t.status = 'completed' AND
      CASE p_interval
        WHEN 'day' THEN t.completed_at::DATE = ds.period_date
        WHEN 'week' THEN DATE_TRUNC('week', t.completed_at)::DATE = ds.period_date
        WHEN 'month' THEN DATE_TRUNC('month', t.completed_at)::DATE = ds.period_date
        ELSE t.completed_at::DATE = ds.period_date
      END
    THEN 1 END)::BIGINT as tasks_completed,
    COUNT(CASE WHEN t.due_date IS NOT NULL AND t.due_date::DATE < CURRENT_DATE AND t.status != 'completed'
      AND CASE p_interval
        WHEN 'day' THEN t.due_date::DATE = ds.period_date
        WHEN 'week' THEN DATE_TRUNC('week', t.due_date)::DATE = ds.period_date
        WHEN 'month' THEN DATE_TRUNC('month', t.due_date)::DATE = ds.period_date
        ELSE t.due_date::DATE = ds.period_date
      END
    THEN 1 END)::BIGINT as tasks_overdue,
    0::NUMERIC as completion_rate
  FROM date_series ds
  LEFT JOIN tasks t ON t.org_id = p_org_id
  GROUP BY ds.period_date
  ORDER BY ds.period_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get lead source distribution
-- ============================================================================
CREATE OR REPLACE FUNCTION get_lead_source_distribution(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  source TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  v_total BIGINT;
BEGIN
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  -- Get total
  SELECT COUNT(*) INTO v_total
  FROM leads l
  WHERE l.org_id = p_org_id
    AND l.created_at::DATE BETWEEN p_start_date AND p_end_date;
  
  RETURN QUERY
  SELECT 
    COALESCE(unnest(l.source), 'Unknown')::TEXT as source,
    COUNT(*)::BIGINT as count,
    CASE WHEN v_total > 0 
      THEN ROUND((COUNT(*) * 100.0 / v_total), 1)
      ELSE 0 
    END as percentage
  FROM leads l
  WHERE l.org_id = p_org_id
    AND l.created_at::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY COALESCE(unnest(l.source), 'Unknown')
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get conversion funnel
-- ============================================================================
CREATE OR REPLACE FUNCTION get_conversion_funnel(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  stage TEXT,
  count BIGINT,
  conversion_rate NUMERIC,
  stage_order INT
) AS $$
DECLARE
  v_total BIGINT;
  v_previous BIGINT;
BEGIN
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH funnel_data AS (
    SELECT 
      CASE l.status
        WHEN 'new' THEN 1
        WHEN 'contacted' THEN 2
        WHEN 'replied' THEN 3
        WHEN 'qualified' THEN 3
        WHEN 'meeting_scheduled' THEN 4
        WHEN 'proposal' THEN 5
        WHEN 'negotiation' THEN 6
        WHEN 'closed' THEN 7
        WHEN 'won' THEN 7
        WHEN 'lost' THEN 8
        ELSE 9
      END as stage_num,
      CASE l.status
        WHEN 'new' THEN 'New Leads'
        WHEN 'contacted' THEN 'Contacted'
        WHEN 'replied' THEN 'Replied'
        WHEN 'qualified' THEN 'Qualified'
        WHEN 'meeting_scheduled' THEN 'Meeting Scheduled'
        WHEN 'proposal' THEN 'Proposal'
        WHEN 'negotiation' THEN 'Negotiation'
        WHEN 'closed' THEN 'Won'
        WHEN 'won' THEN 'Won'
        WHEN 'lost' THEN 'Lost'
        ELSE 'Other'
      END as stage_name,
      COUNT(*) as cnt
    FROM leads l
    WHERE l.org_id = p_org_id
      AND l.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY l.status
  ),
  ordered_funnel AS (
    SELECT 
      stage_name,
      stage_num,
      SUM(cnt) as count
    FROM funnel_data
    WHERE stage_num <= 7
    GROUP BY stage_name, stage_num
  ),
  with_totals AS (
    SELECT 
      stage_name,
      stage_num,
      count,
      FIRST_VALUE(count) OVER (ORDER BY stage_num) as first_stage_count,
      LAG(count) OVER (ORDER BY stage_num) as prev_count
    FROM ordered_funnel
  )
  SELECT 
    stage_name::TEXT as stage,
    count::BIGINT,
    CASE 
      WHEN first_stage_count > 0 THEN ROUND((count * 100.0 / first_stage_count), 1)
      ELSE 0 
    END::NUMERIC as conversion_rate,
    stage_num::INT as stage_order
  FROM with_totals
  ORDER BY stage_num;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

-- Analytics events
DROP POLICY IF EXISTS "Users can view analytics_events in their organizations" ON analytics_events;
CREATE POLICY "Users can view analytics_events in their organizations" 
  ON analytics_events FOR SELECT 
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert analytics_events in their organizations" ON analytics_events;
CREATE POLICY "Users can insert analytics_events in their organizations" 
  ON analytics_events FOR INSERT 
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Email tracking
DROP POLICY IF EXISTS "Users can view email_tracking in their organizations" ON email_tracking;
CREATE POLICY "Users can view email_tracking in their organizations" 
  ON email_tracking FOR SELECT 
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert email_tracking in their organizations" ON email_tracking;
CREATE POLICY "Users can insert email_tracking in their organizations" 
  ON email_tracking FOR INSERT 
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Lead status history
DROP POLICY IF EXISTS "Users can view lead_status_history in their organizations" ON lead_status_history;
CREATE POLICY "Users can view lead_status_history in their organizations" 
  ON lead_status_history FOR SELECT 
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_lead_funnel_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_leads_over_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_metrics_over_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_task_metrics_over_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_source_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversion_funnel TO authenticated;
