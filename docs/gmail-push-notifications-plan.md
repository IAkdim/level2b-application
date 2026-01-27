# Gmail Push Notifications Implementation Plan

**Feature:** Real-time automatic logging of relevant incoming emails  
**Method:** Gmail Pub/Sub + AI classification  
**Branch:** `feature/mailbox-reading-strategy`

---

## Architecture Overview

```
┌──────────────┐
│ Gmail Inbox  │ New email arrives
└──────┬───────┘
       │ push notification
       ▼
┌──────────────────────┐
│ Google Cloud Pub/Sub │ Topic: gmail-push-topic
└──────┬───────────────┘
       │ HTTP POST
       ▼
┌──────────────────────┐
│ Edge Function:       │ 
│ gmail-webhook        │ 1. Verify signature
└──────┬───────────────┘ 2. Fetch new emails via Gmail API
       │                 3. AI classification (Claude)
       ▼                 4. Auto-match to leads
┌──────────────────────┐ 5. Store in email_tracking_metadata
│ email_tracking_      │
│ metadata table       │
└──────────────────────┘
```

---

## Implementation Steps

### Phase 1: Google Cloud Setup

#### 1.1 Create Google Cloud Project
- Go to console.cloud.google.com
- Create new project: "level2b-gmail-sync"
- Enable billing (required for Pub/Sub)

#### 1.2 Enable APIs
```bash
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com
```

#### 1.3 Create Pub/Sub Topic
```bash
gcloud pubsub topics create gmail-push-topic
```

#### 1.4 Grant Gmail Permission
```bash
# Gmail service account email
GMAIL_SERVICE=serviceAccount:gmail-api-push@system.gserviceaccount.com

# Grant publish permission
gcloud pubsub topics add-iam-policy-binding gmail-push-topic \
  --member=$GMAIL_SERVICE \
  --role=roles/pubsub.publisher
```

#### 1.5 Create Push Subscription
```bash
# Your Supabase Edge Function URL
WEBHOOK_URL=https://YOUR_PROJECT.supabase.co/functions/v1/gmail-webhook

gcloud pubsub subscriptions create gmail-push-subscription \
  --topic=gmail-push-topic \
  --push-endpoint=$WEBHOOK_URL \
  --push-auth-service-account=YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com
```

---

### Phase 2: Edge Function Development

#### 2.1 Create `supabase/functions/gmail-webhook/index.ts`

**Responsibilities:**
1. Verify Pub/Sub message signature
2. Parse historyId from notification
3. Fetch new emails from Gmail API using history.list()
4. Filter for INBOX emails only
5. Classify relevance using Claude AI
6. Auto-match sender to leads
7. Store in email_tracking_metadata

**Key Functions:**
- `verifyPubSubMessage()` - security
- `fetchNewEmails(historyId)` - Gmail API
- `classifyRelevance(email)` - Claude AI
- `matchToLead(senderEmail)` - DB lookup
- `storeEmailMetadata()` - save to DB

#### 2.2 Relevance Classification Prompt

```typescript
const RELEVANCE_PROMPT = `
Analyze this email and determine if it's relevant for a B2B sales CRM.

Email:
From: ${from}
Subject: ${subject}
Body: ${body}

Determine:
1. Is this a business opportunity? (sales inquiry, partnership, etc.)
2. Is this a reply to an outreach campaign?
3. Is this spam, promotional, or personal?

Respond with JSON:
{
  "relevant": boolean,
  "confidence": number (0-1),
  "category": "opportunity" | "reply" | "spam" | "personal" | "other",
  "reasoning": "brief explanation"
}
`
```

---

### Phase 3: Gmail Watch Registration

#### 3.1 Create `src/lib/api/email/gmailWatch.ts`

```typescript
export async function registerGmailWatch(userId: string): Promise<{
  historyId: string
  expiration: number
}> {
  // Call Gmail API watch()
  // POST https://gmail.googleapis.com/gmail/v1/users/me/watch
  // {
  //   "topicName": "projects/YOUR_PROJECT/topics/gmail-push-topic",
  //   "labelIds": ["INBOX"]
  // }
}
```

**Watch Lifecycle:**
- Expires after 7 days
- Store expiration in user_settings
- Background job to renew before expiration

#### 3.2 Store Watch State in DB

Add to `user_settings` table:
```sql
ALTER TABLE user_settings ADD COLUMN gmail_watch_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN gmail_watch_history_id TEXT;
ALTER TABLE user_settings ADD COLUMN gmail_watch_expiration TIMESTAMPTZ;
```

---

### Phase 4: Auto-Match to Leads

#### 4.1 Match Logic

```typescript
async function matchEmailToLead(senderEmail: string, userId: string): Promise<string | null> {
  // Query leads table
  const { data } = await supabase
    .from('leads')
    .select('id')
    .eq('user_id', userId)
    .eq('email', senderEmail)
    .single()
  
  return data?.id || null
}
```

#### 4.2 Smart Matching (Future)
- Fuzzy email matching (john+tag@company.com → john@company.com)
- Domain matching (any@acme.com → lead at Acme Corp)
- Previous thread matching (same threadId)

---

### Phase 5: UI Implementation

#### 5.1 Settings Page: `/settings/gmail-sync`

**Components:**
- Toggle: Enable/Disable Gmail Push Sync
- Status indicator: Last sync, watch expiration
- Manual actions: "Sync Now", "Re-authorize Gmail"
- Activity log: Recent synced emails

#### 5.2 Email Threads Page Enhancement

**Show auto-synced emails:**
- Badge: "Auto-synced" vs "Manual fetch"
- Filter: Show only auto-synced emails
- Indicator: Lead auto-matched or manual

---

## Database Changes

### New Table: `gmail_sync_log`

```sql
CREATE TABLE gmail_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  gmail_history_id TEXT NOT NULL,
  
  from_email TEXT NOT NULL,
  subject TEXT,
  
  -- AI classification
  is_relevant BOOLEAN NOT NULL,
  relevance_confidence NUMERIC(3,2),
  relevance_category TEXT,
  relevance_reasoning TEXT,
  
  -- Auto-matching
  matched_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  auto_matched BOOLEAN DEFAULT false,
  
  -- Stored to email_tracking_metadata
  stored_to_metadata BOOLEAN DEFAULT false,
  metadata_id UUID REFERENCES email_tracking_metadata(id) ON DELETE SET NULL,
  
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gmail_sync_log_user_id ON gmail_sync_log(user_id);
CREATE INDEX idx_gmail_sync_log_synced_at ON gmail_sync_log(synced_at DESC);
```

**Purpose:** Audit trail for all synced emails (relevant or not)

---

## Security Considerations

### 1. Pub/Sub Message Verification
- Verify signature using Google's public keys
- Check message age (reject old messages)
- Prevent replay attacks

### 2. Rate Limiting
- Limit Edge Function invocations per user
- Prevent abuse from malicious Pub/Sub messages

### 3. User Consent
- Explicit opt-in for Gmail Push Sync
- Clear explanation of what data is accessed
- Revoke access button

---

## Cost Estimates

### Google Cloud Pub/Sub
- First 10GB: **Free**
- Push requests: $0.40 per million
- Estimated cost for 1000 users receiving 100 emails/day: **~$12/month**

### Claude AI Classification
- Haiku model: $0.25 per million input tokens
- ~500 tokens per email classification
- 1000 users × 100 emails/day × 30 days = 3M emails/month
- Estimated cost: **~$375/month**

**Optimization:** Use caching, batch processing, skip obvious spam

---

## Testing Strategy

### Phase 1: Manual Testing
1. Set up test Google Cloud project
2. Send test emails to Gmail account
3. Verify webhook receives notifications
4. Check AI classification accuracy
5. Verify storage in email_tracking_metadata

### Phase 2: Edge Cases
- High volume (100+ emails/minute)
- Malformed emails
- Non-English emails
- Attachments, HTML emails
- Thread matching edge cases

### Phase 3: Production Rollout
1. Beta users only
2. Monitor error rates, costs
3. Gradual rollout to all users

---

## Implementation Timeline

**Week 1:** Google Cloud setup, Edge Function scaffold  
**Week 2:** Gmail API integration, history.list()  
**Week 3:** Claude AI classification, lead matching  
**Week 4:** Watch registration, renewal logic  
**Week 5:** UI implementation, settings page  
**Week 6:** Testing, debugging, optimization  
**Week 7:** Beta rollout, monitoring  

---

## Rollback Plan

If issues arise:
1. Disable watch via Gmail API
2. Stop Edge Function processing
3. Fall back to manual label-based fetching
4. Data remains intact (no destructive operations)

---

## Future Enhancements

1. **Smart Filtering:** Learn from user corrections
2. **Auto-Reply:** AI-generated responses to inquiries
3. **Lead Scoring:** Rank emails by opportunity value
4. **Multi-Provider:** Add Outlook push notifications
5. **Webhook for other events:** Calendar invites, attachments

---

## Next Steps

1. ✅ Confirm user wants AI + INBOX approach
2. ⏳ Set up Google Cloud project
3. ⏳ Create webhook Edge Function
4. ⏳ Implement AI classification
5. ⏳ Test end-to-end flow
6. ⏳ Add UI controls

**Status:** Ready to start implementation!
