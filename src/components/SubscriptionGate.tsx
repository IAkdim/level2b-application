// SubscriptionGate - Protects routes/features based on subscription status

import { Navigate, useLocation } from 'react-router-dom'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useSubscriptionContext } from '@/contexts/SubscriptionContext'
import type { PlanTier } from '@/types/subscription'

interface SubscriptionGateProps {
  children: React.ReactNode
  /** If true, redirects to paywall instead of showing alert */
  redirectToPaywall?: boolean
  /** Required plan tier (or higher) */
  requiredTier?: PlanTier
  /** Custom fallback when access is denied */
  fallback?: React.ReactNode
}

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<PlanTier, number> = {
  none: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
}

/**
 * SubscriptionGate - Wraps content that requires an active subscription
 * 
 * Usage:
 * ```tsx
 * <SubscriptionGate>
 *   <ProtectedFeature />
 * </SubscriptionGate>
 * 
 * // Require Pro tier or higher:
 * <SubscriptionGate requiredTier="pro">
 *   <AdvancedFeature />
 * </SubscriptionGate>
 * ```
 */
export function SubscriptionGate({ 
  children, 
  redirectToPaywall = false,
  requiredTier,
  fallback,
}: SubscriptionGateProps) {
  const location = useLocation()
  const { loading, hasAccess, planTier, isGracePeriod } = useSubscriptionContext()

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Check basic subscription access
  if (!hasAccess) {
    if (redirectToPaywall) {
      return <Navigate to="/subscribe" state={{ from: location }} replace />
    }
    
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Subscription Required</AlertTitle>
        <AlertDescription>
          You need an active subscription to access this feature.{' '}
          <a href="/subscribe" className="font-medium underline">
            Choose a plan
          </a>
        </AlertDescription>
      </Alert>
    )
  }

  // Check tier requirement
  if (requiredTier) {
    const currentTierLevel = TIER_HIERARCHY[planTier]
    const requiredTierLevel = TIER_HIERARCHY[requiredTier]

    if (currentTierLevel < requiredTierLevel) {
      if (fallback) {
        return <>{fallback}</>
      }

      return (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Upgrade Required</AlertTitle>
          <AlertDescription>
            This feature requires the {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} plan or higher.{' '}
            <a href="/settings/billing" className="font-medium underline">
              Upgrade now
            </a>
          </AlertDescription>
        </Alert>
      )
    }
  }

  // Show grace period warning but still allow access
  if (isGracePeriod) {
    return (
      <>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Issue</AlertTitle>
          <AlertDescription>
            Your last payment failed. Please update your payment method to avoid service interruption.
          </AlertDescription>
        </Alert>
        {children}
      </>
    )
  }

  return <>{children}</>
}

/**
 * withSubscription HOC - Alternative to SubscriptionGate component
 * 
 * Usage:
 * ```tsx
 * export default withSubscription(MyComponent, { requiredTier: 'pro' })
 * ```
 */
export function withSubscription<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<SubscriptionGateProps, 'children'> = {}
) {
  return function WithSubscriptionWrapper(props: P) {
    return (
      <SubscriptionGate {...options}>
        <Component {...props} />
      </SubscriptionGate>
    )
  }
}
