// Subscription Success Page - Shown after successful checkout

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSubscriptionContext } from '@/contexts/SubscriptionContext'

export function SubscribeSuccess() {
  const navigate = useNavigate()
  const { subscription, refresh } = useSubscriptionContext()
  const [pollingCount, setPollingCount] = useState(0)

  // Poll for subscription update (webhook might take a moment)
  useEffect(() => {
    if (subscription?.subscription_status === 'active') {
      return // Already have active subscription
    }

    if (pollingCount >= 10) {
      return // Stop polling after 10 attempts
    }

    const timer = setTimeout(() => {
      refresh()
      setPollingCount(prev => prev + 1)
    }, 2000)

    return () => clearTimeout(timer)
  }, [subscription, pollingCount, refresh])

  const isConfirmed = subscription?.subscription_status === 'active'

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {isConfirmed ? (
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          ) : (
            <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
          )}
          <CardTitle className="text-2xl">
            {isConfirmed ? 'Welcome to Level2B!' : 'Confirming your subscription...'}
          </CardTitle>
          <CardDescription>
            {isConfirmed 
              ? 'Your subscription is now active. You have full access to all features.'
              : 'Please wait while we confirm your payment. This usually takes just a few seconds.'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isConfirmed && subscription && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium capitalize">{subscription.plan_tier}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
              {subscription.current_period_end && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Next billing date</span>
                  <span className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate('/')}
            disabled={!isConfirmed}
          >
            {isConfirmed ? 'Go to Dashboard' : 'Please wait...'}
          </Button>

          {!isConfirmed && pollingCount >= 10 && (
            <p className="text-sm text-center text-muted-foreground">
              Taking longer than expected? Try{' '}
              <button 
                onClick={() => refresh()} 
                className="text-primary hover:underline"
              >
                refreshing
              </button>{' '}
              or contact support.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SubscribeSuccess
