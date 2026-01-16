-- ============================================================================
-- ONBOARDING & DEMO SYSTEM
-- ============================================================================
-- Migration: onboarding_demo_system
-- Created: 2026-01-16
-- Description: Complete onboarding flow with demo limits, walkthrough tracking,
--              and multi-step onboarding form storage
-- ============================================================================

-- ============================================================================
-- USER ONBOARDING TABLE
-- ============================================================================
-- Tracks overall onboarding progress and completion state

CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Onboarding state
  is_new_user BOOLEAN DEFAULT TRUE,
  onboarding_started_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_skipped BOOLEAN DEFAULT FALSE,
  
  -- Current step (for resumability)
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 5,
  
  -- Onboarding form answers (JSONB for flexibility)
  form_answers JSONB DEFAULT '{}'::jsonb,
  -- Expected structure:
  -- {
  --   "desired_outcome": string,      -- What they want to achieve
  --   "business_type": string,        -- Type of business
  --   "target_audience": string,      -- Who they're targeting
  --   "current_outreach": string,     -- Current outreach situation
  --   "success_definition": string,   -- What success looks like
  --   "company_size": string,         -- Company size range
  --   "industry": string              -- Industry vertical
  -- }
  
  -- Demo mode tracking
  demo_mode_active BOOLEAN DEFAULT TRUE,
  demo_started_at TIMESTAMPTZ DEFAULT NOW(),
  demo_expired_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_onboarding UNIQUE (user_id)
);

-- ============================================================================
-- DEMO USAGE TABLE  
-- ============================================================================
-- Tracks actual demo usage against limits (enforced server-side)

CREATE TABLE IF NOT EXISTS public.demo_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Demo limits (configurable)
  leads_limit INTEGER DEFAULT 5,
  emails_limit INTEGER DEFAULT 1,
  
  -- Current usage
  leads_used INTEGER DEFAULT 0,
  emails_used INTEGER DEFAULT 0,
  
  -- Limit hit tracking
  leads_limit_hit_at TIMESTAMPTZ,
  emails_limit_hit_at TIMESTAMPTZ,
  all_limits_exhausted BOOLEAN GENERATED ALWAYS AS (
    (leads_used >= leads_limit) AND (emails_used >= emails_limit)
  ) STORED,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_demo_usage UNIQUE (user_id)
);

-- ============================================================================
-- WALKTHROUGH PROGRESS TABLE
-- ============================================================================
-- Tracks guided walkthrough progress during demo mode

CREATE TABLE IF NOT EXISTS public.walkthrough_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Walkthrough state
  walkthrough_active BOOLEAN DEFAULT TRUE,
  walkthrough_started_at TIMESTAMPTZ DEFAULT NOW(),
  walkthrough_completed_at TIMESTAMPTZ,
  walkthrough_dismissed BOOLEAN DEFAULT FALSE,
  
  -- Current step tracking
  current_step_id TEXT DEFAULT 'welcome',
  steps_completed TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Steps: welcome, navigate_leads, generate_lead, view_lead, navigate_templates, send_email, complete
  
  -- Interaction tracking (for analytics)
  total_interactions INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_walkthrough UNIQUE (user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON public.user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_demo_active ON public.user_onboarding(demo_mode_active) WHERE demo_mode_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_demo_usage_user_id ON public.demo_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_usage_limits ON public.demo_usage(all_limits_exhausted);
CREATE INDEX IF NOT EXISTS idx_walkthrough_progress_user_id ON public.walkthrough_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_walkthrough_progress_active ON public.walkthrough_progress(walkthrough_active) WHERE walkthrough_active = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walkthrough_progress ENABLE ROW LEVEL SECURITY;

-- User Onboarding policies
CREATE POLICY "Users can view their own onboarding"
  ON public.user_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding"
  ON public.user_onboarding FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding"
  ON public.user_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Demo Usage policies
CREATE POLICY "Users can view their own demo usage"
  ON public.demo_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own demo usage"
  ON public.demo_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own demo usage"
  ON public.demo_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Walkthrough Progress policies
CREATE POLICY "Users can view their own walkthrough progress"
  ON public.walkthrough_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own walkthrough progress"
  ON public.walkthrough_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own walkthrough progress"
  ON public.walkthrough_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS FOR DEMO LIMIT ENFORCEMENT
-- ============================================================================

-- Check if user is in demo mode
CREATE OR REPLACE FUNCTION public.is_in_demo_mode(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_demo_active BOOLEAN;
  v_has_subscription BOOLEAN;
BEGIN
  -- Check if user has active subscription
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
    AND subscription_status IN ('active', 'trialing')
  ) INTO v_has_subscription;
  
  -- If has subscription, not in demo mode
  IF v_has_subscription THEN
    RETURN FALSE;
  END IF;
  
  -- Check onboarding table for demo mode
  SELECT demo_mode_active INTO v_demo_active
  FROM public.user_onboarding
  WHERE user_id = p_user_id;
  
  -- Default to TRUE for new users (create record if needed)
  IF v_demo_active IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN v_demo_active;
END;
$$;

-- Get remaining demo usage
CREATE OR REPLACE FUNCTION public.get_demo_usage(p_user_id UUID)
RETURNS TABLE (
  leads_used INTEGER,
  leads_limit INTEGER,
  leads_remaining INTEGER,
  emails_used INTEGER,
  emails_limit INTEGER,
  emails_remaining INTEGER,
  all_exhausted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    du.leads_used,
    du.leads_limit,
    GREATEST(0, du.leads_limit - du.leads_used) as leads_remaining,
    du.emails_used,
    du.emails_limit,
    GREATEST(0, du.emails_limit - du.emails_used) as emails_remaining,
    du.all_limits_exhausted as all_exhausted
  FROM public.demo_usage du
  WHERE du.user_id = p_user_id;
  
  -- If no record exists, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 5, 5, 0, 1, 1, FALSE;
  END IF;
END;
$$;

-- Check if demo action is allowed (used before leads/email operations)
CREATE OR REPLACE FUNCTION public.check_demo_limit(
  p_user_id UUID,
  p_action_type TEXT  -- 'lead' or 'email'
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  limit_value INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_subscription BOOLEAN;
  v_demo_record demo_usage%ROWTYPE;
BEGIN
  -- Check subscription first
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
    AND subscription_status IN ('active', 'trialing')
  ) INTO v_has_subscription;
  
  IF v_has_subscription THEN
    RETURN QUERY SELECT TRUE, -1, -1, 'Full access - subscribed'::TEXT;
    RETURN;
  END IF;
  
  -- Get demo usage
  SELECT * INTO v_demo_record
  FROM public.demo_usage
  WHERE user_id = p_user_id;
  
  -- If no record, create one
  IF v_demo_record IS NULL THEN
    INSERT INTO public.demo_usage (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_demo_record;
  END IF;
  
  -- Check based on action type
  IF p_action_type = 'lead' THEN
    IF v_demo_record.leads_used >= v_demo_record.leads_limit THEN
      RETURN QUERY SELECT 
        FALSE, 
        0, 
        v_demo_record.leads_limit, 
        'Demo limit reached: You''ve used all 5 demo leads. Upgrade to unlock unlimited lead generation.'::TEXT;
    ELSE
      RETURN QUERY SELECT 
        TRUE, 
        v_demo_record.leads_limit - v_demo_record.leads_used, 
        v_demo_record.leads_limit, 
        'OK'::TEXT;
    END IF;
  ELSIF p_action_type = 'email' THEN
    IF v_demo_record.emails_used >= v_demo_record.emails_limit THEN
      RETURN QUERY SELECT 
        FALSE, 
        0, 
        v_demo_record.emails_limit, 
        'Demo limit reached: You''ve sent your 1 demo email. Upgrade to send unlimited cold emails.'::TEXT;
    ELSE
      RETURN QUERY SELECT 
        TRUE, 
        v_demo_record.emails_limit - v_demo_record.emails_used, 
        v_demo_record.emails_limit, 
        'OK'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT FALSE, 0, 0, 'Invalid action type'::TEXT;
  END IF;
END;
$$;

-- Increment demo usage (called after successful action)
CREATE OR REPLACE FUNCTION public.increment_demo_usage(
  p_user_id UUID,
  p_action_type TEXT  -- 'lead' or 'email'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_subscription BOOLEAN;
BEGIN
  -- Check subscription first (no increment needed)
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
    AND subscription_status IN ('active', 'trialing')
  ) INTO v_has_subscription;
  
  IF v_has_subscription THEN
    RETURN TRUE;
  END IF;
  
  -- Ensure record exists
  INSERT INTO public.demo_usage (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Increment based on action type
  IF p_action_type = 'lead' THEN
    UPDATE public.demo_usage
    SET 
      leads_used = leads_used + 1,
      leads_limit_hit_at = CASE 
        WHEN leads_used + 1 >= leads_limit THEN NOW() 
        ELSE leads_limit_hit_at 
      END,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_action_type = 'email' THEN
    UPDATE public.demo_usage
    SET 
      emails_used = emails_used + 1,
      emails_limit_hit_at = CASE 
        WHEN emails_used + 1 >= emails_limit THEN NOW() 
        ELSE emails_limit_hit_at 
      END,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Initialize user onboarding (called on first login)
CREATE OR REPLACE FUNCTION public.initialize_user_onboarding(p_user_id UUID)
RETURNS TABLE (
  is_new BOOLEAN,
  onboarding_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  -- Check if already exists
  SELECT id INTO v_existing_id
  FROM public.user_onboarding
  WHERE user_id = p_user_id;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_existing_id;
    RETURN;
  END IF;
  
  -- Create new onboarding record
  INSERT INTO public.user_onboarding (user_id)
  VALUES (p_user_id)
  RETURNING id INTO v_new_id;
  
  -- Create demo usage record
  INSERT INTO public.demo_usage (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create walkthrough progress record
  INSERT INTO public.walkthrough_progress (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN QUERY SELECT TRUE, v_new_id;
END;
$$;

-- Get complete user onboarding state
CREATE OR REPLACE FUNCTION public.get_user_onboarding_state(p_user_id UUID)
RETURNS TABLE (
  -- Onboarding
  is_new_user BOOLEAN,
  onboarding_completed BOOLEAN,
  onboarding_skipped BOOLEAN,
  current_onboarding_step INTEGER,
  form_answers JSONB,
  -- Demo
  demo_mode_active BOOLEAN,
  leads_used INTEGER,
  leads_limit INTEGER,
  emails_used INTEGER,
  emails_limit INTEGER,
  all_limits_exhausted BOOLEAN,
  -- Walkthrough
  walkthrough_active BOOLEAN,
  walkthrough_completed BOOLEAN,
  current_walkthrough_step TEXT,
  steps_completed TEXT[],
  -- Subscription
  has_subscription BOOLEAN,
  subscription_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(uo.is_new_user, TRUE),
    (uo.onboarding_completed_at IS NOT NULL),
    COALESCE(uo.onboarding_skipped, FALSE),
    COALESCE(uo.current_step, 1),
    COALESCE(uo.form_answers, '{}'::jsonb),
    -- Demo
    COALESCE(uo.demo_mode_active, TRUE),
    COALESCE(du.leads_used, 0),
    COALESCE(du.leads_limit, 5),
    COALESCE(du.emails_used, 0),
    COALESCE(du.emails_limit, 1),
    COALESCE(du.all_limits_exhausted, FALSE),
    -- Walkthrough  
    COALESCE(wp.walkthrough_active, TRUE),
    (wp.walkthrough_completed_at IS NOT NULL),
    COALESCE(wp.current_step_id, 'welcome'),
    COALESCE(wp.steps_completed, ARRAY[]::TEXT[]),
    -- Subscription
    (s.id IS NOT NULL AND s.subscription_status IN ('active', 'trialing')),
    s.subscription_status
  FROM (SELECT p_user_id as uid) params
  LEFT JOIN public.user_onboarding uo ON uo.user_id = params.uid
  LEFT JOIN public.demo_usage du ON du.user_id = params.uid
  LEFT JOIN public.walkthrough_progress wp ON wp.user_id = params.uid
  LEFT JOIN public.subscriptions s ON s.user_id = params.uid;
END;
$$;

-- Update onboarding form answers
CREATE OR REPLACE FUNCTION public.update_onboarding_answers(
  p_user_id UUID,
  p_step INTEGER,
  p_answers JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure record exists
  INSERT INTO public.user_onboarding (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Update answers (merge with existing)
  UPDATE public.user_onboarding
  SET 
    current_step = p_step,
    form_answers = form_answers || p_answers,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Complete onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_onboarding
  SET 
    onboarding_completed_at = NOW(),
    current_step = total_steps,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Skip onboarding
CREATE OR REPLACE FUNCTION public.skip_onboarding(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_onboarding
  SET 
    onboarding_skipped = TRUE,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Update walkthrough progress
CREATE OR REPLACE FUNCTION public.update_walkthrough_step(
  p_user_id UUID,
  p_step_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure record exists
  INSERT INTO public.walkthrough_progress (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  UPDATE public.walkthrough_progress
  SET 
    current_step_id = p_step_id,
    steps_completed = CASE 
      WHEN NOT (p_step_id = ANY(steps_completed)) 
      THEN array_append(steps_completed, p_step_id)
      ELSE steps_completed
    END,
    total_interactions = total_interactions + 1,
    last_interaction_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Complete walkthrough
CREATE OR REPLACE FUNCTION public.complete_walkthrough(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.walkthrough_progress
  SET 
    walkthrough_active = FALSE,
    walkthrough_completed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Dismiss walkthrough
CREATE OR REPLACE FUNCTION public.dismiss_walkthrough(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.walkthrough_progress
  SET 
    walkthrough_active = FALSE,
    walkthrough_dismissed = TRUE,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Deactivate demo mode (called after subscription activation)
CREATE OR REPLACE FUNCTION public.deactivate_demo_mode(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate demo mode
  UPDATE public.user_onboarding
  SET 
    demo_mode_active = FALSE,
    demo_expired_at = NOW(),
    is_new_user = FALSE,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Deactivate walkthrough
  UPDATE public.walkthrough_progress
  SET 
    walkthrough_active = FALSE,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Trigger to auto-deactivate demo mode when subscription becomes active
CREATE OR REPLACE FUNCTION public.handle_subscription_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When subscription becomes active, deactivate demo mode
  IF NEW.subscription_status IN ('active', 'trialing') THEN
    PERFORM public.deactivate_demo_mode(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on subscriptions table
DROP TRIGGER IF EXISTS on_subscription_activated ON public.subscriptions;
CREATE TRIGGER on_subscription_activated
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_activation();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.user_onboarding TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.demo_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.walkthrough_progress TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_in_demo_mode TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_demo_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_demo_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_demo_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_onboarding TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_onboarding_state TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_onboarding_answers TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_onboarding TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_walkthrough_step TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_walkthrough TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_walkthrough TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_demo_mode TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.user_onboarding IS 'Tracks user onboarding state and multi-step form answers';
COMMENT ON TABLE public.demo_usage IS 'Tracks demo usage limits (5 leads, 1 email) for server-side enforcement';
COMMENT ON TABLE public.walkthrough_progress IS 'Tracks guided walkthrough progress during demo mode';

COMMENT ON FUNCTION public.is_in_demo_mode IS 'Check if user is currently in demo mode (no active subscription)';
COMMENT ON FUNCTION public.check_demo_limit IS 'Check if a demo action is allowed before performing it';
COMMENT ON FUNCTION public.increment_demo_usage IS 'Increment demo usage after successful action';
COMMENT ON FUNCTION public.get_user_onboarding_state IS 'Get complete user state for frontend routing decisions';
