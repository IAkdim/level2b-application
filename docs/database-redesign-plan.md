# Database Redesign Plan - Level2B CRM Application

**Document Version:** 1.0
**Date:** 2025-12-11
**Status:** Draft - Awaiting Approval

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Design Goals and Principles](#design-goals-and-principles)
4. [Proposed Database Schema](#proposed-database-schema)
5. [Entity Relationship Diagram](#entity-relationship-diagram)
6. [Schema Changes Detail](#schema-changes-detail)
7. [Migration Strategy](#migration-strategy)
8. [Step-by-Step Implementation Plan](#step-by-step-implementation-plan)
9. [Risk Assessment](#risk-assessment)
10. [Rollback Strategy](#rollback-strategy)
11. [Performance Considerations](#performance-considerations)
12. [Testing Strategy](#testing-strategy)

---

## Executive Summary

This document outlines a comprehensive plan to redesign the database schema for the Level2B CRM application. The redesign addresses critical gaps in the current implementation while maintaining backward compatibility where possible.

### Key Improvements

1. **Activity Tracking** - Restore comprehensive audit trail with improved design
2. **Email Integration** - Add persistent storage for email communications
3. **Data Safety** - Implement soft deletes across all tables
4. **Search Performance** - Add full-text search capabilities
5. **Analytics** - Denormalized counters and materialized views
6. **Data Integrity** - Enhanced constraints and validation

### Impact Assessment

- **Estimated Migration Time:** 2-4 hours for execution + testing
- **Downtime Required:** Minimal (< 5 minutes for critical operations)
- **Data Loss Risk:** Low (all migrations reversible)
- **Breaking Changes:** None for existing queries
- **New Features Enabled:** Activity timeline, email storage, advanced search

---

## Current State Analysis

### Technology Stack

- **Database:** PostgreSQL 15+ (via Supabase)
- **Access Pattern:** Supabase JavaScript Client
- **State Management:** TanStack Query (React Query)
- **Security:** Row-Level Security (RLS) enabled on all tables

### Existing Tables

| Table | Purpose | Status | Issues |
|-------|---------|--------|--------|
| `users` | User profiles | ✅ Good | None |
| `organizations` | Multi-tenant workspaces | ✅ Good | None |
| `user_orgs` | User-org membership | ✅ Good | None |
| `leads` | Contact management | ⚠️ Needs improvement | No full-text search, hard deletes |
| `tasks` | Task management | ⚠️ Needs improvement | Hard deletes, no soft-delete |
| `notes` | Lead notes | ⚠️ Needs improvement | Hard deletes |
| `deals` | Sales pipeline | ⚠️ Needs improvement | Hard deletes |
| `activities` | Activity tracking | ❌ Removed | Completely deleted in recent migration |

### Critical Gaps Identified

1. **No Activity Tracking** - Activities table was removed, leaving no audit trail
2. **No Email Storage** - Gmail integration exists but emails aren't persisted
3. **Hard Deletes** - All deletes are permanent, risking data loss
4. **Limited Search** - Uses ILIKE queries instead of full-text search
5. **No Analytics Tables** - Statistics calculated on-the-fly
6. **Missing Attachments** - No file/attachment storage

---

## Design Goals and Principles

### Primary Goals

1. **Maintain Multi-Tenancy** - All data remains organization-scoped
2. **Preserve RLS Security** - Row-level security on all tables
3. **Backward Compatibility** - Existing queries continue to work
4. **Improve Performance** - Better indexes, denormalization, caching
5. **Enable Future Features** - Extensible schema for email, attachments, integrations

### Design Principles

1. **Audit Everything** - Comprehensive activity tracking
2. **Never Lose Data** - Soft deletes by default
3. **Search First** - Full-text search on all relevant text fields
4. **Denormalize for Performance** - Add computed columns and counters
5. **JSONB for Flexibility** - Use JSONB for extensible data
6. **Explicit is Better** - Prefer constraints over application logic

---

## Proposed Database Schema

### New Tables

#### 1. `activities` (Redesigned)

Comprehensive activity tracking with polymorphic relationships.

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'lead_created', 'lead_updated', 'lead_status_changed', 'lead_deleted',
    'note_created', 'note_updated', 'note_deleted',
    'task_created', 'task_updated', 'task_completed', 'task_deleted',
    'deal_created', 'deal_updated', 'deal_stage_changed', 'deal_deleted',
    'email_sent', 'email_received', 'email_replied',
    'call_logged', 'meeting_scheduled', 'meeting_completed',
    'file_uploaded', 'file_deleted',
    'user_invited', 'user_removed',
    'integration_connected', 'integration_error'
  )),

  -- Polymorphic relationship
  entity_type TEXT CHECK (entity_type IN ('lead', 'task', 'note', 'deal', 'email', 'user', 'organization')),
  entity_id UUID,

  -- Related lead (denormalized for easy filtering)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Activity metadata
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Changes tracking (before/after states)
  changes JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_activities_org_id ON activities(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_lead_id ON activities(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_user_id ON activities(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_type ON activities(activity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_created_at ON activities(created_at DESC) WHERE deleted_at IS NULL;
```

**Design Rationale:**
- Polymorphic design allows tracking any entity type
- `lead_id` denormalized for efficient lead timeline queries
- `changes` JSONB stores before/after states for audit
- Soft delete support with filtered indexes

#### 2. `email_threads`

Store email conversations linked to leads.

```sql
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Gmail/Email provider details
  thread_id TEXT NOT NULL, -- External thread ID (Gmail thread ID)
  provider TEXT NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook', 'other')),

  -- Thread metadata
  subject TEXT,
  snippet TEXT, -- First few lines for preview

  -- Related lead (can be null if not yet linked)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Participants (array of email addresses)
  participants TEXT[] NOT NULL DEFAULT '{}',

  -- Labels/tags
  labels TEXT[] DEFAULT '{}',

  -- Status
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,

  -- Timestamps
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Prevent duplicate threads per org
  CONSTRAINT unique_thread_per_org UNIQUE(org_id, provider, thread_id)
);

-- Indexes
CREATE INDEX idx_email_threads_org_id ON email_threads(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_lead_id ON email_threads(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_last_message ON email_threads(last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_participants_gin ON email_threads USING GIN(participants) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_labels_gin ON email_threads USING GIN(labels) WHERE deleted_at IS NULL;
```

#### 3. `email_messages`

Individual messages within threads.

```sql
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,

  -- Gmail/Email provider details
  message_id TEXT NOT NULL, -- External message ID

  -- Message details
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',

  subject TEXT,
  body_text TEXT, -- Plain text version
  body_html TEXT, -- HTML version

  -- Message metadata
  is_from_me BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,

  -- Sentiment analysis (can be computed async)
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Prevent duplicates
  CONSTRAINT unique_message_per_org UNIQUE(org_id, message_id)
);

-- Indexes
CREATE INDEX idx_email_messages_org_id ON email_messages(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_sent_at ON email_messages(sent_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_from ON email_messages(from_email) WHERE deleted_at IS NULL;

-- Full-text search on email content
ALTER TABLE email_messages ADD COLUMN search_vector tsvector;
CREATE INDEX idx_email_messages_search ON email_messages USING GIN(search_vector) WHERE deleted_at IS NULL;
```

#### 4. `attachments`

File attachments for emails, notes, tasks, etc.

```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Polymorphic relationship (attached to email, note, task, etc.)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('email', 'note', 'task', 'deal', 'lead')),
  entity_id UUID NOT NULL,

  -- File details
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- bytes

  -- Storage location (Supabase Storage, S3, etc.)
  storage_provider TEXT NOT NULL DEFAULT 'supabase',
  storage_path TEXT NOT NULL,
  storage_url TEXT, -- Public URL if applicable

  -- Upload metadata
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_attachments_org_id ON attachments(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by) WHERE deleted_at IS NULL;
```

#### 5. `lead_stats` (Materialized View)

Pre-computed statistics for dashboard performance.

```sql
CREATE MATERIALIZED VIEW lead_stats AS
SELECT
  org_id,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_leads,
  COUNT(*) FILTER (WHERE status = 'new' AND deleted_at IS NULL) as new_leads,
  COUNT(*) FILTER (WHERE status = 'contacted' AND deleted_at IS NULL) as contacted_leads,
  COUNT(*) FILTER (WHERE status = 'replied' AND deleted_at IS NULL) as replied_leads,
  COUNT(*) FILTER (WHERE status = 'meeting_scheduled' AND deleted_at IS NULL) as scheduled_leads,
  COUNT(*) FILTER (WHERE status = 'closed' AND deleted_at IS NULL) as closed_leads,
  COUNT(*) FILTER (WHERE status = 'lost' AND deleted_at IS NULL) as lost_leads,
  COUNT(*) FILTER (WHERE sentiment = 'positive' AND deleted_at IS NULL) as positive_sentiment,
  COUNT(*) FILTER (WHERE sentiment = 'neutral' AND deleted_at IS NULL) as neutral_sentiment,
  COUNT(*) FILTER (WHERE sentiment = 'negative' AND deleted_at IS NULL) as negative_sentiment,
  MAX(created_at) as last_lead_created_at,
  MAX(updated_at) as last_lead_updated_at
FROM leads
GROUP BY org_id;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_lead_stats_org_id ON lead_stats(org_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_lead_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY lead_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Modified Existing Tables

#### Update `leads` table

```sql
-- Add soft delete
ALTER TABLE leads ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add full-text search
ALTER TABLE leads ADD COLUMN search_vector tsvector;

-- Add denormalized counters
ALTER TABLE leads ADD COLUMN notes_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN tasks_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN open_tasks_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN emails_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN last_activity_at TIMESTAMPTZ;

-- Add better email validation
ALTER TABLE leads ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Update indexes to respect soft delete
DROP INDEX IF EXISTS idx_leads_org_id;
CREATE INDEX idx_leads_org_id ON leads(org_id) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_leads_status;
CREATE INDEX idx_leads_status ON leads(status) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_leads_email;
CREATE INDEX idx_leads_email ON leads(email) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_leads_created_at;
CREATE INDEX idx_leads_created_at ON leads(created_at DESC) WHERE deleted_at IS NULL;

-- Composite index for common queries
CREATE INDEX idx_leads_org_status_created ON leads(org_id, status, created_at DESC) WHERE deleted_at IS NULL;

-- Full-text search index
CREATE INDEX idx_leads_search ON leads USING GIN(search_vector) WHERE deleted_at IS NULL;
```

#### Update `tasks` table

```sql
-- Add soft delete
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add recurrence support
ALTER TABLE tasks ADD COLUMN is_recurring BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN recurrence_rule JSONB; -- iCal RRULE format

-- Update indexes
DROP INDEX IF EXISTS idx_tasks_org_id;
CREATE INDEX idx_tasks_org_id ON tasks(org_id) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_tasks_status;
CREATE INDEX idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_tasks_due_date;
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL AND status != 'completed';

-- Composite index for task lists
CREATE INDEX idx_tasks_org_status_due ON tasks(org_id, status, due_date) WHERE deleted_at IS NULL;
```

#### Update `notes` table

```sql
-- Add soft delete
ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add full-text search
ALTER TABLE notes ADD COLUMN search_vector tsvector;

-- Update indexes
DROP INDEX IF EXISTS idx_notes_lead_id;
CREATE INDEX idx_notes_lead_id ON notes(lead_id) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_notes_org_id;
CREATE INDEX idx_notes_org_id ON notes(org_id) WHERE deleted_at IS NULL;

-- Full-text search
CREATE INDEX idx_notes_search ON notes USING GIN(search_vector) WHERE deleted_at IS NULL;
```

#### Update `deals` table

```sql
-- Add soft delete
ALTER TABLE deals ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add weighted probability calculation
ALTER TABLE deals ADD COLUMN weighted_value DECIMAL(15,2) GENERATED ALWAYS AS (value * probability / 100) STORED;

-- Update indexes
DROP INDEX IF EXISTS idx_deals_org_id;
CREATE INDEX idx_deals_org_id ON deals(org_id) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_deals_stage;
CREATE INDEX idx_deals_stage ON deals(stage) WHERE deleted_at IS NULL;

-- Composite index for pipeline view
CREATE INDEX idx_deals_org_stage_close ON deals(org_id, stage, expected_close_date) WHERE deleted_at IS NULL;
```

---

## Entity Relationship Diagram

```
┌─────────────────┐
│  auth.users     │
│  (Supabase)     │
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────┐       ┌──────────────────┐
│  public.users   │◄──────┤  user_orgs       │
│  - id (PK)      │       │  - user_id (FK)  │
│  - email        │  M:N  │  - org_id (FK)   │
│  - full_name    │──────►│  - role          │
│  - avatar_url   │       └────────┬─────────┘
│  - metadata     │                │
│  - deleted_at   │                │ M:1
└─────────────────┘                ▼
                          ┌──────────────────┐
                          │  organizations   │
                          │  - id (PK)       │
                          │  - name          │
                          │  - slug (unique) │
                          │  - settings      │
                          │  - deleted_at    │
                          └────────┬─────────┘
                                   │ org_id (1:M)
                   ┌───────────────┼──────────────────┬──────────────┐
                   ▼               ▼                  ▼              ▼
          ┌────────────────┐ ┌──────────┐    ┌──────────────┐ ┌──────────────┐
          │     leads      │ │  tasks   │    │ email_threads│ │  activities  │
          │  - id (PK)     │ │          │    │              │ │              │
          │  - name        │ └────┬─────┘    └──────┬───────┘ │  - polymorphic
          │  - email       │      │                 │         │    entity link│
          │  - status      │      │ lead_id         │ lead_id │  - lead_id    │
          │  - sentiment   │      │ (optional)      │ (opt)   │  - user_id    │
          │  - source[]    │◄─────┤                 │         │  - changes    │
          │  - notes_count │      │                 │         │  - metadata   │
          │  - tasks_count │      │                 │         └───────────────┘
          │  - emails_count│      │                 │
          │  - last_activity│     │                 │
          │  - search_vector│     │                 │
          │  - deleted_at  │      │                 ▼
          └────────┬───────┘      │        ┌─────────────────┐
                   │              │        │ email_messages  │
                   │ lead_id (1:M)│        │  - thread_id(FK)│
          ┌────────┼──────────────┼────────┤  - from_email   │
          ▼        ▼              ▼        │  - body_text    │
     ┌────────┐ ┌──────┐    ┌──────────┐  │  - body_html    │
     │ notes  │ │deals │    │attachments  │  - sentiment    │
     │        │ │      │    │ - polymorphic  - search_vector│
     └────────┘ └──────┘    │   entity link│  - deleted_at   │
                            │ - filename  │ └─────────────────┘
                            │ - storage   │
                            └─────────────┘

                      ┌────────────────────┐
                      │  lead_stats (MV)   │
                      │  - org_id          │
                      │  - total_leads     │
                      │  - new_leads       │
                      │  - contacted_leads │
                      │  - status breakdown│
                      └────────────────────┘
```

---

## Schema Changes Detail

### 1. Soft Delete Pattern

**Change:** Add `deleted_at TIMESTAMPTZ` to all entity tables

**Affected Tables:**
- `leads`
- `tasks`
- `notes`
- `deals`
- `activities`
- `email_threads`
- `email_messages`
- `attachments`

**Benefits:**
- Accidental deletes can be recovered
- Maintains referential integrity
- Audit trail preserved
- Compliance requirements met

**Implementation:**
```sql
-- Generic soft delete function
CREATE OR REPLACE FUNCTION soft_delete(table_name TEXT, record_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = $1', table_name)
  USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper view to get non-deleted records
CREATE OR REPLACE FUNCTION create_active_view(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE OR REPLACE VIEW %I AS SELECT * FROM %I WHERE deleted_at IS NULL',
    table_name || '_active',
    table_name
  );
END;
$$ LANGUAGE plpgsql;
```

### 2. Full-Text Search

**Change:** Add `tsvector` columns with automatic updates

**Affected Tables:**
- `leads` - Search: name, email, company, notes
- `notes` - Search: content
- `email_messages` - Search: subject, body_text

**Implementation:**
```sql
-- Function to update search vector for leads
CREATE OR REPLACE FUNCTION leads_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.email, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_search_update
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_search_vector_update();

-- Similar triggers for notes and email_messages
```

**Usage:**
```sql
-- Search leads
SELECT * FROM leads
WHERE search_vector @@ to_tsquery('english', 'john & developer')
  AND org_id = $1
  AND deleted_at IS NULL
ORDER BY ts_rank(search_vector, to_tsquery('english', 'john & developer')) DESC;
```

### 3. Denormalized Counters

**Change:** Add counter columns to `leads` table

**New Columns:**
- `notes_count` - Total notes
- `tasks_count` - Total tasks
- `open_tasks_count` - Incomplete tasks only
- `emails_count` - Total email messages
- `last_activity_at` - Most recent activity timestamp

**Implementation:**
```sql
-- Function to update lead counters
CREATE OR REPLACE FUNCTION update_lead_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- Update notes count
  IF TG_TABLE_NAME = 'notes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE leads SET notes_count = notes_count + 1 WHERE id = NEW.lead_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE leads SET notes_count = notes_count - 1 WHERE id = OLD.lead_id;
    END IF;
  END IF;

  -- Update tasks count
  IF TG_TABLE_NAME = 'tasks' THEN
    IF TG_OP = 'INSERT' AND NEW.lead_id IS NOT NULL THEN
      UPDATE leads SET
        tasks_count = tasks_count + 1,
        open_tasks_count = CASE WHEN NEW.status != 'completed' THEN open_tasks_count + 1 ELSE open_tasks_count END
      WHERE id = NEW.lead_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.lead_id IS NOT NULL THEN
      -- Handle status change
      IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
        UPDATE leads SET open_tasks_count = open_tasks_count - 1 WHERE id = NEW.lead_id;
      ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        UPDATE leads SET open_tasks_count = open_tasks_count + 1 WHERE id = NEW.lead_id;
      END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.lead_id IS NOT NULL THEN
      UPDATE leads SET
        tasks_count = tasks_count - 1,
        open_tasks_count = CASE WHEN OLD.status != 'completed' THEN open_tasks_count - 1 ELSE open_tasks_count END
      WHERE id = OLD.lead_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_lead_notes_count
  AFTER INSERT OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_lead_counters();

CREATE TRIGGER update_lead_tasks_count
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_lead_counters();
```

### 4. Activity Tracking System

**Design Philosophy:**
- Record EVERYTHING that happens in the system
- Use polymorphic relationships for flexibility
- Store before/after changes for audit
- Denormalize `lead_id` for efficient queries

**Activity Types:**

| Category | Activity Types |
|----------|---------------|
| Lead | `lead_created`, `lead_updated`, `lead_status_changed`, `lead_deleted` |
| Note | `note_created`, `note_updated`, `note_deleted` |
| Task | `task_created`, `task_updated`, `task_completed`, `task_deleted` |
| Deal | `deal_created`, `deal_updated`, `deal_stage_changed`, `deal_deleted` |
| Email | `email_sent`, `email_received`, `email_replied` |
| Communication | `call_logged`, `meeting_scheduled`, `meeting_completed` |
| File | `file_uploaded`, `file_deleted` |
| User | `user_invited`, `user_removed` |
| System | `integration_connected`, `integration_error` |

**Automatic Activity Creation:**
```sql
-- Generic activity logger
CREATE OR REPLACE FUNCTION log_activity(
  p_org_id UUID,
  p_activity_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_lead_id UUID,
  p_description TEXT,
  p_changes JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO activities (
    org_id,
    activity_type,
    entity_type,
    entity_id,
    lead_id,
    user_id,
    description,
    changes
  ) VALUES (
    p_org_id,
    p_activity_type,
    p_entity_type,
    p_entity_id,
    p_lead_id,
    auth.uid(),
    p_description,
    p_changes
  ) RETURNING id INTO activity_id;

  -- Update lead's last_activity_at
  IF p_lead_id IS NOT NULL THEN
    UPDATE leads SET last_activity_at = NOW() WHERE id = p_lead_id;
  END IF;

  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example trigger for lead status changes
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_activity(
      NEW.org_id,
      'lead_status_changed',
      'lead',
      NEW.id,
      NEW.id,
      format('Status changed from %s to %s', OLD.status, NEW.status),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_status_change_activity
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_lead_status_change();
```

### 5. Email Storage System

**Design:**
- Two-level structure: `email_threads` → `email_messages`
- Links to leads via email address matching
- Stores both plain text and HTML versions
- Full-text search on message content
- Sentiment analysis support

**Auto-linking Emails to Leads:**
```sql
-- Function to auto-link email threads to leads
CREATE OR REPLACE FUNCTION auto_link_email_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  matched_lead_id UUID;
BEGIN
  -- Try to find lead by email in participants
  SELECT id INTO matched_lead_id
  FROM leads
  WHERE org_id = NEW.org_id
    AND email = ANY(NEW.participants)
    AND deleted_at IS NULL
  LIMIT 1;

  IF matched_lead_id IS NOT NULL THEN
    NEW.lead_id := matched_lead_id;

    -- Log activity
    PERFORM log_activity(
      NEW.org_id,
      'email_received',
      'email_thread',
      NEW.id,
      matched_lead_id,
      format('Email thread: %s', NEW.subject),
      '{}'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_link_email_thread
  BEFORE INSERT ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_email_to_lead();
```

---

## Migration Strategy

### Migration Approach

**Strategy:** Rolling migrations with zero downtime

**Phases:**
1. **Phase 1:** Add new columns to existing tables (non-breaking)
2. **Phase 2:** Create new tables (activities, emails, attachments)
3. **Phase 3:** Backfill data for new columns
4. **Phase 4:** Create triggers and functions
5. **Phase 5:** Update RLS policies
6. **Phase 6:** Create materialized views
7. **Phase 7:** Update application code

### Data Migration Concerns

#### Soft Delete Backfill
- All existing records have `deleted_at = NULL` (default)
- No historical data to migrate

#### Counter Backfill
```sql
-- Backfill lead counters
UPDATE leads l SET
  notes_count = (SELECT COUNT(*) FROM notes WHERE lead_id = l.id),
  tasks_count = (SELECT COUNT(*) FROM tasks WHERE lead_id = l.id),
  open_tasks_count = (SELECT COUNT(*) FROM tasks WHERE lead_id = l.id AND status != 'completed'),
  last_activity_at = GREATEST(
    l.updated_at,
    (SELECT MAX(created_at) FROM notes WHERE lead_id = l.id),
    (SELECT MAX(created_at) FROM tasks WHERE lead_id = l.id)
  );
```

#### Full-Text Search Backfill
```sql
-- Backfill search vectors (triggers will handle updates)
UPDATE leads SET search_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(notes, '')), 'C');

UPDATE notes SET search_vector = to_tsvector('english', coalesce(content, ''));
```

---

## Step-by-Step Implementation Plan

### Pre-Migration Checklist

- [ ] **Database Backup**
  - Full Supabase project backup via dashboard
  - Export critical tables to CSV
  - Document current row counts

- [ ] **Performance Baseline**
  - Run `EXPLAIN ANALYZE` on top 10 queries
  - Document current query times
  - Note current database size

- [ ] **Downtime Communication**
  - Notify users of maintenance window
  - Prepare status page update
  - Set up monitoring alerts

### Step 1: Preparation (15 minutes)

**Objective:** Set up migration infrastructure

```bash
# 1.1 - Create migration directory
mkdir -p supabase/migrations/redesign
cd supabase/migrations/redesign

# 1.2 - Create rollback script template
touch rollback.sql

# 1.3 - Verify Supabase connection
supabase db remote changes

# 1.4 - Create database backup
supabase db dump > backup_pre_redesign_$(date +%Y%m%d).sql
```

**Deliverables:**
- ✅ Migration directory structure
- ✅ Database backup file
- ✅ Rollback script template

---

### Step 2: Add Soft Delete Columns (10 minutes)

**Objective:** Add `deleted_at` column to all tables (non-breaking change)

**Migration File:** `001_add_soft_delete_columns.sql`

```sql
-- Add soft delete columns to all entity tables
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN leads.deleted_at IS 'Timestamp when record was soft-deleted. NULL = active record.';
COMMENT ON COLUMN tasks.deleted_at IS 'Timestamp when record was soft-deleted. NULL = active record.';
COMMENT ON COLUMN notes.deleted_at IS 'Timestamp when record was soft-deleted. NULL = active record.';
COMMENT ON COLUMN deals.deleted_at IS 'Timestamp when record was soft-deleted. NULL = active record.';
```

**Rollback:**
```sql
ALTER TABLE leads DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE notes DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE deals DROP COLUMN IF EXISTS deleted_at;
```

**Validation:**
```sql
-- Verify columns exist with NULL values
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'deleted_at'
  AND table_schema = 'public'
ORDER BY table_name;

-- Verify all existing records have deleted_at = NULL
SELECT
  'leads' as table_name, COUNT(*) as total, COUNT(*) FILTER (WHERE deleted_at IS NULL) as active FROM leads
UNION ALL
SELECT 'tasks', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM tasks
UNION ALL
SELECT 'notes', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM notes
UNION ALL
SELECT 'deals', COUNT(*), COUNT(*) FILTER (WHERE deleted_at IS NULL) FROM deals;
```

---

### Step 3: Add Full-Text Search Columns (15 minutes)

**Objective:** Add `tsvector` columns and triggers for search

**Migration File:** `002_add_fulltext_search.sql`

```sql
-- Add search vector columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create update functions
CREATE OR REPLACE FUNCTION leads_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.email, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notes_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS leads_search_update ON leads;
CREATE TRIGGER leads_search_update
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_search_vector_update();

DROP TRIGGER IF EXISTS notes_search_update ON notes;
CREATE TRIGGER notes_search_update
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION notes_search_vector_update();

-- Backfill existing data (run in batches to avoid long locks)
UPDATE leads SET search_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(notes, '')), 'C');

UPDATE notes SET search_vector = to_tsvector('english', coalesce(content, ''));

-- Create GIN indexes (this may take time on large tables)
CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING GIN(search_vector) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_search ON notes USING GIN(search_vector) WHERE deleted_at IS NULL;
```

**Rollback:**
```sql
DROP TRIGGER IF EXISTS leads_search_update ON leads;
DROP TRIGGER IF EXISTS notes_search_update ON notes;
DROP FUNCTION IF EXISTS leads_search_vector_update();
DROP FUNCTION IF EXISTS notes_search_vector_update();
DROP INDEX IF EXISTS idx_leads_search;
DROP INDEX IF EXISTS idx_notes_search;
ALTER TABLE leads DROP COLUMN IF EXISTS search_vector;
ALTER TABLE notes DROP COLUMN IF EXISTS search_vector;
```

**Validation:**
```sql
-- Test full-text search
SELECT name, email, company, ts_rank(search_vector, query) as rank
FROM leads, to_tsquery('english', 'developer') as query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

---

### Step 4: Add Denormalized Counters (15 minutes)

**Objective:** Add counter columns to leads table

**Migration File:** `003_add_denormalized_counters.sql`

```sql
-- Add counter columns to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tasks_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS open_tasks_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS emails_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill counters (this may take time on large tables)
UPDATE leads l SET
  notes_count = COALESCE((SELECT COUNT(*) FROM notes WHERE lead_id = l.id), 0),
  tasks_count = COALESCE((SELECT COUNT(*) FROM tasks WHERE lead_id = l.id), 0),
  open_tasks_count = COALESCE((SELECT COUNT(*) FROM tasks WHERE lead_id = l.id AND status != 'completed'), 0),
  last_activity_at = GREATEST(
    l.updated_at,
    COALESCE((SELECT MAX(created_at) FROM notes WHERE lead_id = l.id), l.updated_at),
    COALESCE((SELECT MAX(created_at) FROM tasks WHERE lead_id = l.id), l.updated_at)
  );

-- Create trigger function to maintain counters
CREATE OR REPLACE FUNCTION update_lead_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- Update notes count
  IF TG_TABLE_NAME = 'notes' THEN
    IF TG_OP = 'INSERT' AND NEW.lead_id IS NOT NULL THEN
      UPDATE leads SET notes_count = notes_count + 1, last_activity_at = NOW()
      WHERE id = NEW.lead_id;
    ELSIF TG_OP = 'DELETE' AND OLD.lead_id IS NOT NULL THEN
      UPDATE leads SET notes_count = GREATEST(0, notes_count - 1)
      WHERE id = OLD.lead_id;
    END IF;
  END IF;

  -- Update tasks count
  IF TG_TABLE_NAME = 'tasks' THEN
    IF TG_OP = 'INSERT' AND NEW.lead_id IS NOT NULL THEN
      UPDATE leads SET
        tasks_count = tasks_count + 1,
        open_tasks_count = CASE WHEN NEW.status != 'completed' THEN open_tasks_count + 1 ELSE open_tasks_count END,
        last_activity_at = NOW()
      WHERE id = NEW.lead_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.lead_id IS NOT NULL THEN
      -- Handle status change
      IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
        UPDATE leads SET open_tasks_count = GREATEST(0, open_tasks_count - 1), last_activity_at = NOW()
        WHERE id = NEW.lead_id;
      ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        UPDATE leads SET open_tasks_count = open_tasks_count + 1, last_activity_at = NOW()
        WHERE id = NEW.lead_id;
      END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.lead_id IS NOT NULL THEN
      UPDATE leads SET
        tasks_count = GREATEST(0, tasks_count - 1),
        open_tasks_count = CASE WHEN OLD.status != 'completed' THEN GREATEST(0, open_tasks_count - 1) ELSE open_tasks_count END
      WHERE id = OLD.lead_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_lead_notes_count ON notes;
CREATE TRIGGER update_lead_notes_count
  AFTER INSERT OR DELETE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_counters();

DROP TRIGGER IF EXISTS update_lead_tasks_count ON tasks;
CREATE TRIGGER update_lead_tasks_count
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_counters();
```

**Rollback:**
```sql
DROP TRIGGER IF EXISTS update_lead_notes_count ON notes;
DROP TRIGGER IF EXISTS update_lead_tasks_count ON tasks;
DROP FUNCTION IF EXISTS update_lead_counters();
ALTER TABLE leads DROP COLUMN IF EXISTS notes_count;
ALTER TABLE leads DROP COLUMN IF EXISTS tasks_count;
ALTER TABLE leads DROP COLUMN IF EXISTS open_tasks_count;
ALTER TABLE leads DROP COLUMN IF EXISTS emails_count;
ALTER TABLE leads DROP COLUMN IF EXISTS last_activity_at;
```

**Validation:**
```sql
-- Verify counters match actual counts
SELECT
  l.id,
  l.name,
  l.notes_count as stored_notes,
  COUNT(DISTINCT n.id) as actual_notes,
  l.tasks_count as stored_tasks,
  COUNT(DISTINCT t.id) as actual_tasks
FROM leads l
LEFT JOIN notes n ON n.lead_id = l.id
LEFT JOIN tasks t ON t.lead_id = l.id
GROUP BY l.id, l.name, l.notes_count, l.tasks_count
HAVING l.notes_count != COUNT(DISTINCT n.id) OR l.tasks_count != COUNT(DISTINCT t.id)
LIMIT 10;
-- Should return no rows
```

---

### Step 5: Create Activities Table (20 minutes)

**Objective:** Create comprehensive activity tracking system

**Migration File:** `004_create_activities_table.sql`

```sql
-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'lead_created', 'lead_updated', 'lead_status_changed', 'lead_deleted',
    'note_created', 'note_updated', 'note_deleted',
    'task_created', 'task_updated', 'task_completed', 'task_deleted',
    'deal_created', 'deal_updated', 'deal_stage_changed', 'deal_deleted',
    'email_sent', 'email_received', 'email_replied',
    'call_logged', 'meeting_scheduled', 'meeting_completed',
    'file_uploaded', 'file_deleted',
    'user_invited', 'user_removed',
    'integration_connected', 'integration_error'
  )),

  -- Polymorphic relationship
  entity_type TEXT CHECK (entity_type IN ('lead', 'task', 'note', 'deal', 'email', 'user', 'organization')),
  entity_id UUID,

  -- Related lead (denormalized for easy filtering)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Activity metadata
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Changes tracking (before/after states)
  changes JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_activities_org_id ON activities(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_lead_id ON activities(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_user_id ON activities(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_type ON activities(activity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_created_at ON activities(created_at DESC) WHERE deleted_at IS NULL;

-- Composite index for common queries (org + lead timeline)
CREATE INDEX idx_activities_org_lead_created ON activities(org_id, lead_id, created_at DESC) WHERE deleted_at IS NULL;

-- RLS Policies
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activities from their organizations" ON activities;
CREATE POLICY "Users can view activities from their organizations" ON activities
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create activities in their organizations" ON activities;
CREATE POLICY "Users can create activities in their organizations" ON activities
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

-- Generic activity logger function
CREATE OR REPLACE FUNCTION log_activity(
  p_org_id UUID,
  p_activity_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_lead_id UUID,
  p_description TEXT,
  p_changes JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO activities (
    org_id,
    activity_type,
    entity_type,
    entity_id,
    lead_id,
    user_id,
    description,
    changes
  ) VALUES (
    p_org_id,
    p_activity_type,
    p_entity_type,
    p_entity_id,
    p_lead_id,
    auth.uid(),
    p_description,
    p_changes
  ) RETURNING id INTO activity_id;

  -- Update lead's last_activity_at
  IF p_lead_id IS NOT NULL THEN
    UPDATE leads SET last_activity_at = NOW() WHERE id = p_lead_id;
  END IF;

  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_activity TO authenticated;

-- Trigger for lead status changes
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_activity(
      NEW.org_id,
      'lead_status_changed',
      'lead',
      NEW.id,
      NEW.id,
      format('Status changed from %s to %s', OLD.status, NEW.status),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_status_change_activity ON leads;
CREATE TRIGGER lead_status_change_activity
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_lead_status_change();

-- Trigger for task completion
CREATE OR REPLACE FUNCTION log_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    PERFORM log_activity(
      NEW.org_id,
      'task_completed',
      'task',
      NEW.id,
      NEW.lead_id,
      format('Task completed: %s', NEW.title),
      jsonb_build_object(
        'task_id', NEW.id,
        'task_title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_completion_activity ON tasks;
CREATE TRIGGER task_completion_activity
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
  EXECUTE FUNCTION log_task_completion();

-- Trigger for deal stage changes
CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    PERFORM log_activity(
      NEW.org_id,
      'deal_stage_changed',
      'deal',
      NEW.id,
      NEW.lead_id,
      format('Deal stage changed from %s to %s', OLD.stage, NEW.stage),
      jsonb_build_object(
        'old_stage', OLD.stage,
        'new_stage', NEW.stage,
        'deal_value', NEW.value
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deal_stage_change_activity ON deals;
CREATE TRIGGER deal_stage_change_activity
  AFTER UPDATE ON deals
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION log_deal_stage_change();
```

**Rollback:**
```sql
DROP TRIGGER IF EXISTS lead_status_change_activity ON leads;
DROP TRIGGER IF EXISTS task_completion_activity ON tasks;
DROP TRIGGER IF EXISTS deal_stage_change_activity ON deals;
DROP FUNCTION IF EXISTS log_lead_status_change();
DROP FUNCTION IF EXISTS log_task_completion();
DROP FUNCTION IF EXISTS log_deal_stage_change();
DROP FUNCTION IF EXISTS log_activity(UUID, TEXT, TEXT, UUID, UUID, TEXT, JSONB);
DROP TABLE IF EXISTS activities CASCADE;
```

**Validation:**
```sql
-- Test activity creation by updating a lead status
UPDATE leads SET status = 'contacted' WHERE id = (SELECT id FROM leads LIMIT 1) RETURNING id;

-- Verify activity was created
SELECT * FROM activities ORDER BY created_at DESC LIMIT 5;

-- Test polymorphic query
SELECT
  a.activity_type,
  a.description,
  a.created_at,
  u.full_name as user_name
FROM activities a
LEFT JOIN users u ON u.id = a.user_id
WHERE a.org_id = (SELECT org_id FROM organizations LIMIT 1)
ORDER BY a.created_at DESC
LIMIT 10;
```

---

### Step 6: Create Email Storage Tables (25 minutes)

**Objective:** Create email threads and messages tables

**Migration File:** `005_create_email_tables.sql`

```sql
-- Create email_threads table
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Gmail/Email provider details
  thread_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook', 'other')),

  -- Thread metadata
  subject TEXT,
  snippet TEXT,

  -- Related lead (can be null if not yet linked)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Participants (array of email addresses)
  participants TEXT[] NOT NULL DEFAULT '{}',

  -- Labels/tags
  labels TEXT[] DEFAULT '{}',

  -- Status
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,

  -- Timestamps
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Prevent duplicate threads per org
  CONSTRAINT unique_thread_per_org UNIQUE(org_id, provider, thread_id)
);

-- Create email_messages table
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,

  -- Gmail/Email provider details
  message_id TEXT NOT NULL,

  -- Message details
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',

  subject TEXT,
  body_text TEXT,
  body_html TEXT,

  -- Message metadata
  is_from_me BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,

  -- Sentiment analysis (can be computed async)
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Prevent duplicates
  CONSTRAINT unique_message_per_org UNIQUE(org_id, message_id)
);

-- Add search vector to email_messages
ALTER TABLE email_messages ADD COLUMN search_vector tsvector;

-- Create indexes for email_threads
CREATE INDEX idx_email_threads_org_id ON email_threads(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_lead_id ON email_threads(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_last_message ON email_threads(last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_participants_gin ON email_threads USING GIN(participants) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_threads_labels_gin ON email_threads USING GIN(labels) WHERE deleted_at IS NULL;

-- Create indexes for email_messages
CREATE INDEX idx_email_messages_org_id ON email_messages(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_sent_at ON email_messages(sent_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_from ON email_messages(from_email) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_search ON email_messages USING GIN(search_vector) WHERE deleted_at IS NULL;

-- Create updated_at trigger for email_threads
DROP TRIGGER IF EXISTS update_email_threads_updated_at ON email_threads;
CREATE TRIGGER update_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create search vector trigger for email_messages
CREATE OR REPLACE FUNCTION email_messages_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.from_email, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_messages_search_update ON email_messages;
CREATE TRIGGER email_messages_search_update
  BEFORE INSERT OR UPDATE ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION email_messages_search_vector_update();

-- Auto-link email threads to leads by email address
CREATE OR REPLACE FUNCTION auto_link_email_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  matched_lead_id UUID;
BEGIN
  -- Try to find lead by email in participants
  SELECT id INTO matched_lead_id
  FROM leads
  WHERE org_id = NEW.org_id
    AND email = ANY(NEW.participants)
    AND deleted_at IS NULL
  LIMIT 1;

  IF matched_lead_id IS NOT NULL AND NEW.lead_id IS NULL THEN
    NEW.lead_id := matched_lead_id;

    -- Update lead's email count and last activity
    UPDATE leads
    SET emails_count = emails_count + 1,
        last_activity_at = NOW()
    WHERE id = matched_lead_id;

    -- Log activity
    PERFORM log_activity(
      NEW.org_id,
      'email_received',
      'email_thread',
      NEW.id,
      matched_lead_id,
      format('Email thread: %s', NEW.subject),
      '{}'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_link_email_thread ON email_threads;
CREATE TRIGGER auto_link_email_thread
  BEFORE INSERT ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_email_to_lead();

-- Update thread's last_message_at when message inserted
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_threads
  SET last_message_at = NEW.sent_at,
      updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_thread_timestamp ON email_messages;
CREATE TRIGGER update_thread_timestamp
  AFTER INSERT ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_last_message();

-- RLS Policies for email_threads
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view email threads from their organizations" ON email_threads;
CREATE POLICY "Users can view email threads from their organizations" ON email_threads
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert email threads in their organizations" ON email_threads;
CREATE POLICY "Users can insert email threads in their organizations" ON email_threads
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update email threads in their organizations" ON email_threads;
CREATE POLICY "Users can update email threads in their organizations" ON email_threads
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

-- RLS Policies for email_messages
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view email messages from their organizations" ON email_messages;
CREATE POLICY "Users can view email messages from their organizations" ON email_messages
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert email messages in their organizations" ON email_messages;
CREATE POLICY "Users can insert email messages in their organizations" ON email_messages
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update email messages in their organizations" ON email_messages;
CREATE POLICY "Users can update email messages in their organizations" ON email_messages
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );
```

**Rollback:**
```sql
DROP TRIGGER IF EXISTS auto_link_email_thread ON email_threads;
DROP TRIGGER IF EXISTS update_thread_timestamp ON email_messages;
DROP TRIGGER IF EXISTS email_messages_search_update ON email_messages;
DROP FUNCTION IF EXISTS auto_link_email_to_lead();
DROP FUNCTION IF EXISTS update_thread_last_message();
DROP FUNCTION IF EXISTS email_messages_search_vector_update();
DROP TABLE IF EXISTS email_messages CASCADE;
DROP TABLE IF EXISTS email_threads CASCADE;
```

**Validation:**
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'email_%';

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'email_%';
```

---

### Step 7: Create Attachments Table (15 minutes)

**Objective:** Create polymorphic attachments table for files

**Migration File:** `006_create_attachments_table.sql`

```sql
-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Polymorphic relationship
  entity_type TEXT NOT NULL CHECK (entity_type IN ('email', 'note', 'task', 'deal', 'lead')),
  entity_id UUID NOT NULL,

  -- File details
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,

  -- Storage location
  storage_provider TEXT NOT NULL DEFAULT 'supabase',
  storage_path TEXT NOT NULL,
  storage_url TEXT,

  -- Upload metadata
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_attachments_org_id ON attachments(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_attachments_created_at ON attachments(created_at DESC) WHERE deleted_at IS NULL;

-- RLS Policies
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments from their organizations" ON attachments;
CREATE POLICY "Users can view attachments from their organizations" ON attachments
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert attachments in their organizations" ON attachments;
CREATE POLICY "Users can insert attachments in their organizations" ON attachments
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own attachments" ON attachments;
CREATE POLICY "Users can delete their own attachments" ON attachments
  FOR UPDATE USING (
    uploaded_by = auth.uid() OR
    org_id IN (
      SELECT org_id FROM user_orgs
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Trigger to log attachment uploads as activities
CREATE OR REPLACE FUNCTION log_attachment_activity()
RETURNS TRIGGER AS $$
DECLARE
  related_lead_id UUID;
BEGIN
  -- Try to find related lead
  IF NEW.entity_type = 'lead' THEN
    related_lead_id := NEW.entity_id;
  ELSIF NEW.entity_type = 'task' THEN
    SELECT lead_id INTO related_lead_id FROM tasks WHERE id = NEW.entity_id;
  ELSIF NEW.entity_type = 'note' THEN
    SELECT lead_id INTO related_lead_id FROM notes WHERE id = NEW.entity_id;
  ELSIF NEW.entity_type = 'deal' THEN
    SELECT lead_id INTO related_lead_id FROM deals WHERE id = NEW.entity_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.org_id,
      'file_uploaded',
      NEW.entity_type,
      NEW.entity_id,
      related_lead_id,
      format('Uploaded file: %s', NEW.filename),
      jsonb_build_object(
        'filename', NEW.filename,
        'file_size', NEW.file_size,
        'mime_type', NEW.mime_type
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attachment_activity_log ON attachments;
CREATE TRIGGER attachment_activity_log
  AFTER INSERT ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION log_attachment_activity();
```

**Rollback:**
```sql
DROP TRIGGER IF EXISTS attachment_activity_log ON attachments;
DROP FUNCTION IF EXISTS log_attachment_activity();
DROP TABLE IF EXISTS attachments CASCADE;
```

**Validation:**
```sql
-- Verify table structure
\d+ attachments

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'attachments';
```

---

### Step 8: Update Existing Indexes (20 minutes)

**Objective:** Rebuild indexes to respect soft deletes and add composite indexes

**Migration File:** `007_update_indexes.sql`

```sql
-- Update leads indexes
DROP INDEX IF EXISTS idx_leads_org_id;
DROP INDEX IF EXISTS idx_leads_status;
DROP INDEX IF EXISTS idx_leads_email;
DROP INDEX IF EXISTS idx_leads_created_at;
DROP INDEX IF EXISTS idx_leads_source_gin;

CREATE INDEX idx_leads_org_id ON leads(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_status ON leads(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_email ON leads(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_created_at ON leads(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_source_gin ON leads USING GIN(source) WHERE deleted_at IS NULL;

-- Add composite indexes for common queries
CREATE INDEX idx_leads_org_status_created ON leads(org_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_org_sentiment ON leads(org_id, sentiment) WHERE deleted_at IS NULL;

-- Update tasks indexes
DROP INDEX IF EXISTS idx_tasks_org_id;
DROP INDEX IF EXISTS idx_tasks_lead_id;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_due_date;
DROP INDEX IF EXISTS idx_tasks_assigned_to;

CREATE INDEX idx_tasks_org_id ON tasks(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_lead_id ON tasks(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL AND status != 'completed';
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to) WHERE deleted_at IS NULL;

-- Add composite index for task lists
CREATE INDEX idx_tasks_org_status_due ON tasks(org_id, status, due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status) WHERE deleted_at IS NULL;

-- Update notes indexes
DROP INDEX IF EXISTS idx_notes_lead_id;
DROP INDEX IF EXISTS idx_notes_org_id;
DROP INDEX IF EXISTS idx_notes_created_at;

CREATE INDEX idx_notes_lead_id ON notes(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_org_id ON notes(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_created_at ON notes(created_at DESC) WHERE deleted_at IS NULL;

-- Update deals indexes
DROP INDEX IF EXISTS idx_deals_org_id;
DROP INDEX IF EXISTS idx_deals_lead_id;
DROP INDEX IF EXISTS idx_deals_stage;
DROP INDEX IF EXISTS idx_deals_expected_close_date;

CREATE INDEX idx_deals_org_id ON deals(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_lead_id ON deals(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_stage ON deals(stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_expected_close_date ON deals(expected_close_date) WHERE deleted_at IS NULL;

-- Add composite index for pipeline view
CREATE INDEX idx_deals_org_stage_close ON deals(org_id, stage, expected_close_date) WHERE deleted_at IS NULL;

-- Add weighted_value column for deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS weighted_value DECIMAL(15,2) GENERATED ALWAYS AS (value * probability / 100) STORED;
```

**Rollback:**
```sql
-- Note: Index operations are generally safe and don't need rollback
-- Old indexes are already dropped and recreated
ALTER TABLE deals DROP COLUMN IF EXISTS weighted_value;
```

**Validation:**
```sql
-- List all indexes with their sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Verify partial indexes work
EXPLAIN SELECT * FROM leads WHERE org_id = '...' AND deleted_at IS NULL;
-- Should show "Index Scan using idx_leads_org_id"
```

---

### Step 9: Create Materialized Views (20 minutes)

**Objective:** Create pre-computed views for dashboard analytics

**Migration File:** `008_create_materialized_views.sql`

```sql
-- Lead statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS lead_stats AS
SELECT
  org_id,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_leads,
  COUNT(*) FILTER (WHERE status = 'new' AND deleted_at IS NULL) as new_leads,
  COUNT(*) FILTER (WHERE status = 'contacted' AND deleted_at IS NULL) as contacted_leads,
  COUNT(*) FILTER (WHERE status = 'replied' AND deleted_at IS NULL) as replied_leads,
  COUNT(*) FILTER (WHERE status = 'meeting_scheduled' AND deleted_at IS NULL) as scheduled_leads,
  COUNT(*) FILTER (WHERE status = 'closed' AND deleted_at IS NULL) as closed_leads,
  COUNT(*) FILTER (WHERE status = 'lost' AND deleted_at IS NULL) as lost_leads,
  COUNT(*) FILTER (WHERE sentiment = 'positive' AND deleted_at IS NULL) as positive_sentiment,
  COUNT(*) FILTER (WHERE sentiment = 'neutral' AND deleted_at IS NULL) as neutral_sentiment,
  COUNT(*) FILTER (WHERE sentiment = 'negative' AND deleted_at IS NULL) as negative_sentiment,
  MAX(created_at) as last_lead_created_at,
  MAX(updated_at) as last_lead_updated_at
FROM leads
GROUP BY org_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_lead_stats_org_id ON lead_stats(org_id);

-- Task statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS task_stats AS
SELECT
  org_id,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'pending' AND deleted_at IS NULL) as pending_tasks,
  COUNT(*) FILTER (WHERE status = 'in_progress' AND deleted_at IS NULL) as in_progress_tasks,
  COUNT(*) FILTER (WHERE status = 'completed' AND deleted_at IS NULL) as completed_tasks,
  COUNT(*) FILTER (WHERE status = 'cancelled' AND deleted_at IS NULL) as cancelled_tasks,
  COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL) as overdue_tasks,
  COUNT(*) FILTER (WHERE due_date::DATE = CURRENT_DATE AND status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL) as due_today_tasks,
  COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL) as urgent_tasks
FROM tasks
GROUP BY org_id;

CREATE UNIQUE INDEX idx_task_stats_org_id ON task_stats(org_id);

-- Deal pipeline statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS deal_stats AS
SELECT
  org_id,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_deals,
  COUNT(*) FILTER (WHERE stage = 'lead' AND deleted_at IS NULL) as lead_stage,
  COUNT(*) FILTER (WHERE stage = 'qualified' AND deleted_at IS NULL) as qualified_stage,
  COUNT(*) FILTER (WHERE stage = 'proposal' AND deleted_at IS NULL) as proposal_stage,
  COUNT(*) FILTER (WHERE stage = 'negotiation' AND deleted_at IS NULL) as negotiation_stage,
  COUNT(*) FILTER (WHERE stage = 'closed_won' AND deleted_at IS NULL) as closed_won,
  COUNT(*) FILTER (WHERE stage = 'closed_lost' AND deleted_at IS NULL) as closed_lost,
  SUM(value) FILTER (WHERE deleted_at IS NULL) as total_value,
  SUM(value) FILTER (WHERE stage = 'closed_won' AND deleted_at IS NULL) as won_value,
  SUM(value * probability / 100) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost') AND deleted_at IS NULL) as weighted_pipeline
FROM deals
GROUP BY org_id;

CREATE UNIQUE INDEX idx_deal_stats_org_id ON deal_stats(org_id);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY lead_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY task_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY deal_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_all_stats TO authenticated;

-- Optional: Create a scheduled job to refresh stats (if pg_cron is available)
-- SELECT cron.schedule('refresh-crm-stats', '*/15 * * * *', 'SELECT refresh_all_stats()');

-- Trigger to refresh lead_stats when leads change
CREATE OR REPLACE FUNCTION refresh_lead_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY lead_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: Don't create triggers on every row change (too expensive)
-- Instead, refresh periodically or on-demand via API
```

**Rollback:**
```sql
DROP FUNCTION IF EXISTS refresh_all_stats();
DROP FUNCTION IF EXISTS refresh_lead_stats();
DROP MATERIALIZED VIEW IF EXISTS deal_stats;
DROP MATERIALIZED VIEW IF EXISTS task_stats;
DROP MATERIALIZED VIEW IF EXISTS lead_stats;
```

**Validation:**
```sql
-- Verify materialized views exist
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';

-- Test refresh
SELECT refresh_all_stats();

-- Query stats
SELECT * FROM lead_stats LIMIT 5;
SELECT * FROM task_stats LIMIT 5;
SELECT * FROM deal_stats LIMIT 5;
```

---

### Step 10: Update RLS Policies (15 minutes)

**Objective:** Ensure all RLS policies respect soft deletes

**Migration File:** `009_update_rls_policies.sql`

```sql
-- Note: Most RLS policies filter by org_id, which is already secure
-- We don't necessarily need to add deleted_at checks to RLS policies
-- because the application queries will filter deleted_at at the query level

-- However, for defense-in-depth, we can add deleted_at checks to SELECT policies

-- Update leads policies (if they need modification)
-- Current policies should already work, but we can make them explicit

-- Example: Add explicit deleted_at check (optional, defensive)
DROP POLICY IF EXISTS "Users can view leads from their organizations" ON leads;
CREATE POLICY "Users can view leads from their organizations" ON leads
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
    -- Note: We don't add AND deleted_at IS NULL here because:
    -- 1. Application queries should filter deleted records
    -- 2. Some features may need to view deleted records (trash/restore)
  );

-- The existing policies are fine and don't need deleted_at checks at RLS level
-- Because:
-- 1. Multi-tenancy security is based on org_id, not deleted_at
-- 2. Soft delete filtering is a business logic concern, not a security concern
-- 3. Admins may want to view deleted records for audit/restore purposes

-- However, create helper views for convenience
CREATE OR REPLACE VIEW leads_active AS
  SELECT * FROM leads WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW tasks_active AS
  SELECT * FROM tasks WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW notes_active AS
  SELECT * FROM notes WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW deals_active AS
  SELECT * FROM deals WHERE deleted_at IS NULL;

-- Grant access to these views
GRANT SELECT ON leads_active TO authenticated;
GRANT SELECT ON tasks_active TO authenticated;
GRANT SELECT ON notes_active TO authenticated;
GRANT SELECT ON deals_active TO authenticated;

-- RLS policies for the views inherit from base tables
-- Supabase will automatically apply RLS to these views
```

**Rollback:**
```sql
DROP VIEW IF EXISTS leads_active;
DROP VIEW IF EXISTS tasks_active;
DROP VIEW IF EXISTS notes_active;
DROP VIEW IF EXISTS deals_active;
```

**Validation:**
```sql
-- Test that views work
SELECT COUNT(*) FROM leads_active;
SELECT COUNT(*) FROM tasks_active;

-- Test that RLS is enforced on views
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-id"}';
SELECT * FROM leads_active LIMIT 1;
RESET ROLE;
```

---

### Step 11: Add Email Validation Constraint (5 minutes)

**Objective:** Add better email validation to leads table

**Migration File:** `010_add_email_validation.sql`

```sql
-- Add email validation constraint to leads
ALTER TABLE leads
  ADD CONSTRAINT valid_email
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Note: This will fail if existing data has invalid emails
-- If it fails, first fix the data:
-- UPDATE leads SET email = lower(trim(email)) WHERE email IS NOT NULL;
-- Then re-run the constraint
```

**Rollback:**
```sql
ALTER TABLE leads DROP CONSTRAINT IF EXISTS valid_email;
```

**Validation:**
```sql
-- Test invalid email (should fail)
INSERT INTO leads (org_id, name, email)
VALUES ('...', 'Test', 'invalid-email')
RETURNING id;
-- Should error: new row violates check constraint "valid_email"

-- Test valid email (should succeed)
INSERT INTO leads (org_id, name, email)
VALUES ('...', 'Test', 'valid@example.com')
RETURNING id;
```

---

### Step 12: Post-Migration Tasks (30 minutes)

**Objective:** Clean up, optimize, and verify the migration

**Tasks:**

1. **Run VACUUM ANALYZE**
```sql
-- Reclaim space and update statistics
VACUUM ANALYZE leads;
VACUUM ANALYZE tasks;
VACUUM ANALYZE notes;
VACUUM ANALYZE deals;
VACUUM ANALYZE activities;
VACUUM ANALYZE email_threads;
VACUUM ANALYZE email_messages;
VACUUM ANALYZE attachments;
```

2. **Verify Index Usage**
```sql
-- Check index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Identify unused indexes (idx_scan = 0)
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY tablename, indexname;
```

3. **Test Query Performance**
```sql
-- Test common queries with EXPLAIN ANALYZE

-- 1. Lead list with filters
EXPLAIN ANALYZE
SELECT * FROM leads
WHERE org_id = '...'
  AND status = 'new'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 2. Full-text search
EXPLAIN ANALYZE
SELECT * FROM leads
WHERE search_vector @@ to_tsquery('english', 'developer')
  AND org_id = '...'
  AND deleted_at IS NULL
ORDER BY ts_rank(search_vector, to_tsquery('english', 'developer')) DESC;

-- 3. Lead timeline with activities
EXPLAIN ANALYZE
SELECT * FROM activities
WHERE lead_id = '...'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 4. Dashboard statistics (materialized view)
EXPLAIN ANALYZE
SELECT * FROM lead_stats WHERE org_id = '...';
```

4. **Refresh Materialized Views**
```sql
SELECT refresh_all_stats();

-- Verify data
SELECT * FROM lead_stats;
SELECT * FROM task_stats;
SELECT * FROM deal_stats;
```

5. **Document Final Schema**
```bash
# Export final schema
supabase db dump --schema-only > schema_post_redesign.sql

# Generate ER diagram (using external tool like dbdiagram.io or DBeaver)
```

6. **Create Database Functions Documentation**
```sql
-- List all custom functions
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name NOT LIKE 'pg_%'
ORDER BY routine_name;

-- Document function usage in a comment
COMMENT ON FUNCTION log_activity IS 'Logs an activity record. Use this instead of direct INSERT for automatic lead_id updates.';
COMMENT ON FUNCTION refresh_all_stats IS 'Refreshes all materialized views. Call this after bulk data changes or on a schedule.';
```

---

### Step 13: Application Code Updates (Out of scope for database migration)

**Note:** These are application-level changes that need to be made after the database migration.

**Required Changes:**

1. **Update Type Definitions** (`src/types/crm.ts`)
   - Add `deleted_at`, `search_vector`, counter fields to interfaces
   - Add `Activity`, `EmailThread`, `EmailMessage`, `Attachment` types

2. **Update API Functions** (`src/lib/api/`)
   - Add `deleted_at IS NULL` filter to all queries
   - Implement soft delete functions
   - Add full-text search functions
   - Add activity logging to mutations

3. **Update React Hooks** (`src/hooks/`)
   - Add hooks for activities, emails, attachments
   - Update existing hooks to use soft deletes

4. **Add UI Components**
   - Activity timeline component
   - Email inbox component
   - Attachment upload/download components
   - Trash/restore functionality

5. **Update React Query Keys**
   - Invalidate related queries (activities when lead updates, etc.)

---

## Post-Migration Validation Checklist

After completing all migration steps, verify:

### Data Integrity
- [ ] All existing leads, tasks, notes, deals preserved
- [ ] No records have `deleted_at` set (unless manually deleted)
- [ ] All foreign key relationships intact
- [ ] Counters match actual counts
- [ ] Search vectors populated

### Performance
- [ ] All queries using appropriate indexes (EXPLAIN ANALYZE)
- [ ] Full-text search faster than ILIKE queries
- [ ] Dashboard loads in < 500ms (using materialized views)
- [ ] Activity timeline queries in < 100ms

### Security
- [ ] RLS policies tested for each table
- [ ] Users can only access their org's data
- [ ] Soft deletes don't break RLS

### Functionality
- [ ] Activities auto-created on status changes
- [ ] Email threads auto-linked to leads
- [ ] Counters update on note/task creation
- [ ] Full-text search returns relevant results
- [ ] Materialized views refresh successfully

---

## Risk Assessment

### High Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Data loss during migration | Critical | Low | Full backup before starting, test on staging first |
| Long-running migrations lock tables | High | Medium | Use batched updates, run during low-traffic period |
| Index creation takes too long | Medium | Medium | Create indexes CONCURRENTLY, monitor progress |
| Triggers cause performance issues | Medium | Low | Test trigger overhead, disable if needed |
| RLS policies block legitimate access | High | Low | Thoroughly test policies before enabling |

### Medium Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Counter backfill inaccurate | Medium | Low | Validate counts after backfill |
| Search vector updates slow | Low | Medium | Build search vectors async if needed |
| Materialized views stale | Low | High | Schedule regular refresh, add manual trigger |
| Email auto-linking incorrect | Medium | Medium | Add manual link/unlink UI |

---

## Rollback Strategy

### Immediate Rollback (< 1 hour after migration)

If critical issues discovered immediately:

```sql
-- 1. Stop application traffic
-- 2. Restore from backup
psql < backup_pre_redesign_YYYYMMDD.sql

-- 3. Verify restoration
SELECT COUNT(*) FROM leads;
SELECT COUNT(*) FROM tasks;
-- etc.
```

### Partial Rollback (1-24 hours after migration)

If specific features need to be rolled back:

```bash
# Run rollback scripts for specific migrations
psql -f rollback_010.sql  # Rollback email validation
psql -f rollback_009.sql  # Rollback RLS updates
# etc.
```

### Selective Rollback (> 24 hours after migration)

If migration succeeded but individual features need rollback:

1. **Disable Problematic Triggers**
   ```sql
   ALTER TABLE leads DISABLE TRIGGER lead_status_change_activity;
   ```

2. **Drop Problematic Tables**
   ```sql
   DROP TABLE activities;  -- If activity tracking causes issues
   ```

3. **Revert to Old Queries in Application**
   - Update application code to not use new features
   - Remove dependencies on new tables

---

## Performance Considerations

### Expected Performance Improvements

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Search leads by name/company | 500ms (ILIKE) | 50ms (FTS) | **10x faster** |
| Load dashboard stats | 2000ms (aggregate) | 100ms (materialized view) | **20x faster** |
| Lead detail with counts | 150ms (3 queries) | 50ms (denormalized) | **3x faster** |
| Activity timeline query | N/A | 100ms | **New feature** |

### Database Size Estimates

Based on 10,000 leads:

| Table | Rows (estimate) | Size (estimate) | Notes |
|-------|-----------------|-----------------|-------|
| leads | 10,000 | 5 MB | +2 MB for search vectors |
| tasks | 30,000 | 10 MB | 3 tasks/lead avg |
| notes | 50,000 | 25 MB | 5 notes/lead avg |
| deals | 5,000 | 2 MB | 50% conversion |
| activities | 200,000 | 80 MB | ~20 activities/lead |
| email_threads | 20,000 | 10 MB | 2 threads/lead avg |
| email_messages | 100,000 | 200 MB | With full email bodies |
| attachments | 10,000 | 5 MB | Metadata only, files stored separately |
| **Total** | | **~340 MB** | + indexes (~170 MB) = **510 MB total** |

### Index Maintenance

```sql
-- Monitor index bloat
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Rebuild bloated indexes (if needed)
REINDEX INDEX CONCURRENTLY idx_leads_search;
```

---

## Testing Strategy

### Unit Tests (Database Level)

1. **Test Soft Deletes**
```sql
-- Test soft delete
UPDATE leads SET deleted_at = NOW() WHERE id = '...';

-- Verify not returned in active queries
SELECT COUNT(*) FROM leads WHERE id = '...' AND deleted_at IS NULL;
-- Should return 0

-- Verify can be restored
UPDATE leads SET deleted_at = NULL WHERE id = '...';
```

2. **Test Full-Text Search**
```sql
-- Insert test lead
INSERT INTO leads (org_id, name, company, email)
VALUES ('...', 'John Developer', 'Tech Corp', 'john@example.com');

-- Search should find it
SELECT * FROM leads
WHERE search_vector @@ to_tsquery('english', 'developer')
  AND org_id = '...';
-- Should return the lead
```

3. **Test Activity Logging**
```sql
-- Update lead status
UPDATE leads SET status = 'contacted' WHERE id = '...' RETURNING id;

-- Verify activity created
SELECT * FROM activities
WHERE entity_id = '...'
  AND activity_type = 'lead_status_changed'
ORDER BY created_at DESC
LIMIT 1;
-- Should have recent activity
```

4. **Test Counters**
```sql
-- Insert note
INSERT INTO notes (org_id, lead_id, content)
VALUES ('...', '...', 'Test note');

-- Verify counter incremented
SELECT notes_count FROM leads WHERE id = '...';
-- Should be +1
```

### Integration Tests (Application Level)

1. **Test Lead Creation Flow**
   - Create lead
   - Verify activity logged
   - Verify counters initialized to 0
   - Verify search vector populated

2. **Test Email Import**
   - Import email thread
   - Verify auto-linked to lead by email
   - Verify activity logged
   - Verify email count updated on lead

3. **Test Task Completion**
   - Mark task as complete
   - Verify activity logged
   - Verify open_tasks_count decremented

4. **Test Soft Delete and Restore**
   - Delete lead
   - Verify not shown in list
   - Verify accessible in trash
   - Restore lead
   - Verify shown in list again

### Load Tests

1. **Test Full-Text Search Performance**
```bash
# Using pgbench or similar
# Search 10,000 times
time for i in {1..10000}; do
  psql -c "SELECT * FROM leads WHERE search_vector @@ to_tsquery('test')" > /dev/null
done
```

2. **Test Concurrent Activity Logging**
```bash
# Simulate 100 concurrent users creating activities
# Measure throughput and latency
```

3. **Test Materialized View Refresh Time**
```sql
-- Time the refresh
\timing
SELECT refresh_all_stats();
\timing

-- Should complete in < 5 seconds for 100K records
```

---

## Appendix A: Migration Timeline

Estimated timeline for production execution:

| Step | Duration | Can Run in Parallel | Notes |
|------|----------|---------------------|-------|
| Pre-migration backup | 10 min | No | Critical |
| Step 1: Preparation | 15 min | No | |
| Step 2: Add soft delete columns | 10 min | No | Fast, no data migration |
| Step 3: Add full-text search | 15 min | No | Backfill may take time |
| Step 4: Add denormalized counters | 15 min | No | Backfill required |
| Step 5: Create activities table | 20 min | No | Includes triggers |
| Step 6: Create email tables | 25 min | No | Includes auto-linking |
| Step 7: Create attachments table | 15 min | No | |
| Step 8: Update indexes | 20 min | No | May be slow on large tables |
| Step 9: Create materialized views | 20 min | No | Initial build takes time |
| Step 10: Update RLS policies | 15 min | No | |
| Step 11: Email validation | 5 min | No | May fail if bad data exists |
| Step 12: Post-migration tasks | 30 min | No | Validation and cleanup |
| **Total** | **3-4 hours** | | Add buffer for issues |

**Recommended Execution Window:** Saturday 2 AM - 6 AM (low traffic)

---

## Appendix B: SQL Helper Functions

### Soft Delete Helper
```sql
-- Soft delete any record
CREATE OR REPLACE FUNCTION soft_delete(
  table_name TEXT,
  record_id UUID
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NOW() WHERE id = $1', table_name)
  USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage: SELECT soft_delete('leads', 'uuid-here');
```

### Restore Deleted Record
```sql
CREATE OR REPLACE FUNCTION restore_record(
  table_name TEXT,
  record_id UUID
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', table_name)
  USING record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Bulk Full-Text Search
```sql
CREATE OR REPLACE FUNCTION search_all(
  org_uuid UUID,
  search_query TEXT
)
RETURNS TABLE(
  entity_type TEXT,
  entity_id UUID,
  rank REAL,
  headline TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Search leads
  SELECT
    'lead'::TEXT,
    l.id,
    ts_rank(l.search_vector, query) as rank,
    ts_headline('english', l.name || ' ' || COALESCE(l.company, ''), query) as headline
  FROM leads l, to_tsquery('english', search_query) query
  WHERE l.search_vector @@ query
    AND l.org_id = org_uuid
    AND l.deleted_at IS NULL

  UNION ALL

  -- Search notes
  SELECT
    'note'::TEXT,
    n.id,
    ts_rank(n.search_vector, query) as rank,
    ts_headline('english', n.content, query) as headline
  FROM notes n, to_tsquery('english', search_query) query
  WHERE n.search_vector @@ query
    AND n.org_id = org_uuid
    AND n.deleted_at IS NULL

  ORDER BY rank DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;
```

---

## Appendix C: Monitoring Queries

### Check Migration Progress
```sql
-- View table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Active Connections
```sql
SELECT
  datname,
  count(*) as connections
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname;
```

### Check Long-Running Queries
```sql
SELECT
  pid,
  now() - query_start as duration,
  query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '1 minute'
ORDER BY duration DESC;
```

### Kill Long-Running Query (if needed)
```sql
SELECT pg_cancel_backend(pid);
-- or
SELECT pg_terminate_backend(pid);
```

---

## Approval Required

Before proceeding with this migration plan:

- [ ] **Technical Review** - Database administrator approval
- [ ] **Business Review** - Product owner approval
- [ ] **Timing Approval** - Maintenance window confirmed
- [ ] **Backup Verified** - Pre-migration backup tested
- [ ] **Staging Tested** - Full migration run on staging environment
- [ ] **Rollback Tested** - Rollback procedure verified on staging
- [ ] **Communication Sent** - Users notified of maintenance window

**Approved by:** ___________________
**Date:** ___________________

---

## Next Steps

1. Review this document with the team
2. Test migration on a staging environment
3. Schedule maintenance window
4. Execute migration
5. Validate results
6. Update application code
7. Deploy updated application
8. Monitor performance
9. Gather feedback
10. Iterate as needed

---

**End of Database Redesign Plan**
