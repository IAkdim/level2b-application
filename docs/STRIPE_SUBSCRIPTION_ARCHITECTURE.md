# Level2B Stripe Subscription Architecture

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LEVEL2B APPLICATION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐ │
│  │   React     │───▶│  Supabase Edge   │───▶│      Stripe Checkout        │ │
│  │   App       │    │  Function        │    │      (Hosted Page)          │ │
│  │             │    │  (create-        │    │                             │ │
│  │             │    │   checkout)      │    └─────────────────────────────┘ │
│  └─────────────┘    └──────────────────┘                                    │
│        │                                                                    │
│        │ Access Control                                                     │
│        ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         SUPABASE DATABASE                            │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │  subscriptions table (Source of Truth)                       │    │   │
│  │  │  - stripe_customer_id                                        │    │   │
│  │  │  - stripe_subscription_id                                    │    │   │
│  │  │  - subscription_status (active|past_due|canceled|trialing)   │    │   │
│  │  │  - price_id                                                  │    │   │
│  │  │  - plan_tier (starter|pro|enterprise)                        │    │   │
│  │  │  - current_period_end                                        │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
└────────────────────────────────────│────────────────────────────────────────┘
                                     │
                                     │ Webhooks (Real-time sync)
                                     │
┌────────────────────────────────────│────────────────────────────────────────┐
│                                    │                                        │
│  ┌──────────────────┐    ┌─────────┴────────┐    ┌───────────────────────┐  │
│  │  Stripe          │───▶│  Supabase Edge   │───▶│  Update Supabase      │  │
│  │  Webhooks        │    │  Function        │    │  Tables               │  │
│  │  (Events)        │    │  (stripe-        │    │                       │  │
│  │                  │    │   webhook)       │    │                       │  │
│  └──────────────────┘    └──────────────────┘    └───────────────────────┘  │
│                                                                             │
│                              STRIPE                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why This Architecture?

### 1. **Stripe Checkout (Not Embedded Payment Forms)**

**Opinion:** Always use Stripe Checkout for B2B SaaS subscriptions. Here's why:

- **PCI Compliance**: Stripe Checkout is fully PCI compliant out of the box. You never touch card data.
- **Conversion Optimization**: Stripe continuously A/B tests their checkout flow. You get free conversion improvements.
- **Payment Methods**: Automatically supports SEPA, iDEAL, Bancontact, etc. for European customers (€ pricing).
- **Tax Handling**: Stripe Tax can be enabled with one click.
- **Less Code**: No frontend payment form to maintain.

**Bad Alternative:** Using Stripe Elements with custom forms adds complexity, requires more security considerations, and gives you no conversion benefits.

### 2. **Webhook-Based Sync (Stripe Sync Engine Pattern)**

**Opinion:** Never poll Stripe. Always use webhooks.

- **Real-time**: Subscription changes reflect immediately.
- **Cost-effective**: No API rate limits or extra API calls.
- **Reliable**: Stripe retries failed webhooks automatically.
- **Auditable**: Every change is logged.

### 3. **Supabase as Source of Truth for Access Control**

**Opinion:** Your app should NEVER call Stripe to check subscription status at runtime.

- **Performance**: Database queries are faster than API calls.
- **Reliability**: Works even if Stripe is down.
- **Cost**: No Stripe API usage for access checks.
- **Simplicity**: Single data source for your app logic.

---

## Subscription Flow

### New User Signup Flow

```
1. User signs in via Google OAuth (existing)
2. App checks subscriptions table for active subscription
3. No subscription → Redirect to /subscribe (paywall)
4. User selects plan (Starter €199 or Pro €299)
5. Create Checkout Session → Redirect to Stripe
6. User completes payment
7. Stripe fires webhooks:
   - checkout.session.completed
   - customer.subscription.created
   - invoice.paid
8. Webhook handler creates/updates subscriptions table
9. User redirected back to app
10. App sees active subscription → Grant access
```

### Upgrade/Downgrade Flow

```
1. User clicks "Upgrade" in billing settings
2. Create Customer Portal session (or new checkout)
3. User changes plan on Stripe
4. Stripe fires webhooks:
   - customer.subscription.updated
   - invoice.paid (if upgrading mid-cycle)
5. Webhook handler updates subscriptions table
6. App immediately sees new plan_tier
7. Feature access changes in real-time
```

### Cancellation Flow

```
1. User clicks "Cancel" in Customer Portal
2. Stripe fires: customer.subscription.updated (status: canceled, cancel_at_period_end: true)
3. Webhook updates subscription (still active until period end)
4. At period end, Stripe fires: customer.subscription.deleted
5. Webhook updates status to "canceled"
6. App sees inactive subscription → Paywall
```

---

## Why Stripe Customer Portal

**Opinion:** Always use Stripe Customer Portal for billing management.

- **Update payment method**: Users can fix failed payments themselves.
- **View invoices**: Automatic invoice history.
- **Upgrade/Downgrade**: Self-service plan changes.
- **Cancel**: Users can cancel without support tickets.
- **Tax compliance**: Stripe handles tax receipts.

Building your own billing management UI is a waste of time for a B2B SaaS. Use Customer Portal.

---

## Enterprise Tier Handling

Enterprise users bypass Stripe but fit the same permission system:

```sql
-- Enterprise user example
INSERT INTO subscriptions (
  org_id,
  plan_tier,
  subscription_status,
  is_enterprise,
  enterprise_granted_by,
  enterprise_granted_at
) VALUES (
  'org-uuid',
  'enterprise',
  'active',
  TRUE,
  'admin-user-uuid',
  NOW()
);
```

The `is_enterprise` flag indicates manual management. No `stripe_subscription_id` needed.

---

## Feature Access Matrix

| Feature | Starter (€199) | Pro (€299) | Enterprise |
|---------|----------------|------------|------------|
| Lead Generation | 1000/week | Unlimited | Unlimited |
| Email Domains | 1 | Multiple | Multiple |
| Analytics | ✓ | ✓ | ✓ |
| Cold Outreach | ✓ | ✓ | ✓ |
| Priority Support | ✗ | ✓ | ✓ |
| Custom Features | ✗ | ✗ | ✓ |

---

## Common Pitfalls & How to Avoid Them

### 1. **Not Handling `past_due` Status**

**Problem:** User's card fails, subscription goes `past_due`, but you still give access.

**Solution:** Treat `past_due` as a grace period (3-7 days), then restrict access. Show a banner prompting payment update.

```typescript
const hasAccess = ['active', 'trialing'].includes(subscription.status) ||
  (subscription.status === 'past_due' && isWithinGracePeriod(subscription));
```

### 2. **Webhook Signature Verification**

**Problem:** Anyone can POST fake webhook events to your endpoint.

**Solution:** ALWAYS verify the Stripe signature. No exceptions.

```typescript
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  STRIPE_WEBHOOK_SECRET
);
```

### 3. **Idempotency**

**Problem:** Stripe can retry webhooks. Processing the same event twice creates bugs.

**Solution:** Store `stripe_event_id` and check for duplicates:

```sql
-- Before processing
SELECT 1 FROM webhook_events WHERE stripe_event_id = $1;
-- If exists, skip processing
```

### 4. **Race Conditions on Checkout**

**Problem:** User completes checkout, immediately returns to app, but webhook hasn't processed yet.

**Solution:** 
- Option A: Poll Supabase briefly on return (simple)
- Option B: Use `checkout.session.completed` to immediately sync (better)

### 5. **Not Storing `current_period_end`**

**Problem:** You can't show users when their subscription renews.

**Solution:** Always sync `current_period_end` from Stripe.

### 6. **Hardcoding Price IDs**

**Problem:** Price IDs change between test/live mode and when you create new plans.

**Solution:** Use environment variables and a mapping:

```typescript
const PRICE_TO_TIER: Record<string, PlanTier> = {
  [process.env.STRIPE_PRICE_STARTER!]: 'starter',
  [process.env.STRIPE_PRICE_PRO!]: 'pro',
};
```

### 7. **Not Testing Webhook Locally**

**Problem:** You can't test webhooks without deploying.

**Solution:** Use Stripe CLI:

```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

### 8. **Forgetting to Handle Subscription Updates**

**Problem:** User upgrades but your app still shows old plan.

**Solution:** Handle `customer.subscription.updated` event, not just `created`.

---

## Security Considerations

1. **Webhook Endpoint**: Must verify Stripe signature
2. **Checkout Session**: Include `client_reference_id` (user/org ID) for correlation
3. **Customer Portal**: Generate session server-side, never expose API keys
4. **RLS Policies**: Users can only read their own subscription data
5. **No Client-Side Access Checks**: Always check subscription status server-side or via RLS

---

## Testing Checklist

- [ ] New user can subscribe to Starter
- [ ] New user can subscribe to Pro
- [ ] Webhook creates subscription record
- [ ] User with active subscription can access app
- [ ] User without subscription sees paywall
- [ ] Upgrade from Starter to Pro works
- [ ] Downgrade from Pro to Starter works
- [ ] Cancellation keeps access until period end
- [ ] Past due shows warning banner
- [ ] Canceled user sees paywall
- [ ] Enterprise user has access without Stripe
- [ ] Webhook signature verification works
- [ ] Duplicate webhooks are handled
- [ ] Customer Portal access works
