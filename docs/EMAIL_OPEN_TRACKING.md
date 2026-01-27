# Email Open Tracking - Technical Design & Implementation

## Overview

This document outlines the technical approach for implementing email open tracking in Level2B, including the tracking mechanism, database schema, backend logic, frontend integration, and important limitations.

---

## 1. Technical Approach: Tracking Pixel Method

### Recommended: 1x1 Transparent Tracking Pixel

**How it works:**
1. When sending an email, embed an invisible 1x1 transparent PNG/GIF image in the email HTML
2. The image URL points to a Supabase Edge Function endpoint with unique identifiers
3. When the recipient opens the email and their email client loads images, a request is made to our server
4. The server records the open event and returns the transparent pixel

**Why this approach:**
- **Industry standard**: Used by Mailchimp, HubSpot, Salesforce, and virtually all email marketing platforms
- **Works with existing infrastructure**: No need for SMTP webhook integration
- **Compatible with Gmail API**: The `sendEmail` function already supports HTML emails
- **No deliverability impact**: Tiny image loads are normal email behavior

### Alternative Approaches (Not Recommended)

| Approach | Pros | Cons |
|----------|------|------|
| Link tracking | More reliable (requires click) | Only tracks clicks, not opens |
| Webhook-based (ESP) | Most accurate | Requires email service provider change |
| Read receipts | Native email feature | User must approve, rarely works |

---

## 2. Tracking Pixel Implementation

### URL Structure

```
https://<project-ref>.supabase.co/functions/v1/track-email-open?t={tracking_token}
```

The `tracking_token` is a JWT or base64-encoded string containing:
- `message_id`: The email message UUID
- `recipient_email`: Recipient email hash (for privacy)
- `timestamp`: When the email was sent
- `signature`: HMAC signature to prevent tampering

### Security Considerations

1. **Token signing**: Use HMAC-SHA256 to sign tracking tokens
2. **Rate limiting**: Prevent abuse by limiting requests per token
3. **No PII in URL**: Hash recipient email, don't expose it
4. **HTTPS only**: All tracking URLs use TLS

---

## 3. Database Schema Changes

### New: `email_open_events` Table

```sql
CREATE TABLE IF NOT EXISTS public.email_open_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to sent email
  email_message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  
  -- Recipient tracking (hashed for privacy)
  recipient_email_hash TEXT NOT NULL,
  
  -- First open is what we count for open rate
  first_opened_at TIMESTAMPTZ NOT NULL,
  
  -- We record total opens for analytics
  open_count INTEGER NOT NULL DEFAULT 1,
  last_opened_at TIMESTAMPTZ NOT NULL,
  
  -- Metadata (optional, for debugging/analytics)
  user_agent TEXT,
  ip_country TEXT,  -- Derived from IP, not raw IP for privacy
  is_apple_mpp BOOLEAN DEFAULT false, -- Flag for Apple Mail Privacy Protection
  
  -- User ownership for RLS (user-centric model)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each recipient can only have one open record per email
  CONSTRAINT unique_open_per_recipient UNIQUE(email_message_id, recipient_email_hash)
);

-- Indexes
CREATE INDEX idx_email_opens_message ON email_open_events(email_message_id);
CREATE INDEX idx_email_opens_user_date ON email_open_events(user_id, first_opened_at DESC);
CREATE INDEX idx_email_opens_date ON email_open_events(first_opened_at DESC);
```

### Modified: `email_messages` Table

Add columns to cache open status (denormalized for query performance):

```sql
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS
  tracking_id UUID DEFAULT gen_random_uuid();

ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS
  is_opened BOOLEAN DEFAULT false;

ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS
  first_opened_at TIMESTAMPTZ;

ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS
  open_count INTEGER DEFAULT 0;
```

### Modified: `email_tracking` Table (Existing)

The existing `email_tracking` table can be used for raw event logging. The `email_open_events` table provides deduplicated, aggregated data.

---

## 4. Backend Logic

### Edge Function: `track-email-open`

```typescript
// supabase/functions/track-email-open/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TRACKING_SECRET = Deno.env.get('EMAIL_TRACKING_SECRET')!
const TRANSPARENT_PIXEL = Uint8Array.from(atob(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
), c => c.charCodeAt(0))

serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('t')
  
  if (!token) {
    return new Response(TRANSPARENT_PIXEL, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' }
    })
  }
  
  try {
    // Verify and decode token
    const payload = verifyTrackingToken(token, TRACKING_SECRET)
    
    // Record the open (upsert to handle duplicates)
    await recordEmailOpen(payload, req)
  } catch (error) {
    console.error('Tracking error:', error)
    // Still return pixel - don't break email display
  }
  
  return new Response(TRANSPARENT_PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
})
```

### Avoiding Double Counting

```sql
-- Upsert logic: only count first open, but track total opens
INSERT INTO email_open_events (
  email_message_id,
  recipient_email_hash,
  first_opened_at,
  last_opened_at,
  user_agent,
  ip_country,
  org_id
)
VALUES ($1, $2, NOW(), NOW(), $3, $4, $5)
ON CONFLICT (email_message_id, recipient_email_hash)
DO UPDATE SET
  open_count = email_open_events.open_count + 1,
  last_opened_at = NOW(),
  updated_at = NOW();
```

### Updating `email_messages` Cache

```sql
-- Trigger to update email_messages when first open is recorded
CREATE OR REPLACE FUNCTION update_email_message_open_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_messages
  SET 
    is_opened = true,
    first_opened_at = COALESCE(first_opened_at, NEW.first_opened_at),
    open_count = open_count + 1,
    updated_at = NOW()
  WHERE id = NEW.email_message_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_open_trigger
  AFTER INSERT ON email_open_events
  FOR EACH ROW
  EXECUTE FUNCTION update_email_message_open_status();
```

---

## 5. Email Sending Integration

### Modifying `sendEmail` to Inject Tracking Pixel

The tracking pixel must be injected into HTML emails before sending:

```typescript
function injectTrackingPixel(
  htmlBody: string,
  messageId: string,
  recipientEmail: string
): string {
  const trackingToken = generateTrackingToken(messageId, recipientEmail)
  const trackingUrl = `${SUPABASE_URL}/functions/v1/track-email-open?t=${trackingToken}`
  
  const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;visibility:hidden;" alt="" />`
  
  // Inject before closing </body> tag, or at the end
  if (htmlBody.includes('</body>')) {
    return htmlBody.replace('</body>', `${trackingPixel}</body>`)
  }
  return htmlBody + trackingPixel
}
```

### Plain Text Emails

**Important**: Open tracking only works for HTML emails. Plain text emails cannot contain tracking pixels.

Options:
1. Always send multipart emails (text + HTML)
2. Clearly indicate in UI that open tracking is only available for HTML emails
3. Auto-convert plain text to minimal HTML when tracking is desired

---

## 6. Computing Open Rates

### Open Rate Formula

```
Open Rate = (Unique Opens / Delivered Emails) × 100%
```

**Important distinctions:**
- **Delivered** = Sent - Bounced
- **Unique Opens** = Count of emails opened at least once (not total opens)

### SQL Function for Open Rate Calculation

```sql
CREATE OR REPLACE FUNCTION get_email_open_rate(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_campaign_label TEXT DEFAULT NULL
)
RETURNS TABLE(
  total_sent BIGINT,
  total_delivered BIGINT,
  unique_opens BIGINT,
  total_opens BIGINT,
  open_rate NUMERIC
) AS $$
BEGIN
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  WITH sent_emails AS (
    SELECT em.id, em.tracking_id, em.is_opened, em.open_count
    FROM email_messages em
    JOIN email_threads et ON em.thread_id = et.id
    WHERE em.org_id = p_org_id
      AND em.is_from_me = true
      AND em.sent_at::DATE BETWEEN p_start_date AND p_end_date
      AND em.deleted_at IS NULL
      AND (p_campaign_label IS NULL OR p_campaign_label = ANY(et.labels))
  )
  SELECT
    COUNT(*)::BIGINT as total_sent,
    COUNT(*)::BIGINT as total_delivered, -- Adjust if tracking bounces
    COUNT(*) FILTER (WHERE is_opened = true)::BIGINT as unique_opens,
    SUM(COALESCE(open_count, 0))::BIGINT as total_opens,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE is_opened = true) * 100.0 / COUNT(*)), 1)
      ELSE 0
    END as open_rate
  FROM sent_emails;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Campaign-Level Open Rate

```sql
-- Get open rate per campaign/label
CREATE OR REPLACE FUNCTION get_campaign_open_rates(
  p_org_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  campaign TEXT,
  total_sent BIGINT,
  unique_opens BIGINT,
  open_rate NUMERIC
) AS $$
BEGIN
  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);
  
  RETURN QUERY
  SELECT
    UNNEST(et.labels) as campaign,
    COUNT(em.id)::BIGINT as total_sent,
    COUNT(*) FILTER (WHERE em.is_opened = true)::BIGINT as unique_opens,
    CASE WHEN COUNT(em.id) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE em.is_opened = true) * 100.0 / COUNT(em.id)), 1)
      ELSE 0
    END as open_rate
  FROM email_messages em
  JOIN email_threads et ON em.thread_id = et.id
  WHERE em.org_id = p_org_id
    AND em.is_from_me = true
    AND em.sent_at::DATE BETWEEN p_start_date AND p_end_date
    AND em.deleted_at IS NULL
    AND ARRAY_LENGTH(et.labels, 1) > 0
  GROUP BY UNNEST(et.labels)
  ORDER BY total_sent DESC;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 7. UI Patterns

### Email Thread Row - Open Indicator

Add a subtle open indicator to `EmailThreadRow`:

```tsx
// Visual states:
// ⚫ Not tracked (plain text email)
// ⚪ Not opened (HTML email, tracking enabled)
// 👁 Opened (with optional timestamp on hover)

{thread.isOpened ? (
  <Tooltip content={`Opened ${formatRelativeTime(thread.firstOpenedAt)}`}>
    <span className="text-green-500 text-xs">👁</span>
  </Tooltip>
) : thread.hasTracking ? (
  <span className="text-muted-foreground text-xs opacity-50">○</span>
) : null}
```

### Email Detail View

Show open status with more detail:

```tsx
<div className="flex items-center gap-2 text-sm text-muted-foreground">
  {email.isOpened ? (
    <>
      <Eye className="h-4 w-4 text-green-500" />
      <span>Opened {formatRelativeTime(email.firstOpenedAt)}</span>
      {email.openCount > 1 && (
        <span className="text-xs">({email.openCount} times)</span>
      )}
    </>
  ) : email.hasTracking ? (
    <>
      <EyeOff className="h-4 w-4 text-muted-foreground" />
      <span>Not opened yet</span>
    </>
  ) : (
    <span className="text-xs italic">Open tracking not available</span>
  )}
</div>
```

### Analytics Dashboard

Add Open Rate card and chart:

```tsx
// Open Rate Metric Card
<MetricCard
  label="Open Rate"
  value={`${summary?.emailOpenRate ?? 0}%`}
  icon={Eye}
  trend={summary?.emailOpenRate > 20 ? 'up' : 'neutral'}
  isLoading={summaryLoading}
  tooltip="Percentage of sent emails that were opened. Note: May be underreported due to email client image blocking."
/>

// Open Rate Over Time Chart
<Line
  type="monotone"
  dataKey="open_rate"
  name="Open Rate %"
  stroke={COLORS.accent}
  strokeWidth={2}
/>
```

---

## 8. Limitations & Edge Cases

### Critical Limitations to Communicate to Users

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **Image blocking** | ~40% of emails have images disabled by default | Show "≥X% opened" to indicate minimum |
| **Apple Mail Privacy Protection** | Apple preloads all images, causing false positives | Detect Apple clients, show warning |
| **Gmail image proxy** | Google caches images, may count single open | Accept as industry limitation |
| **Outlook** | Often blocks external images initially | Lower expected open rates |
| **Text-only emails** | Cannot track opens | Indicate "tracking unavailable" |

### Apple Mail Privacy Protection (iOS 15+, macOS Monterey+)

Apple's Mail Privacy Protection (MPP) preloads remote content, including tracking pixels, even when the user hasn't opened the email. This causes:
- **False positives**: Emails appear opened when they weren't
- **Inflated open rates**: Can inflate rates by 30-50%

**Detection & Mitigation:**
```typescript
// Detect Apple Mail proxy in user agent
const isAppleMPP = userAgent.includes('Mozilla/5.0') && 
  (userAgent.includes('AppleWebKit') && !userAgent.includes('Chrome'));

// Or check IP against Apple's proxy IP ranges
const APPLE_PROXY_IPS = ['17.0.0.0/8'] // Apple's IP block
```

**UI Communication:**
```tsx
{campaign.hasAppleMPPOpens && (
  <Tooltip content="Some opens may be from Apple's privacy protection and might not represent actual views">
    <Badge variant="outline" className="text-xs">
      <Info className="h-3 w-3 mr-1" />
      Includes Apple MPP
    </Badge>
  </Tooltip>
)}
```

### Gmail Image Proxy Caching

Gmail proxies all images through `googleusercontent.com`, which can cache images and cause multiple opens to appear as one. Accept this as an industry-wide limitation.

---

## 9. User Education

### Tooltip/Info Messages

**Open Rate Card:**
> "Open rate measures how many recipients viewed your email. Due to email client privacy features, the actual open rate may be higher than shown."

**When Open Rate > 50%:**
> "High open rates may include automated opens from Apple Mail Privacy Protection. Focus on reply rates for more accurate engagement metrics."

**Individual Email - Not Opened:**
> "This email hasn't been marked as opened. Note: Some email clients block tracking images, so the recipient may have seen your message."

### Settings Page

Add a section explaining open tracking:

```tsx
<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>About Email Open Tracking</AlertTitle>
  <AlertDescription>
    Open tracking uses a small invisible image to detect when emails are viewed. 
    This method has limitations:
    <ul className="list-disc ml-4 mt-2 space-y-1">
      <li>Recipients with image blocking won't be tracked</li>
      <li>Apple Mail may show false opens due to privacy features</li>
      <li>Corporate email filters may affect tracking accuracy</li>
    </ul>
    Reply rates are generally a more reliable engagement metric.
  </AlertDescription>
</Alert>
```

---

## 10. Implementation Checklist

### Phase 1: Database & Backend
- [ ] Create migration for `email_open_events` table
- [ ] Add columns to `email_messages` table
- [ ] Create tracking token generation/verification functions
- [ ] Create `track-email-open` Edge Function
- [ ] Add trigger to update `email_messages` on open

### Phase 2: Email Sending Integration
- [ ] Modify `sendEmail` to inject tracking pixel for HTML emails
- [ ] Modify `sendBatchEmails` to inject tracking pixels
- [ ] Store `tracking_id` when sending emails
- [ ] Add option to disable tracking per email (if desired)

### Phase 3: Analytics
- [ ] Create `get_email_open_rate` function
- [ ] Create `get_campaign_open_rates` function
- [ ] Update `getAnalyticsSummary` to include open rate
- [ ] Update `getEmailMetricsOverTime` to include open data

### Phase 4: UI Integration
- [ ] Add open indicator to `EmailThreadRow`
- [ ] Add open details to email detail view
- [ ] Add Open Rate card to Analytics dashboard
- [ ] Add Open Rate line to email performance chart
- [ ] Add limitation warnings/tooltips

### Phase 5: Documentation & Testing
- [ ] Add user-facing documentation
- [ ] Test with various email clients
- [ ] Test Apple MPP detection
- [ ] Test deduplication logic
- [ ] Load test tracking endpoint

---

## 11. Future Enhancements

1. **Click tracking**: Track link clicks for more detailed engagement
2. **A/B testing**: Compare open rates between email variants
3. **Best send time analysis**: Analyze when opens occur to optimize send times
4. **Geographic insights**: Show where emails are being opened (country level)
5. **Device breakdown**: Mobile vs desktop open rates
