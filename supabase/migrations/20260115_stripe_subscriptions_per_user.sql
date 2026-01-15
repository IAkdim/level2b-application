-- ============================================================================
-- STRIPE SUBSCRIPTION SCHEMA - PER USER
-- ============================================================================
-- Migration: stripe_subscriptions_per_user
-- Created: 2026-01-15
-- Description: Database schema for Stripe subscription integration (per-user model)
-- ============================================================================

-- Drop old org-based tables if they exist (clean slate)
DROP TABLE IF EXISTS public.billing_history CASCADE;
DROP TABLE IF EXISTS public.stripe_customers CASCADE;
DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.has_active_subscription(UUID);
DROP FUNCTION IF EXISTS public.has_subscription_access(UUID);
DROP FUNCTION IF EXISTS public.get_plan_tier(UUID);
DROP FUNCTION IF EXISTS public.get_subscription_details(UUID);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
-- This is the source of truth for subscription status in the app.
-- Subscriptions are per-user (account), not per-organization.

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference (subscriptions are per-user/account)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe identifiers (NULL for enterprise accounts)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Subscription status
  subscription_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (
    subscription_status IN (
      'active', 'trialing', 'past_due', 'canceled', 
      'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    )
  ),
  
  -- Pricing information
  price_id TEXT,
  
  -- Plan tier for easy feature checks
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
  
  -- Ensure one subscription per user
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- ============================================================================
-- WEBHOOK EVENTS TABLE (For Idempotency)
-- ============================================================================

CREATE TABLE public.stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB,
  processing_error TEXT
);

-- Index for quick duplicate checks
CREATE INDEX idx_webhook_events_stripe_id ON stripe_webhook_events(stripe_event_id);

-- ============================================================================
-- STRIPE CUSTOMERS TABLE
-- ============================================================================
-- Maps users to Stripe customers for quick lookup

CREATE TABLE public.stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_customer UNIQUE (user_id)
);

-- ============================================================================
-- BILLING HISTORY TABLE
-- ============================================================================

CREATE TABLE public.billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_billing_history_user ON billing_history(user_id);
CREATE INDEX idx_billing_history_subscription ON billing_history(stripe_subscription_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(subscription_status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(plan_tier);
CREATE INDEX idx_stripe_customers_user ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);

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

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

CREATE TRIGGER stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if a user has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = check_user_id
    AND subscription_status IN ('active', 'trialing')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a user has access (includes grace period for past_due)
CREATE OR REPLACE FUNCTION public.has_subscription_access(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub RECORD;
BEGIN
  SELECT * INTO sub FROM subscriptions WHERE user_id = check_user_id;
  
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

-- Get the plan tier for a user
CREATE OR REPLACE FUNCTION public.get_plan_tier(check_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  tier TEXT;
BEGIN
  SELECT plan_tier INTO tier FROM subscriptions 
  WHERE user_id = check_user_id
  AND subscription_status IN ('active', 'trialing', 'past_due');
  
  RETURN COALESCE(tier, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get subscription details for a user
CREATE OR REPLACE FUNCTION public.get_subscription_details(check_user_id UUID)
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
  WHERE s.user_id = check_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Subscriptions: Users can only view their own subscription
CREATE POLICY "Users can view their own subscription"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Subscriptions: Only service role can modify (webhooks use service role)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Stripe Customers: Users can view their own customer record
CREATE POLICY "Users can view their own stripe customer"
  ON stripe_customers FOR SELECT
  USING (user_id = auth.uid());

-- Stripe Customers: Only service role can modify
CREATE POLICY "Service role can manage stripe customers"
  ON stripe_customers FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Webhook Events: Only service role can access
CREATE POLICY "Service role can manage webhook events"
  ON stripe_webhook_events FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Billing History: Users can view their own billing history
CREATE POLICY "Users can view their own billing history"
  ON billing_history FOR SELECT
  USING (user_id = auth.uid());

-- Billing History: Only service role can modify
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

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
