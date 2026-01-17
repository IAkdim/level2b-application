// PaymentRequiredBanner - Shows when user has no active subscription

import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useSubscriptionContext } from '@/contexts/SubscriptionContext'

interface PaymentRequiredBannerProps {
  className?: string
}

/**
 * PaymentRequiredBanner - Displays contextual subscription warnings
 * 
 * Shows different messages for:
 * - No subscription
 * - Past due (payment failed)
 * - Cancellation scheduled
 */
export function PaymentRequiredBanner({ className }: PaymentRequiredBannerProps) {
  const { subscription, hasAccess, isGracePeriod, openCustomerPortal } = useSubscriptionContext()

  // No subscription at all
  if (!subscription || !hasAccess) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Subscription Required</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>You need an active subscription to use Level2B.</span>
          <Button variant="outline" size="sm" asChild>
            <a href="/subscribe">
              Choose a Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Payment failed - in grace period
  if (isGracePeriod) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Payment Failed</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>Your last payment failed. Please update your payment method within 7 days.</span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              const url = await openCustomerPortal()
              if (url) window.location.href = url
            }}
          >
            Update Payment
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Cancellation scheduled
  if (subscription.cancel_at_period_end) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Subscription Ending</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Your subscription ends on{' '}
            {subscription.current_period_end 
              ? new Date(subscription.current_period_end).toLocaleDateString()
              : 'soon'
            }.
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              const url = await openCustomerPortal()
              if (url) window.location.href = url
            }}
          >
            Reactivate
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Everything is fine
  return null
}
