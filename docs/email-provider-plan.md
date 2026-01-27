# Email Provider Abstraction: Thread ID Tracking

## Goal
Replace current email storage approach with minimal metadata tracking (GDPR-friendly). Store only thread/message IDs and lead correlation. Fetch email content on-demand from Gmail/Outlook.

## New File Structure
```
src/lib/api/email/
├── types.ts           # Shared interfaces
├── emailProvider.ts   # Abstract provider interface
├── gmailProvider.ts   # Gmail implementation (wraps existing)
├── outlookProvider.ts # Outlook stub (future)
├── emailService.ts    # Facade with auto provider detection
├── emailTracking.ts   # Supabase CRUD for tracking metadata
└── index.ts           # Public exports
```

## Database Schema
**Table: `email_tracking_metadata`** (replaces storing full emails)
```sql
- id (UUID)
- user_id (UUID) -> auth.users
- lead_id (UUID, nullable) -> leads
- thread_id (TEXT) -- Gmail threadId / Outlook conversationId
- message_id (TEXT) -- Provider's message ID
- provider (TEXT) -- 'gmail' | 'outlook'
- sent_at (TIMESTAMPTZ)
- label (TEXT, nullable)
- created_at (TIMESTAMPTZ)
```

## Provider Interface
```typescript
interface IEmailProvider {
  provider: 'gmail' | 'outlook'

  // Auth
  isAuthenticated(): Promise<boolean>

  // Send (stores tracking metadata automatically)
  sendEmail(request: SendEmailRequest): Promise<SendEmailResult>
  sendBatchEmails(requests[], onProgress?): Promise<SendEmailResult[]>

  // Fetch on-demand (no storage)
  getThread(threadId): Promise<EmailThread | null>
  getMessage(messageId): Promise<Email | null>
  getRepliesByLabel(labelName, onlyUnread?): Promise<Email[]>

  // Labels
  getLabels(): Promise<Label[]>
  createLabel(name): Promise<string | null>
}
```

## Implementation Steps

### Phase 1: Foundation
1. Create `/src/lib/api/email/types.ts` - All type definitions
2. Create `/src/lib/api/email/emailProvider.ts` - Interface definition
3. Create `/src/lib/api/email/emailTracking.ts` - Supabase CRUD
4. Create migration `supabase/migrations/YYYYMMDD_email_tracking_metadata.sql`

### Phase 2: Gmail Provider
5. Create `/src/lib/api/email/gmailProvider.ts` - Wrap existing gmail.ts
6. Create `/src/lib/api/email/emailService.ts` - Facade layer
7. Create `/src/lib/api/email/index.ts` - Exports

### Phase 3: UI Migration
8. Update `BulkEmailDialog.tsx` - Use emailService, track with lead IDs
9. Update `EmailThreads.tsx` - Use emailService for fetching

### Phase 4: Outlook Stub
10. Create `/src/lib/api/email/outlookProvider.ts` - Interface stub with TODOs

### Phase 5: Cleanup
11. Mark legacy `gmail.ts` functions as @deprecated
12. Test full flow: send -> track -> fetch replies -> correlate to lead

## Files to Modify
- `src/components/BulkEmailDialog.tsx` - Switch to emailService
- `src/pages/EmailThreads.tsx` - Switch to emailService
- `src/lib/api/gmail.ts` - Add deprecation warnings

## Files to Create
- `src/lib/api/email/types.ts`
- `src/lib/api/email/emailProvider.ts`
- `src/lib/api/email/gmailProvider.ts`
- `src/lib/api/email/outlookProvider.ts`
- `src/lib/api/email/emailService.ts`
- `src/lib/api/email/emailTracking.ts`
- `src/lib/api/email/index.ts`
- `supabase/migrations/YYYYMMDD_email_tracking_metadata.sql`

## Verification
1. Send email via BulkEmailDialog -> Check `email_tracking_metadata` table has entry
2. View EmailThreads -> Verify content loads on-demand from Gmail
3. Receive reply -> Verify thread shows reply, can correlate to lead
4. Check no email content is stored in database (only IDs)

## Outlook Compatibility
Same interface, different implementation:
| Gmail | Outlook (Microsoft Graph) |
|-------|---------------------------|
| threadId | conversationId |
| messageId | id |
| labels | folders/categories |
| provider_token | MSAL token |
