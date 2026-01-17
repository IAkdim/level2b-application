// Paywall Page - Shown when user doesn't have an active subscription

import { useState } from 'react'
import { Check, Loader2, Zap, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSubscriptionContext } from '@/contexts/SubscriptionContext'
import { PLANS, formatPrice, type PlanConfig } from '@/types/subscription'
import { cn } from '@/lib/utils'

export function Subscribe() {
  const { createCheckoutSession, loading: subscriptionLoading, error } = useSubscriptionContext()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const handleSelectPlan = async (plan: PlanConfig) => {
    // Enterprise plan - no Stripe checkout
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@level2b.com?subject=Enterprise%20Inquiry'
      return
    }

    // Check if price ID is configured
    if (!plan.priceId) {
      console.error(`Price ID not configured for ${plan.name}. Set VITE_STRIPE_PRICE_${plan.id.toUpperCase()} in .env.local`)
      setCheckoutError(`Stripe is not configured yet. Please set up your Stripe Price IDs in .env.local`)
      return
    }

    setLoadingPlan(plan.id)
    setCheckoutError(null)

    try {
      const checkoutUrl = await createCheckoutSession(plan.priceId)
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      }
    } catch (error: any) {
      console.error('Error starting checkout:', error)
      setCheckoutError(error.message || 'Failed to start checkout')
    } finally {
      setLoadingPlan(null)
    }
  }

  const displayError = checkoutError || error

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-6xl py-16 px-4">
        {/* Error Banner */}
        {displayError && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
            <p className="text-destructive font-medium">{displayError}</p>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start generating B2B leads and growing your business today.
            All plans include a 14-day money-back guarantee.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {PLANS.map((plan) => (
            <Card 
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                plan.highlighted && 'border-primary shadow-lg scale-105'
              )}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {plan.id === 'starter' && <Zap className="h-5 w-5 text-yellow-500" />}
                  {plan.id === 'pro' && <Zap className="h-5 w-5 text-primary" />}
                  {plan.id === 'enterprise' && <Building2 className="h-5 w-5 text-purple-500" />}
                  {plan.name}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    {formatPrice(plan.price)}
                  </span>
                  {plan.price && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={plan.highlighted ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loadingPlan !== null || subscriptionLoading}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : plan.id === 'enterprise' ? (
                    'Contact Sales'
                  ) : (
                    'Get Started'
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ or additional info */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Questions? Contact us at{' '}
            <a href="mailto:support@level2b.com" className="text-primary hover:underline">
              support@level2b.com
            </a>
          </p>
          <p className="mt-2">
            All prices are in EUR. VAT may apply based on your location.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Subscribe
