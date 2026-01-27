-- ============================================================================
-- FIX PRO SUBSCRIPTIONS - Data Migration
-- ============================================================================
-- Migration: fix_pro_subscriptions
-- Created: 2026-01-19
-- Description: Fixes subscriptions that were incorrectly assigned 'starter' tier
--              when they should have been 'pro' based on their Stripe price_id.
-- 
-- ROOT CAUSE: The webhook handler was using a fallback that defaulted to 'starter'
--             when the STRIPE_PRICE_PRO environment variable wasn't configured,
--             causing all Pro subscriptions to be stored as Starter.
-- ============================================================================

-- STEP 1: Create audit table to track what we're fixing
-- This allows us to rollback if needed
CREATE TABLE IF NOT EXISTS public.subscription_fix_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_subscription_id TEXT,
  price_id TEXT,
  old_plan_tier TEXT,
  new_plan_tier TEXT,
  old_leads_limit INTEGER,
  new_leads_limit INTEGER,
  old_email_domains_limit INTEGER,
  new_email_domains_limit INTEGER,
  fixed_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 2: Identify and log affected subscriptions BEFORE fixing
-- This query shows what WILL be fixed - run this first to review
-- Uncomment the SELECT to preview:

/*
SELECT 
  s.user_id,
  u.email,
  s.stripe_subscription_id,
  s.price_id,
  s.plan_tier as current_tier,
  'pro' as should_be_tier,
  s.leads_per_week_limit,
  s.email_domains_limit,
  s.subscription_status,
  s.created_at
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE 
  -- Match Pro price ID pattern (adjust this to match your actual price IDs)
  -- Common patterns: 'price_1...' with 'pro' in metadata, or specific IDs
  s.price_id IS NOT NULL
  AND s.plan_tier = 'starter'
  AND s.subscription_status IN ('active', 'trialing', 'past_due')
  -- Exclude known Starter price IDs (add your actual Starter price ID)
  AND s.price_id != 'price_YOUR_STARTER_ID_HERE'
ORDER BY s.created_at DESC;
*/

-- ============================================================================
-- STEP 3: THE FIX
-- ============================================================================
-- IMPORTANT: Before running this, you MUST:
-- 1. Set the actual Pro price ID in the WHERE clause below
-- 2. Set the actual Starter price ID in the exclusion
-- 3. Verify the price IDs match your Stripe dashboard

-- Replace 'price_YOUR_PRO_PRICE_ID' with your actual Stripe Pro price ID
-- You can find this in Stripe Dashboard > Products > Your Pro Product > Price ID

DO $$
DECLARE
  pro_price_id TEXT;
  starter_price_id TEXT;
  affected_count INTEGER;
BEGIN
  -- =========================================================================
  -- CONFIGURED PRICE IDs
  -- =========================================================================
  pro_price_id := 'price_1SpppRQ2RacoVjt5gQtwXhME';
  starter_price_id := 'price_1SppoZQ2RacoVjt5fVEt6xZm';
  
  -- Count affected subscriptions
  SELECT COUNT(*) INTO affected_count
  FROM subscriptions
  WHERE price_id = pro_price_id
    AND plan_tier = 'starter'
    AND subscription_status IN ('active', 'trialing', 'past_due');
  
  RAISE NOTICE 'Found % subscriptions to fix', affected_count;
  
  IF affected_count = 0 THEN
    RAISE NOTICE 'No subscriptions need fixing. Exiting.';
    RETURN;
  END IF;
  
  -- Log what we're about to fix
  INSERT INTO subscription_fix_audit (
    user_id, stripe_subscription_id, price_id,
    old_plan_tier, new_plan_tier,
    old_leads_limit, new_leads_limit,
    old_email_domains_limit, new_email_domains_limit
  )
  SELECT 
    user_id, stripe_subscription_id, price_id,
    plan_tier, 'pro',
    leads_per_week_limit, -1,
    email_domains_limit, -1
  FROM subscriptions
  WHERE price_id = pro_price_id
    AND plan_tier = 'starter'
    AND subscription_status IN ('active', 'trialing', 'past_due');
  
  -- Apply the fix
  UPDATE subscriptions
  SET 
    plan_tier = 'pro',
    leads_per_week_limit = -1,  -- Unlimited
    email_domains_limit = -1,   -- Unlimited
    updated_at = NOW()
  WHERE price_id = pro_price_id
    AND plan_tier = 'starter'
    AND subscription_status IN ('active', 'trialing', 'past_due');
  
  RAISE NOTICE 'Successfully fixed % Pro subscriptions', affected_count;
END $$;

-- ============================================================================
-- STEP 4: Verification Query
-- ============================================================================
-- Run this after the fix to verify all Pro price IDs have 'pro' tier:

/*
SELECT 
  s.plan_tier,
  s.price_id,
  COUNT(*) as count,
  SUM(CASE WHEN s.leads_per_week_limit = -1 THEN 1 ELSE 0 END) as unlimited_leads
FROM subscriptions s
WHERE s.subscription_status IN ('active', 'trialing', 'past_due')
GROUP BY s.plan_tier, s.price_id
ORDER BY s.plan_tier, s.price_id;
*/

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- If something went wrong, you can rollback using the audit table:

/*
UPDATE subscriptions s
SET 
  plan_tier = a.old_plan_tier,
  leads_per_week_limit = a.old_leads_limit,
  email_domains_limit = a.old_email_domains_limit,
  updated_at = NOW()
FROM subscription_fix_audit a
WHERE s.user_id = a.user_id
  AND s.stripe_subscription_id = a.stripe_subscription_id
  AND a.fixed_at = (SELECT MAX(fixed_at) FROM subscription_fix_audit);
*/
