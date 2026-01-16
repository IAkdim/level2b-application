// useOnboarding hook - Manages onboarding, demo, and walkthrough state
// Connects to Supabase tables and provides deterministic flow state

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import type {
  OnboardingState,
  OnboardingFormAnswers,
  DemoUsage,
  WalkthroughStepId,
  UserFlowState,
} from '@/types/onboarding'
import {
  DEFAULT_ONBOARDING_STATE,
  DEFAULT_FORM_ANSWERS,
  calculateFlowState,
} from '@/types/onboarding'

export interface UseOnboardingReturn {
  // State
  state: OnboardingState
  loading: boolean
  error: string | null
  
  // Computed
  flowState: UserFlowState
  isDemo: boolean
  canAccessApp: boolean
  
  // Demo actions
  checkDemoLimit: (actionType: 'lead' | 'email') => Promise<{ allowed: boolean; message: string }>
  incrementDemoUsage: (actionType: 'lead' | 'email') => Promise<boolean>
  refreshDemoUsage: () => Promise<void>
  
  // Onboarding actions
  updateOnboardingStep: (step: number, answers: Partial<OnboardingFormAnswers>) => Promise<boolean>
  completeOnboarding: () => Promise<boolean>
  skipOnboarding: () => Promise<boolean>
  
  // Walkthrough actions
  advanceWalkthrough: (stepId: WalkthroughStepId) => Promise<boolean>
  completeWalkthrough: () => Promise<boolean>
  dismissWalkthrough: () => Promise<boolean>
  
  // Refresh
  refresh: () => Promise<void>
}

export function useOnboarding(): UseOnboardingReturn {
  const [user, setUser] = useState<User | null>(null)
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch complete onboarding state from Supabase
  const fetchOnboardingState = useCallback(async () => {
    if (!user?.id) {
      setState({
        ...DEFAULT_ONBOARDING_STATE,
        flowState: 'unauthenticated',
      })
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Call the comprehensive state function
      const { data, error: fetchError } = await supabase
        .rpc('get_user_onboarding_state', { p_user_id: user.id })

      if (fetchError) {
        console.error('Error fetching onboarding state:', fetchError)
        // Initialize user if function fails (likely no records exist)
        await supabase.rpc('initialize_user_onboarding', { p_user_id: user.id })
        // Retry fetch
        const { data: retryData, error: retryError } = await supabase
          .rpc('get_user_onboarding_state', { p_user_id: user.id })
        
        if (retryError) throw retryError
        if (retryData && retryData.length > 0) {
          const row = retryData[0]
          const newState = mapDatabaseToState(row, user.id)
          setState(newState)
        }
      } else if (data && data.length > 0) {
        const row = data[0]
        const newState = mapDatabaseToState(row, user.id)
        setState(newState)
      } else {
        // No data - initialize
        await supabase.rpc('initialize_user_onboarding', { p_user_id: user.id })
        setState({
          ...DEFAULT_ONBOARDING_STATE,
          userId: user.id,
          flowState: 'demo_active',
        })
      }
    } catch (err: any) {
      console.error('Error in fetchOnboardingState:', err)
      setError(err.message)
      // Fallback to default state
      setState({
        ...DEFAULT_ONBOARDING_STATE,
        userId: user.id,
        flowState: 'demo_active',
      })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Map database response to state
  function mapDatabaseToState(row: any, userId: string): OnboardingState {
    const demoUsage: DemoUsage = {
      leads_used: row.leads_used ?? 0,
      leads_limit: row.leads_limit ?? 5,
      leads_remaining: Math.max(0, (row.leads_limit ?? 5) - (row.leads_used ?? 0)),
      emails_used: row.emails_used ?? 0,
      emails_limit: row.emails_limit ?? 1,
      emails_remaining: Math.max(0, (row.emails_limit ?? 1) - (row.emails_used ?? 0)),
      all_exhausted: row.all_limits_exhausted ?? false,
    }

    const formAnswers: OnboardingFormAnswers = {
      ...DEFAULT_FORM_ANSWERS,
      ...(row.form_answers || {}),
    }

    const baseState = {
      userId,
      isNewUser: row.is_new_user ?? true,
      onboardingCompleted: row.onboarding_completed ?? false,
      onboardingSkipped: row.onboarding_skipped ?? false,
      currentOnboardingStep: row.current_onboarding_step ?? 1,
      formAnswers,
      demoModeActive: row.demo_mode_active ?? true,
      demoUsage,
      walkthroughActive: row.walkthrough_active ?? true,
      walkthroughCompleted: row.walkthrough_completed ?? false,
      currentWalkthroughStep: (row.current_walkthrough_step || 'welcome') as WalkthroughStepId,
      stepsCompleted: (row.steps_completed || []) as WalkthroughStepId[],
      hasSubscription: row.has_subscription ?? false,
      subscriptionStatus: row.subscription_status ?? null,
    }

    return {
      ...baseState,
      flowState: calculateFlowState(baseState),
    }
  }

  // Fetch state when user changes
  useEffect(() => {
    fetchOnboardingState()
  }, [fetchOnboardingState])

  // Check demo limit before action
  const checkDemoLimit = useCallback(async (actionType: 'lead' | 'email'): Promise<{ allowed: boolean; message: string }> => {
    if (!user?.id) {
      return { allowed: false, message: 'Not authenticated' }
    }

    // If user has subscription, always allow
    if (state.hasSubscription) {
      return { allowed: true, message: 'Full access' }
    }

    try {
      const { data, error } = await supabase
        .rpc('check_demo_limit', { p_user_id: user.id, p_action_type: actionType })

      if (error) throw error

      if (data && data.length > 0) {
        return {
          allowed: data[0].allowed,
          message: data[0].message,
        }
      }

      return { allowed: false, message: 'Unable to check limits' }
    } catch (err: any) {
      console.error('Error checking demo limit:', err)
      return { allowed: false, message: err.message }
    }
  }, [user?.id, state.hasSubscription])

  // Increment demo usage after action
  const incrementDemoUsage = useCallback(async (actionType: 'lead' | 'email'): Promise<boolean> => {
    if (!user?.id) return false
    if (state.hasSubscription) return true // No tracking needed

    try {
      const { error } = await supabase
        .rpc('increment_demo_usage', { p_user_id: user.id, p_action_type: actionType })

      if (error) throw error

      // Refresh state to get updated usage
      await fetchOnboardingState()
      return true
    } catch (err: any) {
      console.error('Error incrementing demo usage:', err)
      return false
    }
  }, [user?.id, state.hasSubscription, fetchOnboardingState])

  // Refresh demo usage
  const refreshDemoUsage = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .rpc('get_demo_usage', { p_user_id: user.id })

      if (error) throw error

      if (data && data.length > 0) {
        const row = data[0]
        setState(prev => ({
          ...prev,
          demoUsage: {
            leads_used: row.leads_used,
            leads_limit: row.leads_limit,
            leads_remaining: row.leads_remaining,
            emails_used: row.emails_used,
            emails_limit: row.emails_limit,
            emails_remaining: row.emails_remaining,
            all_exhausted: row.all_exhausted,
          },
        }))
      }
    } catch (err: any) {
      console.error('Error refreshing demo usage:', err)
    }
  }, [user?.id])

  // Update onboarding step and answers
  const updateOnboardingStep = useCallback(async (
    step: number,
    answers: Partial<OnboardingFormAnswers>
  ): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { error } = await supabase
        .rpc('update_onboarding_answers', {
          p_user_id: user.id,
          p_step: step,
          p_answers: answers,
        })

      if (error) throw error

      // Update local state
      setState(prev => ({
        ...prev,
        currentOnboardingStep: step,
        formAnswers: { ...prev.formAnswers, ...answers },
      }))

      return true
    } catch (err: any) {
      console.error('Error updating onboarding:', err)
      return false
    }
  }, [user?.id])

  // Complete onboarding
  const completeOnboarding = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { error } = await supabase
        .rpc('complete_onboarding', { p_user_id: user.id })

      if (error) throw error

      setState(prev => ({
        ...prev,
        onboardingCompleted: true,
        flowState: 'subscribing',
      }))

      return true
    } catch (err: any) {
      console.error('Error completing onboarding:', err)
      return false
    }
  }, [user?.id])

  // Skip onboarding
  const skipOnboarding = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { error } = await supabase
        .rpc('skip_onboarding', { p_user_id: user.id })

      if (error) throw error

      setState(prev => ({
        ...prev,
        onboardingSkipped: true,
        flowState: 'subscribing',
      }))

      return true
    } catch (err: any) {
      console.error('Error skipping onboarding:', err)
      return false
    }
  }, [user?.id])

  // Advance walkthrough
  const advanceWalkthrough = useCallback(async (stepId: WalkthroughStepId): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { error } = await supabase
        .rpc('update_walkthrough_step', { p_user_id: user.id, p_step_id: stepId })

      if (error) throw error

      setState(prev => ({
        ...prev,
        currentWalkthroughStep: stepId,
        stepsCompleted: prev.stepsCompleted.includes(stepId) 
          ? prev.stepsCompleted 
          : [...prev.stepsCompleted, stepId],
      }))

      return true
    } catch (err: any) {
      console.error('Error advancing walkthrough:', err)
      return false
    }
  }, [user?.id])

  // Complete walkthrough
  const completeWalkthrough = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { error } = await supabase
        .rpc('complete_walkthrough', { p_user_id: user.id })

      if (error) throw error

      setState(prev => ({
        ...prev,
        walkthroughActive: false,
        walkthroughCompleted: true,
      }))

      return true
    } catch (err: any) {
      console.error('Error completing walkthrough:', err)
      return false
    }
  }, [user?.id])

  // Dismiss walkthrough
  const dismissWalkthrough = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const { error } = await supabase
        .rpc('dismiss_walkthrough', { p_user_id: user.id })

      if (error) throw error

      setState(prev => ({
        ...prev,
        walkthroughActive: false,
      }))

      return true
    } catch (err: any) {
      console.error('Error dismissing walkthrough:', err)
      return false
    }
  }, [user?.id])

  // Computed values
  const flowState = state.flowState
  const isDemo = state.demoModeActive && !state.hasSubscription
  const canAccessApp = state.hasSubscription || state.demoModeActive

  return {
    state,
    loading,
    error,
    flowState,
    isDemo,
    canAccessApp,
    checkDemoLimit,
    incrementDemoUsage,
    refreshDemoUsage,
    updateOnboardingStep,
    completeOnboarding,
    skipOnboarding,
    advanceWalkthrough,
    completeWalkthrough,
    dismissWalkthrough,
    refresh: fetchOnboardingState,
  }
}
