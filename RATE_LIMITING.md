# Rate Limiting System

## Overview

This application implements a comprehensive rate limiting system to:
- **Prevent API abuse** and excessive usage
- **Control costs** for expensive APIs (AI, Gmail, etc.)
- **Ensure fair resource allocation** across users
- **Protect against accidental infinite loops** or bugs

## Implementation

### Core System

The rate limiter is implemented in `src/lib/api/rateLimiter.ts` as a singleton class that tracks request counts per user per API category.

### Rate Limit Categories

| Category | Limit | Window | Usage |
|----------|-------|--------|-------|
| **ai** | 30 req/min | 60s | Claude/AI API calls (sentiment analysis, reply generation) |
| **gmail** | 100 req/min | 60s | Gmail API operations (read, send emails) |
| **calendly** | 500 req/min | 60s | Calendly API calls |
| **database** | 500 req/min | 60s | Database queries (Supabase) |
| **email_send** | 50 req/min | 60s | Email sending operations |
| **templates** | 200 req/min | 60s | Template operations |
| **settings** | 100 req/min | 60s | Settings CRUD operations |
| **default** | 100 req/min | 60s | Fallback for uncategorized requests |

### Protected APIs

Rate limiting has been applied to:

1. **AI/Claude APIs** (`claude-secure.ts`)
   - `analyzeSentiment()` - Sentiment analysis
   - `generateSalesReply()` - AI reply generation

2. **Gmail APIs** (`gmail.ts`)
   - `sendEmail()` - Email sending
   - `sendBatchEmails()` - Batch email operations

3. **Database Operations** (`leads.ts`)
   - `getLeads()` - Lead queries

4. **Calendly APIs** (`calendly.ts`)
   - `getCalendlyEventTypes()` - Event type fetching

## Usage

### Checking Rate Limits

```typescript
import { rateLimiter } from '@/lib/api/rateLimiter'

// Check if request is allowed
const check = await rateLimiter.checkLimit('ai', userId)
if (!check.allowed) {
  throw new Error(check.message)
}
```

### Wrapping Functions

```typescript
// Automatically rate limit any async function
const result = await rateLimiter.withRateLimit(
  'ai',
  async () => {
    // Your API call here
    return await someExpensiveOperation()
  },
  userId
)
```

### React Hooks

```typescript
import { useRateLimitStatus } from '@/hooks/useRateLimitStatus'

function MyComponent() {
  const status = useRateLimitStatus('ai')
  
  return (
    <div>
      {status && (
        <p>AI API: {status.remaining}/{status.limit} requests remaining</p>
      )}
    </div>
  )
}
```

### UI Components

```typescript
import { RateLimitWarning } from '@/components/RateLimitWarning'

function EmailPage() {
  return (
    <div>
      <RateLimitWarning category="email_send" />
      {/* Your content */}
    </div>
  )
}
```

## Features

### 1. Per-User Tracking
- Each user has independent rate limits
- Anonymous users tracked separately
- Limits reset per time window

### 2. Automatic Cleanup
- Expired records cleaned up every 5 minutes
- Prevents memory leaks
- Automatic window reset

### 3. Warning System
- Console warnings when limits approached (5 remaining)
- Error messages when limit exceeded
- Reset time included in error messages

### 4. Usage Statistics
```typescript
const stats = rateLimiter.getUsageStats('ai', userId)
// Returns: { current: 25, limit: 30, remaining: 5 }
```

### 5. Dynamic Configuration
```typescript
// Update rate limits at runtime (admin function)
rateLimiter.updateConfig('ai', 50, 60 * 1000)
```

### 6. Manual Reset
```typescript
// Reset specific category for user
rateLimiter.reset('ai', userId)

// Reset all for category
rateLimiter.reset('ai')

// Reset everything
rateLimiter.reset()
```

## Error Handling

When rate limit is exceeded:

```typescript
// Error thrown with user-friendly message
throw new Error('Rate limit exceeded for AI API. Please wait 45 seconds.')
```

The error includes:
- Clear explanation of what was rate limited
- Time until reset
- Category name for context

## Best Practices

### 1. Check Limits Early
```typescript
// Check BEFORE expensive operations
const check = await rateLimiter.checkLimit('ai', userId)
if (!check.allowed) {
  return earlyError()
}
// Proceed with expensive operation
```

### 2. Show UI Feedback
```typescript
// Warn users before they hit limits
<RateLimitWarning category="ai" showAlways={true} />
```

### 3. Handle Gracefully
```typescript
try {
  await someRateLimitedFunction()
} catch (error) {
  if (error.message.includes('Rate limit')) {
    toast.error('Too many requests. Please wait a moment.')
  }
}
```

### 4. Batch Operations
```typescript
// For batch operations, add delays
for (const item of items) {
  await processItem(item)
  await new Promise(r => setTimeout(r, 500)) // 500ms delay
}
```

## Monitoring

### Console Logging
- ⚠️ Warning when 5 or fewer requests remaining
- ❌ Error when limit exceeded
- ✓ Success with stats

### Usage Stats
```typescript
// Get current usage for monitoring
const stats = rateLimiter.getUsageStats('ai', userId)
console.log(`AI Usage: ${stats.current}/${stats.limit}`)
```

## Configuration

### Adjusting Limits

Edit `src/lib/api/rateLimiter.ts`:

```typescript
private configs: Map<string, RateLimitConfig> = new Map([
  ['ai', { 
    maxRequests: 30,     // <-- Adjust this
    windowMs: 60 * 1000, // <-- Or this (60 seconds)
    category: 'AI API' 
  }],
  // ...
])
```

### Adding New Categories

1. Add to rate limiter config:
```typescript
['my_category', { 
  maxRequests: 100, 
  windowMs: 60 * 1000, 
  category: 'My API' 
}],
```

2. Add to TypeScript type:
```typescript
export type RateLimitCategory = 
  | 'ai' 
  | 'my_category' // <-- Add here
  | 'gmail'
```

3. Use in your API:
```typescript
const check = await rateLimiter.checkLimit('my_category', userId)
```

## Security Considerations

1. **Client-side only**: This is client-side rate limiting, primarily for cost control
2. **Not foolproof**: Determined users can bypass by clearing browser state
3. **Server-side needed**: For production, implement server-side rate limiting
4. **Supabase RLS**: Database still protected by Row Level Security

## Future Enhancements

- [ ] Persist rate limit data to database
- [ ] Admin dashboard for monitoring
- [ ] Different limits per user tier (free/paid)
- [ ] Automatic throttling (gradually reduce rate)
- [ ] Distributed rate limiting (multi-tab aware)
- [ ] Server-side enforcement via Supabase Edge Functions

## Troubleshooting

### "Rate limit exceeded" errors

1. Check current usage:
```typescript
const stats = rateLimiter.getUsageStats(category, userId)
console.log(stats)
```

2. Wait for window to reset (check `resetTime`)

3. Manually reset if needed:
```typescript
rateLimiter.reset(category, userId)
```

### Limits too restrictive

1. Increase limits in config
2. Or implement queuing/batching
3. Consider caching results

### Not working

1. Check if imported correctly
2. Verify userId is passed
3. Check console for rate limit logs
4. Ensure cleanup interval running
