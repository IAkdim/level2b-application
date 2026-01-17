// DemoGate - Allows access for demo mode OR subscription
// Unlike SubscriptionGate which only checks subscription,
// DemoGate allows both demo users and subscribed users through

import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOnboardingContext } from '@/contexts/OnboardingContext'
import { useSubscriptionContext } from '@/contexts/SubscriptionContext'

interface DemoGateProps {
  children: React.ReactNode
}

/**
 * DemoGate - Wraps content that requires either demo access OR subscription
 * 
 * Flow logic:
 * 1. If user has subscription → Allow access
 * 2. If user is in demo mode and limits not exhausted → Allow access
 * 3. If demo limits exhausted → Redirect to paywall
 * 4. If no access at all → Redirect to subscribe
 */
export function DemoGate({ children }: DemoGateProps) {
  const location = useLocation()
  const { loading: onboardingLoading, state } = useOnboardingContext()
  const { loading: subscriptionLoading, hasAccess } = useSubscriptionContext()

  const isLoading = onboardingLoading || subscriptionLoading

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Subscribed users always get access
  if (hasAccess) {
    return <>{children}</>
  }

  // Demo mode users get access if limits not exhausted
  if (state.demoModeActive && !state.demoUsage.all_exhausted) {
    return <>{children}</>
  }

  // Demo limits exhausted - redirect to paywall
  if (state.demoUsage.all_exhausted) {
    return <Navigate to="/paywall" state={{ from: location }} replace />
  }

  // No access - redirect to subscribe
  return <Navigate to="/subscribe" state={{ from: location }} replace />
}

export default DemoGate
