# Stripe Setup Guide for Level2B

This guide walks you through setting up Stripe for the Level2B subscription system.

## 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete business verification
3. Enable Euro (EUR) as your currency

## 2. Create Products and Prices

### In Stripe Dashboard:

1. Go to **Products** → **Add Product**

#### Product 1: Starter Plan
```
Name: Level2B Starter
Description: Lead generation capped at 1000 leads per week, cold outreach, analytics
```
- Add a price:
  - Price: €199.00
  - Billing period: Monthly
  - Currency: EUR
  
Copy the Price ID (looks like `price_1ABC123...`)

#### Product 2: Pro Plan
```
Name: Level2B Pro
Description: Unlimited lead generation, multiple email domains, analytics, priority support
```
- Add a price:
  - Price: €299.00
  - Billing period: Monthly
  - Currency: EUR

Copy the Price ID

## 3. Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer portal**
2. Enable the following features:
   - ✅ Update payment methods
   - ✅ View invoice history
   - ✅ Cancel subscriptions
   - ✅ Switch plans (add your Starter and Pro products)
3. Configure business information:
   - Support email
   - Support phone (optional)
   - Privacy policy URL
   - Terms of service URL
4. Save changes

## 4. Create Webhook Endpoint

### For Production:

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook`
3. Select events to listen:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.updated`
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_`)

### For Local Development:

Use the Stripe CLI:

```bash
# Install Stripe CLI
# Windows (with Scoop):
scoop install stripe

# macOS (with Homebrew):
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local Supabase
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# The CLI will display a webhook signing secret (whsec_...)
# Use this for local development
```

## 5. Environment Variables

### Supabase Edge Functions (set via Supabase Dashboard or CLI):

```bash
# In Supabase Dashboard: Settings → Edge Functions → Secrets
# Or via CLI:
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_KEY
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
supabase secrets set STRIPE_PRICE_STARTER=price_YOUR_STARTER_PRICE_ID
supabase secrets set STRIPE_PRICE_PRO=price_YOUR_PRO_PRICE_ID
supabase secrets set APP_URL=https://your-app-domain.com
```

### Frontend (.env file):

```env
# .env.local (for development)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
VITE_STRIPE_PRICE_STARTER=price_YOUR_STARTER_PRICE_ID
VITE_STRIPE_PRICE_PRO=price_YOUR_PRO_PRICE_ID

# .env.production
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
VITE_STRIPE_PRICE_STARTER=price_YOUR_STARTER_PRICE_ID
VITE_STRIPE_PRICE_PRO=price_YOUR_PRO_PRICE_ID
```

## 6. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
```

## 7. Run Database Migration

```bash
# Apply the subscription schema
supabase db push

# Or run the migration directly
supabase migration up
```

## 8. Test the Integration

### Test Checkout Flow:

1. Use Stripe test card: `4242 4242 4242 4242`
2. Any future expiry date
3. Any CVC
4. Any billing address

### Test Webhook Events:

```bash
# Trigger test events via Stripe CLI
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
```

### Test Card Numbers:

| Scenario | Card Number |
|----------|-------------|
| Success | 4242 4242 4242 4242 |
| Requires authentication | 4000 0025 0000 3155 |
| Declined | 4000 0000 0000 9995 |
| Insufficient funds | 4000 0000 0000 9995 |

## 9. Go Live Checklist

- [ ] Switch from test to live API keys
- [ ] Create live webhook endpoint
- [ ] Update all environment variables with live keys
- [ ] Test with a real card (you can refund immediately)
- [ ] Verify webhook events are being received
- [ ] Check subscription records in Supabase

## Troubleshooting

### Webhook signature verification failed
- Ensure you're using the correct webhook secret
- Make sure the raw request body is being used (not parsed JSON)

### Checkout session not creating subscription record
- Check the `client_reference_id` is being set (should be org_id)
- Verify webhook is receiving events (check Stripe dashboard)
- Check Supabase Edge Function logs

### Customer Portal not showing upgrade options
- Ensure products are added to the portal configuration
- Both Starter and Pro products must be in the same product catalog

### User has access but subscription shows incomplete
- This can happen if checkout was abandoned after payment
- Check if `checkout.session.completed` webhook was received
- Manually sync from Stripe if needed

## Support

For Stripe-specific issues: [Stripe Support](https://support.stripe.com/)
For Level2B issues: support@level2b.com
