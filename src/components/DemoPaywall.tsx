// DemoPaywall - Shown when demo limits are exhausted or user tries locked action

import { useNavigate } from 'react-router-dom'
import { 
  Lock, 
  Rocket, 
  Check, 
  Zap, 
  Users, 
  Mail, 
  BarChart3, 
  ArrowRight,
  Sparkles 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOnboardingContext } from '@/contexts/OnboardingContext'

interface DemoPaywallProps {
  trigger?: 'limit_reached' | 'locked_action' | 'manual'
  lockedFeature?: string
}

export function DemoPaywall({ trigger = 'limit_reached', lockedFeature }: DemoPaywallProps) {
  const navigate = useNavigate()
  const { state } = useOnboardingContext()
  const { demoUsage } = state

  const features = [
    {
      icon: Users,
      title: 'Unlimited Lead Generation',
      description: 'Generate as many B2B leads as you need',
      demoLimit: `${demoUsage.leads_limit} leads`,
    },
    {
      icon: Mail,
      title: 'Unlimited Cold Emails',
      description: 'Send personalised outreach at scale',
      demoLimit: `${demoUsage.emails_limit} email`,
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Track opens, clicks, and conversions',
      demoLimit: 'Basic only',
    },
    {
      icon: Zap,
      title: 'AI Email Templates',
      description: 'Generate high-converting email copy',
      demoLimit: 'Limited',
    },
  ]

  const handleStartOnboarding = () => {
    navigate('/onboarding')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            {trigger === 'limit_reached' ? (
              <Rocket className="h-8 w-8 text-primary" />
            ) : (
              <Lock className="h-8 w-8 text-primary" />
            )}
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {trigger === 'limit_reached' 
              ? "You've explored the demo!" 
              : "Unlock Full Access"}
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            {trigger === 'limit_reached' 
              ? "You've used your demo limits. Ready to unlock the full power of Level2B?"
              : lockedFeature 
                ? `${lockedFeature} is available on paid plans.`
                : "This feature requires a subscription."}
          </p>
        </div>

        {/* Demo usage summary */}
        <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Demo Complete
                </Badge>
                <span className="text-sm text-muted-foreground">
                  You used {demoUsage.leads_used}/{demoUsage.leads_limit} leads and {demoUsage.emails_used}/{demoUsage.emails_limit} emails
                </span>
              </div>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        {/* What you unlock */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">What you'll unlock</CardTitle>
            <CardDescription>
              Everything you need to scale your B2B outreach
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{feature.title}</h3>
                      <Check className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {feature.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">
                        Demo: {feature.demoLimit}
                      </span>
                      <Badge variant="outline" className="text-xs h-5">
                        Unlimited
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-full h-12 text-base"
            onClick={handleStartOnboarding}
          >
            Continue to Setup
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          <p className="text-center text-sm text-muted-foreground">
            Takes about 2 minutes • No credit card required yet
          </p>
        </div>

        {/* Trust indicators */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>14-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>GDPR compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact paywall for inline use
interface InlinePaywallProps {
  feature: string
  onUpgrade?: () => void
}

export function InlinePaywall({ feature, onUpgrade }: InlinePaywallProps) {
  const navigate = useNavigate()

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      navigate('/onboarding')
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-6 text-center">
        <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-1">{feature}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This feature is available on paid plans
        </p>
        <Button onClick={handleUpgrade}>
          Unlock Feature
        </Button>
      </CardContent>
    </Card>
  )
}

export default DemoPaywall
