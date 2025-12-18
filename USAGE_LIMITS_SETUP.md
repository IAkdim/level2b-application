# Daily Usage Limits Setup

This document explains how to set up daily usage limits for template generation and email sending.

## What Was Implemented

Daily usage limits to prevent excessive API usage and costs:
- **Templates**: 10 generations per day (default)
- **Emails**: 50 sends per day (default)

## Database Migration

The migration file is located at: `supabase/migrations/20251218_usage_limits.sql`

### To Apply the Migration

**Option 1: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20251218_usage_limits.sql`
5. Paste it into the SQL editor
6. Click **Run** to execute

**Option 2: Using Supabase CLI**
```bash
cd level2b-application
npx supabase db push
```

Note: If you get migration history errors, you may need to repair or manually apply the SQL.

## What the Migration Creates

### 1. Organization Columns
Adds to `organizations` table:
- `daily_template_limit` (default: 10)
- `daily_email_limit` (default: 50)

### 2. Daily Usage Table
Creates `daily_usage` table to track:
- `templates_generated` - Number of templates generated today
- `emails_sent` - Number of emails sent today
- Automatically resets at midnight (one record per org per day)

### 3. Database Functions

**`get_daily_usage(org_id)`**
Returns current usage and remaining quota:
```sql
SELECT * FROM get_daily_usage('your-org-id');
```

**`check_usage_limit(org_id, action_type)`**
Checks if action is allowed:
```sql
SELECT check_usage_limit('your-org-id', 'template'); -- Returns true/false
```

**`increment_usage(org_id, action_type, amount)`**
Increments counter if under limit:
```sql
SELECT increment_usage('your-org-id', 'template', 1); -- Returns true if incremented, false if limit reached
```

**`reset_daily_usage(org_id)`**
Manually reset usage (for testing):
```sql
SELECT reset_daily_usage('your-org-id');
```

## Code Implementation

### Frontend Integration (Templates.tsx)

The UI now shows:
1. **Usage Quota Card** - Displays remaining templates (e.g., "8/10 templates remaining")
2. **Progress Bar** - Visual indicator of usage
3. **Reset Timer** - Shows when quota resets ("Resets in 5h 23m")
4. **Disabled Button** - Generate button is disabled when limit reached

### API Integration (usageLimits.ts)

New API functions:
- `getDailyUsage(orgId)` - Fetches current usage
- `checkUsageLimit(orgId, actionType)` - Checks if allowed
- `incrementUsage(orgId, actionType)` - Increments counter
- `formatUsageLimitError(error)` - Formats error message
- `getTimeUntilReset()` - Calculates time until midnight

### Usage Flow

1. User clicks "Generate Template"
2. System checks: `checkUsageLimit(orgId, 'template')`
3. If allowed:
   - Generate template via AI
   - Call: `incrementUsage(orgId, 'template')`
   - Update UI with new quota
4. If limit reached:
   - Show error message
   - Display reset timer
   - Disable generate button

## Customizing Limits

### Per Organization
Update limits for specific organization:
```sql
UPDATE organizations 
SET 
  daily_template_limit = 100,  -- Change to desired limit
  daily_email_limit = 500      -- Change to desired limit
WHERE id = 'your-org-id';
```

### Global Default
Change default for new organizations by editing the migration file:
```sql
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS daily_template_limit INTEGER DEFAULT 10,  -- Change this
ADD COLUMN IF NOT EXISTS daily_email_limit INTEGER DEFAULT 50;     -- Change this
```

## Pricing Tiers (Future)

You can create different tiers:

**Free Tier**
- 10 templates/day
- 50 emails/day

**Pro Tier**
- 100 templates/day
- 500 emails/day

**Enterprise Tier**
- 999999 templates/day (unlimited)
- 999999 emails/day (unlimited)

## Testing

### Test Limit Enforcement
1. Generate templates until you reach the limit (10 by default)
2. Try to generate 11th template
3. Should see error: "Daily template generation limit reached (10/10)"

### Test Midnight Reset
Option 1: Wait until midnight
Option 2: Manually reset:
```sql
SELECT reset_daily_usage('your-org-id');
```

### Test Concurrent Requests
The database uses `ON CONFLICT` to handle race conditions, ensuring accurate counting even with concurrent requests.

## Troubleshooting

### "Failed to load usage limits"
- Check if migration was applied successfully
- Verify organization exists in database
- Check browser console for detailed error

### Counter Not Incrementing
- Check if `increment_usage()` function exists
- Verify RLS policies allow your user to call the function
- Check Supabase logs for errors

### Usage Not Resetting at Midnight
- The system uses `CURRENT_DATE` which resets automatically
- Each day creates a new record with `usage_date = CURRENT_DATE`
- Old records remain for historical tracking

## Next Steps

1. **Apply Migration** - Use Supabase dashboard SQL editor
2. **Test Frontend** - Run `npm run dev` and try generating templates
3. **Monitor Usage** - Check `daily_usage` table to see tracking
4. **Email Limits** - Apply same pattern to email sending functionality
5. **Admin UI** - Create organization settings page to adjust limits

## Support

If you encounter issues:
1. Check Supabase logs in dashboard
2. Verify migration was applied: `SELECT * FROM daily_usage LIMIT 1;`
3. Test functions manually in SQL editor
4. Check browser console for frontend errors
