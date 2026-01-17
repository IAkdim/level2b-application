// SubscriptionContext - Provides subscription state throughout the app

import { createContext, useContext, ReactNode } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import type { Subscription, BillingHistory, PlanTier } from '@/types/subscription'

interface SubscriptionContextType {
  subscription: Subscription | null
  billingHistory: BillingHistory[]
  loading: boolean
  error: string | null
  hasAccess: boolean
  isGracePeriod: boolean
  planTier: PlanTier
  refresh: () => Promise<void>
  createCheckoutSession: (priceId: string) => Promise<string | null>
  openCustomerPortal: () => Promise<string | null>
  // Feature checks
  canGenerateLeads: (count: number) => boolean
  canAddEmailDomain: (currentCount: number) => boolean
  hasPrioritySupport: boolean
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

interface SubscriptionProviderProps {
  children: ReactNode
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const {
    subscription,
    billingHistory,
    loading,
    error,
    hasAccess,
    isGracePeriod,
    refresh,
    createCheckoutSession,
    openCustomerPortal,
  } = useSubscription()

  const planTier: PlanTier = subscription?.plan_tier || 'none'

  // Feature check: Can generate leads
  const canGenerateLeads = (count: number): boolean => {
    if (!hasAccess) return false
    if (!subscription) return false
    
    // Enterprise and Pro have unlimited
    if (subscription.is_enterprise || subscription.plan_tier === 'pro') {
      return true
    }

    // Starter has limit
    if (subscription.leads_per_week_limit === -1) return true
    return count <= subscription.leads_per_week_limit
  }

  // Feature check: Can add email domain
  const canAddEmailDomain = (currentCount: number): boolean => {
    if (!hasAccess) return false
    if (!subscription) return false

    // Enterprise and Pro have unlimited
    if (subscription.is_enterprise || subscription.plan_tier === 'pro') {
      return true
    }

    // Starter has limit
    if (subscription.email_domains_limit === -1) return true
    return currentCount < subscription.email_domains_limit
  }

  // Feature check: Priority support
  const hasPrioritySupport = 
    hasAccess && 
    (subscription?.plan_tier === 'pro' || subscription?.plan_tier === 'enterprise')

  const value: SubscriptionContextType = {
    subscription,
    billingHistory,
    loading,
    error,
    hasAccess,
    isGracePeriod,
    planTier,
    refresh,
    createCheckoutSession,
    openCustomerPortal,
    canGenerateLeads,
    canAddEmailDomain,
    hasPrioritySupport,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscriptionContext(): SubscriptionContextType {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider')
  }
  return context
}
