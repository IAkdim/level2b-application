# Stripe Subscription Implementation Summary

## What Was Created

This implementation provides a complete Stripe subscription system following the **Stripe Sync Engine** pattern, where Supabase is the single source of truth for subscription status.

---

## Files Created

### Database Schema
- [supabase/migrations/20260115_stripe_subscriptions.sql](supabase/migrations/20260115_stripe_subscriptions.sql) - Complete database schema including:
  - `subscriptions` table - Main subscription state
  - `stripe_customers` table - Customer mapping
  - `stripe_webhook_events` table - Idempotency tracking
  - `billing_history` table - Invoice records
  - Helper functions (`has_active_subscription`, `has_subscription_access`, `get_plan_tier`)
  - Row Level Security policies

### Supabase Edge Functions
- [supabase/functions/stripe-webhook/index.ts](supabase/functions/stripe-webhook/index.ts) - Webhook handler for all Stripe events
- [supabase/functions/create-checkout-session/index.ts](supabase/functions/create-checkout-session/index.ts) - Creates Stripe Checkout sessions
- [supabase/functions/create-portal-session/index.ts](supabase/functions/create-portal-session/index.ts) - Creates Customer Portal sessions

### Frontend Types & Hooks
- [src/types/subscription.ts](src/types/subscription.ts) - TypeScript types and plan configuration
- [src/hooks/useSubscription.ts](src/hooks/useSubscription.ts) - Subscription data fetching and Stripe interactions
- [src/contexts/SubscriptionContext.tsx](src/contexts/SubscriptionContext.tsx) - App-wide subscription state

### Frontend Components
- [src/components/SubscriptionGate.tsx](src/components/SubscriptionGate.tsx) - Route/feature protection
- [src/components/PaymentRequiredBanner.tsx](src/components/PaymentRequiredBanner.tsx) - Payment status banners

### Frontend Pages
- [src/pages/Subscribe.tsx](src/pages/Subscribe.tsx) - Plan selection paywall
- [src/pages/SubscribeSuccess.tsx](src/pages/SubscribeSuccess.tsx) - Post-checkout confirmation
- [src/pages/BillingSettings.tsx](src/pages/BillingSettings.tsx) - Billing management page

### Documentation
- [docs/STRIPE_SUBSCRIPTION_ARCHITECTURE.md](docs/STRIPE_SUBSCRIPTION_ARCHITECTURE.md) - Architecture overview and best practices
- [docs/STRIPE_SETUP_GUIDE.md](docs/STRIPE_SETUP_GUIDE.md) - Step-by-step setup instructions

### Configuration
- [.env.example](.env.example) - Environment variables template
- Updated [src/App.tsx](src/App.tsx) - Added subscription routes and providers

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React App      │────▶│  Supabase Edge   │────▶│  Stripe         │
│                 │     │  Functions       │     │  Checkout       │
└────────┬────────┘     └──────────────────┘     └────────┬────────┘
         │                                                │
         │ RLS                                            │ Webhooks
         ▼                                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SUPABASE DATABASE                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ subscriptions (SOURCE OF TRUTH)                              │    │
│  │ - org_id, stripe_customer_id, stripe_subscription_id        │    │
│  │ - subscription_status, plan_tier, price_id                  │    │
│  │ - current_period_end, cancel_at_period_end                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Creates subscription record after checkout |
| `customer.subscription.created` | Syncs new subscription to database |
| `customer.subscription.updated` | Updates plan changes, renewals, cancellations |
| `customer.subscription.deleted` | Marks subscription as canceled |
| `invoice.paid` | Records payment in billing history |
| `invoice.payment_failed` | Logs failure, status auto-updates to `past_due` |
| `customer.updated` | Syncs customer email/name changes |

---

## Access Control Flow

```
User Accesses App
       │
       ▼
┌──────────────────┐
│ ProtectedRoute   │──────▶ Not logged in? → /login
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ OrganizationCheck│──────▶ No org? → /select-organization
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ SubscriptionGate │──────▶ No subscription? → /subscribe
└────────┬─────────┘
         │ Active subscription
         ▼
    ┌─────────┐
    │  App    │
    └─────────┘
```

---

## Subscription Status Handling

| Status | App Behavior |
|--------|--------------|
| `active` | Full access |
| `trialing` | Full access |
| `past_due` | 7-day grace period, then paywall |
| `canceled` | Paywall (access until period end if `cancel_at_period_end`) |
| `unpaid` | Paywall |
| `incomplete` | Paywall |
| Enterprise | Full access (no Stripe) |

---

## Feature Gating Examples

```tsx
// Basic subscription check
<SubscriptionGate>
  <ProtectedContent />
</SubscriptionGate>

// Require Pro tier
<SubscriptionGate requiredTier="pro">
  <ProOnlyFeature />
</SubscriptionGate>

// Check limits in code
const { canGenerateLeads, canAddEmailDomain } = useSubscriptionContext()

if (!canGenerateLeads(requestedCount)) {
  showUpgradePrompt()
}
```

---

## Quick Start

1. **Run the migration:**
   ```bash
   supabase db push
   ```

2. **Create Stripe products** (see [STRIPE_SETUP_GUIDE.md](docs/STRIPE_SETUP_GUIDE.md))

3. **Set environment variables:**
   ```bash
   # Supabase secrets
   supabase secrets set STRIPE_SECRET_KEY=sk_xxx
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   supabase secrets set STRIPE_PRICE_STARTER=price_xxx
   supabase secrets set STRIPE_PRICE_PRO=price_xxx
   supabase secrets set APP_URL=https://your-app.com
   ```

4. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy stripe-webhook
   supabase functions deploy create-checkout-session
   supabase functions deploy create-portal-session
   ```

5. **Add webhook endpoint in Stripe Dashboard**

6. **Add frontend env vars to `.env.local`**

---

## Opinionated Decisions Made

1. **Stripe Checkout over Embedded Forms** - Better conversion, PCI compliance, supports European payment methods.

2. **Webhooks over Polling** - Real-time, no rate limits, Stripe handles retries.

3. **Supabase as Source of Truth** - No runtime Stripe API calls for access checks.

4. **Per-Organization Subscriptions** - B2B model where the org pays, not individual users.

5. **Customer Portal for Billing Management** - Don't reinvent the wheel; Stripe handles payment updates, plan changes, cancellations.

6. **7-Day Grace Period for Past Due** - Balances user experience with revenue protection.

7. **Enterprise Bypass** - Same permission system, but manually managed via Supabase.

---

## Testing Checklist

- [ ] New user without subscription sees paywall
- [ ] Checkout creates subscription in database
- [ ] Active subscription grants app access
- [ ] Upgrade/downgrade updates plan tier
- [ ] Cancellation shows until period end
- [ ] Past due shows warning, grants grace period
- [ ] Customer Portal opens correctly
- [ ] Enterprise users bypass Stripe
- [ ] Webhook idempotency prevents duplicates
