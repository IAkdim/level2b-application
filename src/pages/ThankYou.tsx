// ThankYou page - Shown after successful subscription activation
// Content: Thank you message, plan summary, video tutorial, CTA to product

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  CheckCircle2, 
  Rocket, 
  Play, 
  ArrowRight, 
  Zap,
  Users,
  Mail,
  BarChart3,
  Calendar,
  Sparkles,
  PartyPopper
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSubscriptionContext } from '@/contexts/SubscriptionContext'
import { useOnboardingContext } from '@/contexts/OnboardingContext'
import { getPlanConfig } from '@/types/subscription'

export function ThankYou() {
  const navigate = useNavigate()
  const { subscription } = useSubscriptionContext()
  // Access onboarding context for future features
  useOnboardingContext()
  const [showCelebration, setShowCelebration] = useState(true)

  // Hide celebration after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowCelebration(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const planConfig = subscription?.plan_tier ? getPlanConfig(subscription.plan_tier) : null

  const quickStartSteps = [
    {
      icon: Users,
      title: 'Generate your first leads',
      description: 'Use AI to find qualified B2B prospects',
      href: '/outreach/leads',
    },
    {
      icon: Mail,
      title: 'Create email templates',
      description: 'Generate personalized cold email copy',
      href: '/outreach/templates',
    },
    {
      icon: Calendar,
      title: 'Connect your calendar',
      description: 'Sync with Calendly for meeting booking',
      href: '/configuration',
    },
    {
      icon: BarChart3,
      title: 'Explore analytics',
      description: 'Track opens, clicks, and conversions',
      href: '/analytics',
    },
  ]

  const expectedResults = [
    '10x faster lead generation',
    'Higher email response rates',
    'More meetings booked',
    'Clear pipeline visibility',
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      {/* Celebration animation */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="animate-bounce">
            <PartyPopper className="h-24 w-24 text-primary opacity-50" />
          </div>
        </div>
      )}

      <div className="container max-w-4xl py-12 px-4">
        {/* Success Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to Level2B! 🎉
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            Your subscription is active. You now have full access to all features.
          </p>
        </div>

        {/* Plan Summary Card */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">
                      {planConfig?.name || subscription?.plan_tier} Plan
                    </h2>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Full access to all features
                  </p>
                </div>
              </div>
              
              {subscription?.current_period_end && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Next billing</p>
                  <p className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* What to Expect */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              What to expect
            </CardTitle>
            <CardDescription>
              Results you can achieve with Level2B
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {expectedResults.map((result, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="font-medium">{result}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Video Tutorial */}
        <Card className="mb-8 overflow-hidden">
          <div className="relative aspect-video bg-muted">
            {/* Replace with actual video embed */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center cursor-pointer hover:bg-primary transition-colors shadow-lg">
                <Play className="h-10 w-10 text-white ml-1" />
              </div>
              <p className="mt-4 text-muted-foreground font-medium">
                Watch: Get started in 5 minutes
              </p>
            </div>
            
            {/* Uncomment and add your video URL
            <iframe
              src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
              title="Getting Started with Level2B"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
            */}
          </div>
          <CardContent className="p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Pro tip:</strong> This 5-minute video shows you how to generate your first 10 leads
            </p>
          </CardContent>
        </Card>

        {/* Quick Start Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Quick start
            </CardTitle>
            <CardDescription>
              Get the most out of Level2B
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {quickStartSteps.map((step, index) => (
                <button
                  key={index}
                  onClick={() => navigate(step.href)}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-0.5 group-hover:text-primary transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main CTA */}
        <div className="text-center">
          <Button 
            size="lg" 
            className="h-12 px-8 text-base"
            onClick={() => navigate('/')}
          >
            Go to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          <p className="mt-4 text-sm text-muted-foreground">
            Need help? Contact us at{' '}
            <a href="mailto:support@level2b.com" className="text-primary hover:underline">
              support@level2b.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ThankYou
