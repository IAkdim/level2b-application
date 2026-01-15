-- ============================================================================
-- STRIPE SUBSCRIPTION SCHEMA
-- ============================================================================
-- Migration: stripe_subscriptions
-- Created: 2026-01-15
-- Description: Database schema for Stripe subscription integration
-- ============================================================================

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
-- This is the source of truth for subscription status in the app.
-- All access control decisions are made based on this table, NOT live Stripe API calls.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization reference (subscriptions are per-organization, not per-user)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Stripe identifiers (NULL for enterprise accounts)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Subscription status
  -- 'active' - Subscription is active and paid
  -- 'trialing' - In free trial period
  -- 'past_due' - Payment failed, in grace period
  -- 'canceled' - Subscription ended
  -- 'unpaid' - Multiple payment failures
  -- 'incomplete' - Initial payment pending
  -- 'incomplete_expired' - Initial payment failed
  -- 'paused' - Subscription paused (rare)
  subscription_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (
    subscription_status IN (
      'active', 'trialing', 'past_due', 'canceled', 
      'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    )
  ),
  
  -- Pricing information
  price_id TEXT,
  
  -- Plan tier for easy feature checks
  -- This is derived from price_id but stored for convenience
  plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (
    plan_tier IN ('starter', 'pro', 'enterprise')
  ),
  
  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Cancellation info
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  
  -- Enterprise-specific fields (for manually managed subscriptions)
  is_enterprise BOOLEAN DEFAULT FALSE,
  enterprise_granted_by UUID REFERENCES auth.users(id),
  enterprise_granted_at TIMESTAMPTZ,
  enterprise_notes TEXT,
  
  -- Usage limits (can be customized per subscription)
  leads_per_week_limit INTEGER DEFAULT 1000,
  email_domains_limit INTEGER DEFAULT 1,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one subscription per organization
  CONSTRAINT unique_org_subscription UNIQUE (org_id)
);

-- ============================================================================
-- WEBHOOK EVENTS TABLE (For Idempotency)
-- ============================================================================
-- Stores processed webhook events to prevent duplicate processing

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB,
  processing_error TEXT
);

-- Index for quick duplicate checks
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON stripe_webhook_events(stripe_event_id);

-- Auto-cleanup old events (keep 90 days)
-- You can set up a cron job or pg_cron to run this periodically
-- DELETE FROM stripe_webhook_events WHERE processed_at < NOW() - INTERVAL '90 days';

-- ============================================================================
-- STRIPE CUSTOMERS TABLE
-- ============================================================================
-- Maps users/orgs to Stripe customers for quick lookup

CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_org_customer UNIQUE (org_id)
);

-- ============================================================================
-- BILLING HISTORY TABLE (Optional - for showing invoices in app)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT,
  amount_paid INTEGER NOT NULL, -- In cents
  currency TEXT DEFAULT 'eur',
  status TEXT NOT NULL, -- 'paid', 'open', 'void', 'uncollectible'
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_history_org ON billing_history(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_subscription ON billing_history(stripe_subscription_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(plan_tier);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_org ON stripe_customers(org_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

DROP TRIGGER IF EXISTS stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if an organization has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE org_id = check_org_id
    AND subscription_status IN ('active', 'trialing')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if an organization has access (includes grace period for past_due)
CREATE OR REPLACE FUNCTION public.has_subscription_access(check_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub RECORD;
BEGIN
  SELECT * INTO sub FROM subscriptions WHERE org_id = check_org_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Active or trialing = full access
  IF sub.subscription_status IN ('active', 'trialing') THEN
    RETURN TRUE;
  END IF;
  
  -- Past due = grace period (7 days)
  IF sub.subscription_status = 'past_due' THEN
    RETURN sub.updated_at > NOW() - INTERVAL '7 days';
  END IF;
  
  -- Enterprise accounts always have access
  IF sub.is_enterprise THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get the plan tier for an organization
CREATE OR REPLACE FUNCTION public.get_plan_tier(check_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  tier TEXT;
BEGIN
  SELECT plan_tier INTO tier FROM subscriptions 
  WHERE org_id = check_org_id
  AND subscription_status IN ('active', 'trialing', 'past_due');
  
  RETURN COALESCE(tier, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get subscription details for an organization
CREATE OR REPLACE FUNCTION public.get_subscription_details(check_org_id UUID)
RETURNS TABLE (
  plan_tier TEXT,
  subscription_status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  is_enterprise BOOLEAN,
  leads_per_week_limit INTEGER,
  email_domains_limit INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.plan_tier,
    s.subscription_status,
    s.current_period_end,
    s.cancel_at_period_end,
    s.is_enterprise,
    s.leads_per_week_limit,
    s.email_domains_limit
  FROM subscriptions s
  WHERE s.org_id = check_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Subscriptions: Users can only view subscriptions for their organizations
DROP POLICY IF EXISTS "Users can view their organization subscriptions" ON subscriptions;
CREATE POLICY "Users can view their organization subscriptions"
  ON subscriptions FOR SELECT
  USING (
    org_id IN (
      SELECT uo.org_id FROM user_orgs uo WHERE uo.user_id = auth.uid()
    )
  );

-- Subscriptions: Only service role can modify (webhooks use service role)
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Stripe Customers: Users can view their organization's customer record
DROP POLICY IF EXISTS "Users can view their organization stripe customer" ON stripe_customers;
CREATE POLICY "Users can view their organization stripe customer"
  ON stripe_customers FOR SELECT
  USING (
    org_id IN (
      SELECT uo.org_id FROM user_orgs uo WHERE uo.user_id = auth.uid()
    )
  );

-- Stripe Customers: Only service role can modify
DROP POLICY IF EXISTS "Service role can manage stripe customers" ON stripe_customers;
CREATE POLICY "Service role can manage stripe customers"
  ON stripe_customers FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Webhook Events: Only service role can access
DROP POLICY IF EXISTS "Service role can manage webhook events" ON stripe_webhook_events;
CREATE POLICY "Service role can manage webhook events"
  ON stripe_webhook_events FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Billing History: Users can view their organization's billing history
DROP POLICY IF EXISTS "Users can view their organization billing history" ON billing_history;
CREATE POLICY "Users can view their organization billing history"
  ON billing_history FOR SELECT
  USING (
    org_id IN (
      SELECT uo.org_id FROM user_orgs uo WHERE uo.user_id = auth.uid()
    )
  );

-- Billing History: Only service role can modify
DROP POLICY IF EXISTS "Service role can manage billing history" ON billing_history;
CREATE POLICY "Service role can manage billing history"
  ON billing_history FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON stripe_customers TO authenticated;
GRANT SELECT ON billing_history TO authenticated;
GRANT ALL ON stripe_webhook_events TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON stripe_customers TO service_role;
GRANT ALL ON billing_history TO service_role;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION has_active_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION has_subscription_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_tier TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_details TO authenticated;
