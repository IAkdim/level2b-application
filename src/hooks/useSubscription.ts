// useSubscription hook - Manages subscription state and Stripe interactions

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/contexts/OrganizationContext'
import type { Subscription, BillingHistory } from '@/types/subscription'

interface UseSubscriptionReturn {
  subscription: Subscription | null
  billingHistory: BillingHistory[]
  loading: boolean
  error: string | null
  hasAccess: boolean
  isGracePeriod: boolean
  refresh: () => Promise<void>
  createCheckoutSession: (priceId: string) => Promise<string | null>
  openCustomerPortal: () => Promise<string | null>
}

export function useSubscription(): UseSubscriptionReturn {
  const { selectedOrg } = useOrganization()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!selectedOrg?.id) {
      setSubscription(null)
      setBillingHistory([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('org_id', selectedOrg.id)
        .single()

      if (subError && subError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (which is fine for new orgs)
        throw subError
      }

      setSubscription(subData || null)

      // Fetch billing history
      const { data: historyData, error: historyError } = await supabase
        .from('billing_history')
        .select('*')
        .eq('org_id', selectedOrg.id)
        .order('created_at', { ascending: false })
        .limit(12)

      if (historyError) {
        console.error('Error fetching billing history:', historyError)
      }

      setBillingHistory(historyData || [])

    } catch (err: any) {
      console.error('Error fetching subscription:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedOrg?.id])

  // Initial fetch
  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!selectedOrg?.id) return

    const channel = supabase
      .channel(`subscription-${selectedOrg.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `org_id=eq.${selectedOrg.id}`,
        },
        (payload) => {
          console.log('Subscription updated:', payload)
          if (payload.eventType === 'DELETE') {
            setSubscription(null)
          } else {
            setSubscription(payload.new as Subscription)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedOrg?.id])

  // Calculate access
  const hasAccess = calculateHasAccess(subscription)
  const isGracePeriod = subscription?.subscription_status === 'past_due' && hasAccess

  // Create checkout session
  const createCheckoutSession = useCallback(async (priceId: string): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create checkout session')
      }

      return response.data.url
    } catch (err: any) {
      console.error('Error creating checkout session:', err)
      setError(err.message)
      return null
    }
  }, [])

  // Open customer portal
  const openCustomerPortal = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await supabase.functions.invoke('create-portal-session', {
        body: {},
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create portal session')
      }

      return response.data.url
    } catch (err: any) {
      console.error('Error creating portal session:', err)
      setError(err.message)
      return null
    }
  }, [])

  return {
    subscription,
    billingHistory,
    loading,
    error,
    hasAccess,
    isGracePeriod,
    refresh: fetchSubscription,
    createCheckoutSession,
    openCustomerPortal,
  }
}

// Helper function to calculate access
function calculateHasAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false

  // Enterprise users always have access
  if (subscription.is_enterprise) return true

  // Active or trialing
  if (['active', 'trialing'].includes(subscription.subscription_status)) {
    return true
  }

  // Past due with grace period (7 days)
  if (subscription.subscription_status === 'past_due') {
    const updatedAt = new Date(subscription.updated_at)
    const gracePeriodEnd = new Date(updatedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    return new Date() < gracePeriodEnd
  }

  return false
}
