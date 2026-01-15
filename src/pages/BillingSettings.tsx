// Billing Settings Page - Manage subscription and view billing history

import { useState } from 'react'
import { ExternalLink, Loader2, AlertTriangle, CreditCard, Receipt, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useSubscriptionContext } from '@/contexts/SubscriptionContext'
import { getPlanConfig, formatPrice, formatPeriodEnd } from '@/types/subscription'

export function BillingSettings() {
  const { 
    subscription, 
    billingHistory, 
    loading, 
    error,
    isGracePeriod,
    openCustomerPortal 
  } = useSubscriptionContext()
  const [portalLoading, setPortalLoading] = useState(false)

  const planConfig = subscription ? getPlanConfig(subscription.plan_tier) : null

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const portalUrl = await openCustomerPortal()
      if (portalUrl) {
        window.location.href = portalUrl
      }
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing information.
        </p>
      </div>

      {/* Grace Period Warning */}
      {isGracePeriod && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Failed</AlertTitle>
          <AlertDescription>
            Your last payment failed. Please update your payment method to avoid service interruption.
            You have 7 days to resolve this issue.
          </AlertDescription>
        </Alert>
      )}

      {/* Cancellation Notice */}
      {subscription?.cancel_at_period_end && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertTitle>Subscription Ending</AlertTitle>
          <AlertDescription>
            Your subscription will end on {formatPeriodEnd(subscription.current_period_end)}.
            You can reactivate anytime before then.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Your active subscription and usage limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{planConfig?.name || subscription.plan_tier}</p>
                  <p className="text-muted-foreground">
                    {subscription.is_enterprise ? (
                      'Enterprise (Custom)'
                    ) : (
                      `${formatPrice(planConfig?.price || null)}/month`
                    )}
                  </p>
                </div>
                <Badge variant={
                  subscription.subscription_status === 'active' ? 'default' :
                  subscription.subscription_status === 'past_due' ? 'destructive' :
                  'secondary'
                }>
                  {subscription.subscription_status === 'active' ? 'Active' :
                   subscription.subscription_status === 'past_due' ? 'Past Due' :
                   subscription.subscription_status === 'trialing' ? 'Trial' :
                   subscription.subscription_status}
                </Badge>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Lead Generation</p>
                  <p className="font-medium">
                    {subscription.leads_per_week_limit === -1 
                      ? 'Unlimited' 
                      : `${subscription.leads_per_week_limit.toLocaleString()}/week`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email Domains</p>
                  <p className="font-medium">
                    {subscription.email_domains_limit === -1 
                      ? 'Unlimited' 
                      : subscription.email_domains_limit
                    }
                  </p>
                </div>
                {subscription.current_period_end && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {subscription.cancel_at_period_end ? 'Ends on' : 'Renews on'}
                    </p>
                    <p className="font-medium">
                      {formatPeriodEnd(subscription.current_period_end)}
                    </p>
                  </div>
                )}
              </div>

              {!subscription.is_enterprise && (
                <>
                  <Separator />
                  <div className="flex gap-3">
                    <Button onClick={handleManageBilling} disabled={portalLoading}>
                      {portalLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-2 h-4 w-4" />
                      )}
                      Manage Billing
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Update payment method, change plan, or cancel subscription via Stripe.
                  </p>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No active subscription</p>
              <Button onClick={() => window.location.href = '/subscribe'}>
                Choose a Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      {billingHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Billing History
            </CardTitle>
            <CardDescription>
              Your recent invoices and payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {billingHistory.map((invoice) => (
                <div 
                  key={invoice.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {formatPrice(invoice.amount_paid / 100, invoice.currency.toUpperCase())}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.paid_at 
                        ? new Date(invoice.paid_at).toLocaleDateString()
                        : 'Pending'
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                      {invoice.status}
                    </Badge>
                    {invoice.invoice_pdf_url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(invoice.invoice_pdf_url!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default BillingSettings
