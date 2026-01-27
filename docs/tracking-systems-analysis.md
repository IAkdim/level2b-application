# Email Tracking Systems Analysis

## Current State: THREE Tracking Systems

### 1. `email_threads` + `email_messages` (from 20260121 migration)
**Purpose:** Store FULL email content in database

**Schema:**
- `email_threads`: subject, snippet, participants[], labels[], sentiment
- `email_messages`: body_text, body_html, from_email, to_emails[], attachments

**Issues:**
- ❌ Stores full email content (NOT GDPR-compliant)
- ❌ Violates "on-demand fetching" principle from our plan
- ❌ Duplicate of provider's storage (Gmail/Outlook already stores this)
- ❌ Requires ongoing sync to stay updated

**Verdict:** Should be DEPRECATED

---

### 2. `email_tracking` (from 20260122_simple_email_tracking.sql)
**Purpose:** Track email opens for engagement metrics

**Schema:**
```sql
email_tracking:
  - tracking_id (UUID, unique)
  - gmail_message_id (for correlation)
  - gmail_thread_id (for correlation)
  - recipient_email
  - subject (minimal context)
  - label_name (campaign)
  - is_opened, open_count, first_opened_at, last_opened_at
  - open_user_agent, open_ip_country, is_apple_mpp
```

**Purpose:** Engagement metrics only
- Track which emails were opened
- Count opens per email
- Detect Apple Mail Privacy Protection
- Campaign performance (by label)

**Issues:**
- ⚠️ Stores `subject` (small duplication)
- ⚠️ Has `gmail_message_id` and `gmail_thread_id` (overlaps with email_tracking_metadata)

**Verdict:** KEEP but harmonize

---

### 3. `email_tracking_metadata` (our new table, 20260122_email_tracking_metadata.sql)
**Purpose:** Minimal ID correlation for lead tracking

**Schema:**
```sql
email_tracking_metadata:
  - thread_id (provider's thread/conversation ID)
  - message_id (provider's message ID)
  - provider ('gmail' or 'outlook')
  - lead_id (correlation to leads table)
  - label (campaign name)
  - sent_at
```

**Purpose:** Lead correlation only
- Link threads to leads
- Provider abstraction (Gmail/Outlook)
- No content, just IDs
- GDPR-compliant

**Issues:**
- ⚠️ Overlaps with `email_tracking` on message_id and label

**Verdict:** KEEP as primary correlation system

---

## Harmonization Plan

### Decision: Two-Table System

**Table 1: `email_tracking_metadata` (PRIMARY)**
- **Purpose:** Thread/message/lead correlation
- **Stores:** IDs only (thread_id, message_id, lead_id, provider)
- **Used for:** Lead associations, provider abstraction

**Table 2: `email_tracking` (SECONDARY)**  
- **Purpose:** Engagement metrics (opens)
- **Stores:** tracking_id (for pixel), open events, minimal context
- **Used for:** Open rates, campaign performance

### Changes Required

#### 1. Link the tables via foreign key
Add to `email_tracking`:
```sql
-- Add foreign key to email_tracking_metadata
ALTER TABLE email_tracking 
  ADD COLUMN tracking_metadata_id UUID REFERENCES email_tracking_metadata(id);
```

This creates a 1:1 relationship:
- `email_tracking_metadata` = the "source of truth" for message identity
- `email_tracking` = optional engagement metrics for that message

#### 2. Remove duplication from email_tracking
```sql
-- Remove redundant fields (now in email_tracking_metadata)
ALTER TABLE email_tracking 
  DROP COLUMN gmail_message_id,
  DROP COLUMN gmail_thread_id,
  DROP COLUMN label_name,
  DROP COLUMN subject;
```

#### 3. Deprecate email_threads and email_messages
These tables violate our GDPR-compliant on-demand fetching approach.

**Migration strategy:**
- Don't drop (data loss risk)
- Stop using them in code
- Add deprecation comment to migrations
- Remove in future cleanup

---

## Harmonized Architecture

```
┌─────────────────────────────────────┐
│  email_tracking_metadata (PRIMARY) │
│  ─────────────────────────────────  │
│  - id (PK)                          │
│  - thread_id (provider's ID)        │
│  - message_id (provider's ID)       │
│  - lead_id (FK to leads)            │
│  - provider (gmail/outlook)         │
│  - label (campaign)                 │
│  - sent_at                          │
└──────────────┬──────────────────────┘
               │
               │ 1:1 (optional)
               ▼
┌─────────────────────────────────────┐
│  email_tracking (SECONDARY)         │
│  ─────────────────────────────────  │
│  - id (PK)                          │
│  - tracking_metadata_id (FK)        │
│  - tracking_id (for pixel URL)      │
│  - recipient_email_hash             │
│  - is_opened, open_count            │
│  - first/last_opened_at             │
│  - open_user_agent, ip_country      │
│  - is_apple_mpp                     │
└─────────────────────────────────────┘
```

### Data Flow

**When sending an email:**
1. `emailService.sendEmail()` sends via provider
2. Creates record in `email_tracking_metadata` (thread_id, message_id, lead_id)
3. If tracking enabled: creates record in `email_tracking` (tracking_id for pixel)
4. Links via `tracking_metadata_id` foreign key

**When email is opened:**
1. Pixel loaded, hits edge function with tracking_id
2. Updates `email_tracking` (is_opened=true, open_count++)
3. Can join to `email_tracking_metadata` to see which lead opened

**In EmailThreadsV2:**
1. Fetch threads via `emailService.getEmailsByLabel()` (on-demand from provider)
2. Query `email_tracking_metadata` to find lead associations
3. Query `email_tracking` to get open stats
4. Display enriched thread view

---

## Benefits of Harmonization

✅ **No content duplication** - email content fetched on-demand from provider  
✅ **Clear separation of concerns** - correlation vs engagement  
✅ **GDPR-compliant** - only IDs stored, not email bodies  
✅ **Single source of truth** - `email_tracking_metadata` is primary  
✅ **Optional tracking** - can send emails without open tracking  
✅ **Lead associations** - know which threads belong to which leads  
✅ **Campaign metrics** - open rates per label/campaign  

---

## Implementation Steps

1. ✅ Analyze systems (this document)
2. ⏳ Create migration to link tables and remove duplication
3. ⏳ Update `emailService` to write to both tables correctly
4. ⏳ Update EmailThreadsV2 to use new architecture
5. ⏳ Test end-to-end
6. ⏳ Document deprecation of email_threads/email_messages
