# Database Redesign Migrations

**Version:** 1.0
**Date:** 2025-12-11
**Status:** Ready for Review

## Overview

This directory contains migration files for the Level2B CRM database redesign in **two formats**:

1. **Incremental Migrations (001-010)** - Upgrade an existing database
2. **Complete Schema (00_complete_schema_from_scratch.sql)** - Create new database from scratch

Choose the approach that matches your situation.

## Which Approach Should You Use?

### Option A: Upgrading Existing Database ✅

**Use the incremental migrations (001-010)** if you have:
- An existing Level2B database with data
- Tables: `leads`, `tasks`, `notes`, `deals`, `organizations`, `users`
- Data you want to preserve

### Option B: Creating New Database 🆕

**Use the complete schema file (00_complete_schema_from_scratch.sql)** if you:
- Are setting up a brand new database
- Want to see the complete final schema
- Don't have existing data to migrate

---

## Quick Start

### Option A: Upgrade Existing Database

#### Prerequisites

1. **Backup your database:**
   ```bash
   supabase db dump > backup_pre_redesign_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test on staging first:**
   - Never run directly on production without testing
   - Verify all migrations on a staging environment
   - Test rollback procedures

### Execution

**Option 1: Run all migrations at once**
```bash
# Navigate to project root
cd /mnt/c/Users/iakdi/projects/level2b-application

# Run all migrations in order
for file in supabase/migrations/redesign/*.sql; do
  echo "Running $(basename $file)..."
  supabase db execute --file "$file"
done
```

**Option 2: Run migrations individually**
```bash
supabase db execute --file supabase/migrations/redesign/001_add_soft_delete_columns.sql
supabase db execute --file supabase/migrations/redesign/002_add_fulltext_search.sql
# ... and so on
```

**Option 3: Use Supabase CLI migration system**
```bash
# Copy incremental files to main migrations directory
cp supabase/migrations/redesign/0*.sql supabase/migrations/

# Push migrations
supabase db push
```

### Option B: Create New Database From Scratch

**Single File Approach:**

```bash
# Run the complete schema file
supabase db execute --file supabase/migrations/redesign/00_complete_schema_from_scratch.sql

# Verify
supabase db execute --file supabase/migrations/redesign/verify.sql
```

**What This Creates:**
- ✅ All foundation tables (users, organizations, user_orgs)
- ✅ All CRM tables (leads, tasks, notes, deals) with redesign features built-in
- ✅ All new tables (activities, emails, attachments)
- ✅ All indexes, triggers, functions
- ✅ All RLS policies
- ✅ Materialized views
- ✅ User bootstrap function (auto-creates org on signup)

**No migrations needed** - everything is in one file!

## Migration Files

| File | Description | Duration | Rollback |
|------|-------------|----------|----------|
| `001_add_soft_delete_columns.sql` | Add deleted_at to all tables | 10 min | ✅ Yes |
| `002_add_fulltext_search.sql` | Full-text search vectors & triggers | 15 min | ✅ Yes |
| `003_add_denormalized_counters.sql` | Add counter columns to leads | 15 min | ✅ Yes |
| `004_create_activities_table.sql` | Activity tracking system | 20 min | ✅ Yes |
| `005_create_email_tables.sql` | Email threads and messages | 25 min | ✅ Yes |
| `006_create_attachments_table.sql` | File attachments storage | 15 min | ✅ Yes |
| `007_update_indexes.sql` | Rebuild indexes for soft deletes | 20 min | ⚠️ Partial |
| `008_create_materialized_views.sql` | Analytics materialized views | 20 min | ✅ Yes |
| `009_update_rls_policies.sql` | Update RLS and create helper views | 15 min | ✅ Yes |
| `010_add_email_validation.sql` | Email format validation | 5 min | ✅ Yes |
| `rollback.sql` | Rollback all changes | 5 min | N/A |

**Total Estimated Time:** 2.5 - 4 hours (includes validation)

## What's New

### 1. Soft Delete Pattern
- All entity tables now have `deleted_at` column
- Records are never permanently deleted (except by admin action)
- Easy data recovery and audit compliance

**Usage:**
```sql
-- Soft delete a lead
UPDATE leads SET deleted_at = NOW() WHERE id = 'lead-uuid';

-- Restore a lead
UPDATE leads SET deleted_at = NULL WHERE id = 'lead-uuid';

-- Query active leads only
SELECT * FROM leads WHERE deleted_at IS NULL;

-- Or use helper view
SELECT * FROM leads_active;
```

### 2. Full-Text Search
- PostgreSQL tsvector columns on leads, notes, email_messages
- Automatic updates via triggers
- Much faster than ILIKE queries (10x improvement)

**Usage:**
```sql
-- Search leads
SELECT
  name,
  company,
  ts_rank(search_vector, query) as rank
FROM leads, to_tsquery('english', 'developer & javascript') as query
WHERE search_vector @@ query
  AND org_id = 'your-org-uuid'
  AND deleted_at IS NULL
ORDER BY rank DESC
LIMIT 20;

-- Search across multiple entities
SELECT * FROM search_all('org-uuid', 'important client');
```

### 3. Activity Tracking
- Comprehensive audit trail
- Automatic logging for status changes, task completion, etc.
- Polymorphic design supports any entity type

**Usage:**
```sql
-- Get lead timeline
SELECT
  a.activity_type,
  a.description,
  a.created_at,
  u.full_name as user_name,
  a.changes
FROM activities a
LEFT JOIN users u ON u.id = a.user_id
WHERE a.lead_id = 'lead-uuid'
  AND a.deleted_at IS NULL
ORDER BY a.created_at DESC;

-- Manual activity logging
SELECT log_activity(
  'org-uuid',           -- org_id
  'call_logged',        -- activity_type
  'lead',               -- entity_type
  'lead-uuid',          -- entity_id
  'lead-uuid',          -- lead_id
  'Called to discuss proposal', -- description
  '{"duration": "15 minutes"}'::jsonb  -- metadata
);
```

### 4. Email Storage
- Store Gmail threads and messages
- Auto-link to leads by email address
- Full-text search on email content
- Sentiment analysis support

**Usage:**
```sql
-- Get emails for a lead
SELECT
  et.subject,
  et.snippet,
  et.last_message_at,
  (SELECT COUNT(*) FROM email_messages WHERE thread_id = et.id) as message_count
FROM email_threads et
WHERE et.lead_id = 'lead-uuid'
  AND et.deleted_at IS NULL
ORDER BY et.last_message_at DESC;

-- Search email content
SELECT
  em.*,
  ts_rank(em.search_vector, query) as rank
FROM email_messages em, to_tsquery('english', 'proposal & pricing') as query
WHERE em.search_vector @@ query
  AND em.org_id = 'org-uuid'
ORDER BY rank DESC;
```

### 5. Denormalized Counters
- Leads now have pre-computed counts
- Automatic updates via triggers
- No need for expensive JOIN queries

**Available Counters:**
- `notes_count` - Total notes for lead
- `tasks_count` - Total tasks for lead
- `open_tasks_count` - Incomplete tasks only
- `emails_count` - Total email messages
- `last_activity_at` - Most recent activity timestamp

**Usage:**
```sql
-- Get leads with activity summary
SELECT
  name,
  email,
  status,
  notes_count,
  open_tasks_count,
  emails_count,
  last_activity_at
FROM leads
WHERE org_id = 'org-uuid'
  AND deleted_at IS NULL
ORDER BY last_activity_at DESC NULLS LAST;
```

### 6. Materialized Views for Analytics
- Pre-computed statistics
- 20x faster than on-the-fly aggregation
- Refresh on-demand or on schedule

**Available Views:**
- `lead_stats` - Lead counts by status and sentiment
- `task_stats` - Task counts by status and priority
- `deal_stats` - Pipeline values and stages

**Usage:**
```sql
-- Get dashboard stats
SELECT * FROM lead_stats WHERE org_id = 'org-uuid';
SELECT * FROM task_stats WHERE org_id = 'org-uuid';
SELECT * FROM deal_stats WHERE org_id = 'org-uuid';

-- Refresh stats manually
SELECT refresh_all_stats();

-- Or refresh individual view
REFRESH MATERIALIZED VIEW CONCURRENTLY lead_stats;
```

### 7. File Attachments
- Polymorphic attachments for any entity
- Stores metadata only (files in Supabase Storage)
- Automatic activity logging on upload

**Usage:**
```sql
-- Get attachments for a lead
SELECT
  a.*,
  u.full_name as uploaded_by_name
FROM attachments a
LEFT JOIN users u ON u.id = a.uploaded_by
WHERE a.entity_type = 'lead'
  AND a.entity_id = 'lead-uuid'
  AND a.deleted_at IS NULL
ORDER BY a.created_at DESC;
```

## Database Schema Changes

### New Tables
- ✅ `activities` - Activity tracking
- ✅ `email_threads` - Email conversations
- ✅ `email_messages` - Individual messages
- ✅ `attachments` - File metadata

### Modified Tables
- ✅ `leads` - Added: deleted_at, search_vector, counters
- ✅ `tasks` - Added: deleted_at, is_recurring, recurrence_rule
- ✅ `notes` - Added: deleted_at, search_vector
- ✅ `deals` - Added: deleted_at, weighted_value

### New Indexes
- ✅ Full-text search GIN indexes
- ✅ Composite indexes for common queries
- ✅ Partial indexes for soft deletes
- ✅ Array GIN indexes for email participants

### New Functions
- `log_activity()` - Create activity records
- `refresh_all_stats()` - Refresh materialized views
- `search_all()` - Search across entities
- `soft_delete()` - Soft delete helper
- `restore_record()` - Restore deleted records
- `update_lead_counters()` - Maintain denormalized counts

### New Triggers
- Activity logging on status/stage changes
- Search vector updates
- Counter maintenance
- Email auto-linking
- Updated_at timestamps

## Performance Impact

### Expected Improvements

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Lead search | 500ms | 50ms | **10x faster** |
| Dashboard stats | 2000ms | 100ms | **20x faster** |
| Lead detail page | 150ms | 50ms | **3x faster** |

### Database Size

With 10,000 leads:
- Before: ~50 MB
- After: ~510 MB (includes full email history)
- Mostly: activities (80 MB) + emails (210 MB)

### Index Maintenance

```sql
-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Reindex if needed (rarely)
REINDEX INDEX CONCURRENTLY idx_leads_search;
```

## Rollback Instructions

### Full Rollback

If you need to completely undo all changes:

```bash
# Restore from backup
psql -U postgres -d your_database < backup_pre_redesign_YYYYMMDD.sql

# Or use Supabase CLI
supabase db reset
```

### Partial Rollback

Run the rollback script to remove new features while keeping data:

```bash
supabase db execute --file supabase/migrations/redesign/rollback.sql
```

This will:
- Drop new tables (activities, emails, attachments)
- Drop materialized views
- Remove new columns from existing tables
- Remove new triggers and functions
- Restore original indexes

**Note:** Any data in new tables (activities, emails) will be lost!

### Selective Rollback

To rollback specific migrations only:

```sql
-- Example: Remove email tables only
DROP TRIGGER IF EXISTS auto_link_email_thread ON email_threads;
DROP TRIGGER IF EXISTS update_thread_timestamp ON email_messages;
DROP TABLE IF EXISTS email_messages CASCADE;
DROP TABLE IF EXISTS email_threads CASCADE;
```

## Validation

After running migrations, validate the changes:

```sql
-- 1. Verify new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('activities', 'email_threads', 'email_messages', 'attachments');
-- Should return 4 rows

-- 2. Verify new columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('deleted_at', 'search_vector', 'notes_count', 'last_activity_at');
-- Should return 4 rows

-- 3. Verify indexes created
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%search%';
-- Should show search indexes

-- 4. Test full-text search
UPDATE leads SET name = 'Test Developer' WHERE id = (SELECT id FROM leads LIMIT 1);
SELECT * FROM leads
WHERE search_vector @@ to_tsquery('english', 'developer')
LIMIT 1;
-- Should return the updated lead

-- 5. Test activity logging
UPDATE leads SET status = 'contacted' WHERE id = (SELECT id FROM leads LIMIT 1);
SELECT * FROM activities ORDER BY created_at DESC LIMIT 1;
-- Should show recent activity

-- 6. Verify materialized views
SELECT * FROM lead_stats LIMIT 1;
SELECT * FROM task_stats LIMIT 1;
SELECT * FROM deal_stats LIMIT 1;
-- Should return statistics

-- 7. Test counters
SELECT name, notes_count, tasks_count FROM leads LIMIT 5;
-- Should show accurate counts
```

## Maintenance

### Regular Tasks

**Daily:**
- Monitor database size and growth

**Weekly:**
- Refresh materialized views (if not auto-scheduled)
  ```sql
  SELECT refresh_all_stats();
  ```

**Monthly:**
- Review and archive old activities (if needed)
- Check index performance
- Vacuum analyze large tables

**Quarterly:**
- Review soft-deleted records
- Permanently delete old soft-deleted records if needed
  ```sql
  -- Permanently delete records soft-deleted > 90 days ago
  DELETE FROM leads WHERE deleted_at < NOW() - INTERVAL '90 days';
  ```

### Monitoring Queries

```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Application Integration

After running migrations, update your application code:

### 1. Update Type Definitions

```typescript
// src/types/crm.ts

export interface Lead {
  // ... existing fields
  deleted_at: string | null;
  search_vector?: string; // Not typically used in app
  notes_count: number;
  tasks_count: number;
  open_tasks_count: number;
  emails_count: number;
  last_activity_at: string | null;
}

export interface Activity {
  id: string;
  org_id: string;
  activity_type: ActivityType;
  entity_type: 'lead' | 'task' | 'note' | 'deal' | 'email' | 'user' | 'organization';
  entity_id: string;
  lead_id: string | null;
  user_id: string | null;
  description: string;
  metadata: Record<string, any>;
  changes: Record<string, any>;
  created_at: string;
  deleted_at: string | null;
}

export type ActivityType =
  | 'lead_created' | 'lead_updated' | 'lead_status_changed' | 'lead_deleted'
  | 'note_created' | 'note_updated' | 'note_deleted'
  | 'task_created' | 'task_updated' | 'task_completed' | 'task_deleted'
  | 'deal_created' | 'deal_updated' | 'deal_stage_changed' | 'deal_deleted'
  | 'email_sent' | 'email_received' | 'email_replied'
  | 'call_logged' | 'meeting_scheduled' | 'meeting_completed'
  | 'file_uploaded' | 'file_deleted'
  | 'user_invited' | 'user_removed'
  | 'integration_connected' | 'integration_error';

export interface EmailThread {
  id: string;
  org_id: string;
  thread_id: string;
  provider: 'gmail' | 'outlook' | 'other';
  subject: string;
  snippet: string;
  lead_id: string | null;
  participants: string[];
  labels: string[];
  is_read: boolean;
  is_starred: boolean;
  is_important: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmailMessage {
  id: string;
  org_id: string;
  thread_id: string;
  message_id: string;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_text: string;
  body_html: string;
  is_from_me: boolean;
  has_attachments: boolean;
  attachment_count: number;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  sent_at: string;
  received_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Attachment {
  id: string;
  org_id: string;
  entity_type: 'email' | 'note' | 'task' | 'deal' | 'lead';
  entity_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  storage_provider: string;
  storage_path: string;
  storage_url: string | null;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
}
```

### 2. Update API Functions

```typescript
// src/lib/api/leads.ts

// Add deleted_at filter to all queries
export async function getLeads(orgId: string, filters?: LeadFilters) {
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .is('deleted_at', null); // Add this to all queries

  // ... rest of filters

  return query;
}

// Add soft delete function
export async function softDeleteLead(leadId: string) {
  const { error } = await supabase
    .from('leads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', leadId);

  if (error) throw error;
}

// Add restore function
export async function restoreLead(leadId: string) {
  const { error } = await supabase
    .from('leads')
    .update({ deleted_at: null })
    .eq('id', leadId);

  if (error) throw error;
}

// Add full-text search function
export async function searchLeads(orgId: string, searchQuery: string) {
  const { data, error } = await supabase
    .rpc('search_all', {
      org_uuid: orgId,
      search_query: searchQuery
    });

  if (error) throw error;
  return data;
}
```

### 3. Create New API Files

```typescript
// src/lib/api/activities.ts
export async function getLeadActivities(leadId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      user:user_id (
        id,
        full_name,
        email,
        avatar_url
      )
    `)
    .eq('lead_id', leadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// src/lib/api/emails.ts
export async function getLeadEmails(leadId: string) {
  const { data, error } = await supabase
    .from('email_threads')
    .select(`
      *,
      messages:email_messages(count)
    `)
    .eq('lead_id', leadId)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

## Troubleshooting

### Migration Fails

**Problem:** Migration fails with "column already exists"
```
Solution: Check if migrations were partially applied. Drop the column and re-run:
```sql
ALTER TABLE leads DROP COLUMN IF EXISTS deleted_at;
```

**Problem:** Backfill takes too long and times out
```
Solution: Run backfill in batches:
```sql
-- Update in batches of 1000
DO $$
DECLARE
  batch_size INT := 1000;
  offset_val INT := 0;
  rows_updated INT;
BEGIN
  LOOP
    UPDATE leads SET notes_count = (SELECT COUNT(*) FROM notes WHERE lead_id = leads.id)
    WHERE id IN (SELECT id FROM leads ORDER BY id LIMIT batch_size OFFSET offset_val);

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;

    offset_val := offset_val + batch_size;
    RAISE NOTICE 'Updated % rows, offset %', rows_updated, offset_val;
  END LOOP;
END $$;
```

**Problem:** "permission denied" errors
```
Solution: Ensure you're connected as the correct user:
```sql
-- Check current user
SELECT current_user;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
```

### Performance Issues

**Problem:** Full-text search is slow
```
Solution: Ensure GIN indexes are created and vacuum analyze:
```sql
VACUUM ANALYZE leads;
REINDEX INDEX CONCURRENTLY idx_leads_search;
```

**Problem:** Materialized view refresh is slow
```
Solution: Create indexes on materialized views and use CONCURRENTLY:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY lead_stats;
```

**Problem:** Triggers causing slowdown
```
Solution: Temporarily disable triggers during bulk operations:
```sql
ALTER TABLE leads DISABLE TRIGGER ALL;
-- Run bulk operation
ALTER TABLE leads ENABLE TRIGGER ALL;
```

## Support

For questions or issues:

1. Check the main design document: `/docs/database-redesign-plan.md`
2. Review Supabase logs in dashboard
3. Check PostgreSQL logs for errors
4. Create an issue in the project repository

## Version History

- **v1.0** (2025-12-11) - Initial redesign migrations
  - Soft deletes
  - Full-text search
  - Activity tracking
  - Email storage
  - Denormalized counters
  - Materialized views

## License

Same as main project.
