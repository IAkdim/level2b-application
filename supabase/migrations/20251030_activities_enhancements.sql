-- ============================================================================
-- Activities System Enhancements
-- Adds indexes and helper functions for org-wide activities feed
-- ============================================================================

-- ============================================================================
-- PART 1: ADDITIONAL INDEXES FOR ACTIVITIES
-- ============================================================================

-- Index on created_by for filtering activities by user
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);

-- Index on scheduled_at for scheduled/future activities
CREATE INDEX IF NOT EXISTS idx_activities_scheduled_at ON activities(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Composite index for org + created_at (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_activities_org_created ON activities(org_id, created_at DESC);

-- ============================================================================
-- PART 2: HELPER FUNCTIONS FOR ACTIVITIES
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
-- PART 3: UPDATE DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_recent_org_activities IS 'Returns recent activities across organization with lead and creator info for activity feed';
COMMENT ON FUNCTION get_org_activity_stats IS 'Returns activity statistics by type for an organization within a date range';
COMMENT ON FUNCTION get_scheduled_activities IS 'Returns upcoming scheduled activities for an organization';

COMMENT ON INDEX idx_activities_created_by IS 'Index for filtering activities by creator/user';
COMMENT ON INDEX idx_activities_scheduled_at IS 'Index for querying scheduled/future activities';
COMMENT ON INDEX idx_activities_org_created IS 'Composite index for org-wide activity feed queries';

-- ============================================================================
-- COMPLETE! Activities system is now enhanced with:
-- - Improved indexes for performance
-- - Helper functions for org-wide activity feed
-- - Activity statistics and scheduled activities support
-- ============================================================================
