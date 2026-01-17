// DemoUsageTracker - Shows remaining demo usage with visual progress

import { Zap, Mail, Users, AlertCircle, Lock } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useOnboardingContext } from '@/contexts/OnboardingContext'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

interface DemoUsageTrackerProps {
  variant?: 'compact' | 'expanded'
  showUpgradeButton?: boolean
  className?: string
}

export function DemoUsageTracker({ 
  variant = 'compact', 
  showUpgradeButton = true,
  className 
}: DemoUsageTrackerProps) {
  const { state, isDemo } = useOnboardingContext()
  const navigate = useNavigate()
  
  // Don't show for subscribed users
  if (!isDemo) return null

  const { demoUsage } = state
  const leadsPercent = (demoUsage.leads_used / demoUsage.leads_limit) * 100
  const emailsPercent = (demoUsage.emails_used / demoUsage.emails_limit) * 100
  const isLeadsExhausted = demoUsage.leads_remaining === 0
  const isEmailsExhausted = demoUsage.emails_remaining === 0
  const allExhausted = demoUsage.all_exhausted

  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800",
        allExhausted && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
        className
      )}>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Demo Mode
          </span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300">
          <div className={cn(
            "flex items-center gap-1",
            isLeadsExhausted && "text-red-600 dark:text-red-400"
          )}>
            <Users className="h-3.5 w-3.5" />
            <span>{demoUsage.leads_remaining}/{demoUsage.leads_limit} leads</span>
          </div>
          <div className={cn(
            "flex items-center gap-1",
            isEmailsExhausted && "text-red-600 dark:text-red-400"
          )}>
            <Mail className="h-3.5 w-3.5" />
            <span>{demoUsage.emails_remaining}/{demoUsage.emails_limit} email</span>
          </div>
        </div>

        {showUpgradeButton && (
          <Button 
            size="sm" 
            variant="default"
            className="ml-auto h-7 text-xs"
            onClick={() => navigate('/onboarding')}
          >
            Upgrade
          </Button>
        )}
      </div>
    )
  }

  // Expanded variant
  return (
    <Card className={cn(
      "border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40",
      allExhausted && "border-red-200 dark:border-red-800 from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50",
              allExhausted && "bg-red-100 dark:bg-red-900/50"
            )}>
              <Zap className={cn(
                "h-5 w-5 text-amber-600 dark:text-amber-400",
                allExhausted && "text-red-600 dark:text-red-400"
              )} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Demo Mode</h3>
              <p className="text-xs text-muted-foreground">
                {allExhausted ? 'Limits reached' : 'Try before you buy'}
              </p>
            </div>
          </div>
          <Badge variant={allExhausted ? "destructive" : "secondary"}>
            {allExhausted ? 'Exhausted' : 'Active'}
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Leads usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className={cn(
                  "h-4 w-4 text-muted-foreground",
                  isLeadsExhausted && "text-red-500"
                )} />
                <span className="font-medium">Lead Generation</span>
              </div>
              <span className={cn(
                "text-muted-foreground",
                isLeadsExhausted && "text-red-500 font-medium"
              )}>
                {demoUsage.leads_used}/{demoUsage.leads_limit} used
              </span>
            </div>
            <Progress 
              value={leadsPercent} 
              className={cn(
                "h-2",
                isLeadsExhausted && "[&>div]:bg-red-500"
              )}
            />
            {isLeadsExhausted && (
              <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <Lock className="h-3 w-3" />
                <span>Upgrade to generate more leads</span>
              </div>
            )}
          </div>

          {/* Emails usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Mail className={cn(
                  "h-4 w-4 text-muted-foreground",
                  isEmailsExhausted && "text-red-500"
                )} />
                <span className="font-medium">Cold Emails</span>
              </div>
              <span className={cn(
                "text-muted-foreground",
                isEmailsExhausted && "text-red-500 font-medium"
              )}>
                {demoUsage.emails_used}/{demoUsage.emails_limit} sent
              </span>
            </div>
            <Progress 
              value={emailsPercent} 
              className={cn(
                "h-2",
                isEmailsExhausted && "[&>div]:bg-red-500"
              )}
            />
            {isEmailsExhausted && (
              <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <Lock className="h-3 w-3" />
                <span>Upgrade to send unlimited emails</span>
              </div>
            )}
          </div>
        </div>

        {showUpgradeButton && (
          <Button 
            className="w-full mt-4" 
            onClick={() => navigate('/onboarding')}
          >
            {allExhausted ? 'Unlock Full Access' : 'Upgrade Now'}
          </Button>
        )}

        {allExhausted && (
          <div className="mt-3 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                <p className="font-medium">Demo limits reached</p>
                <p className="mt-1">
                  You've experienced the core features of Level2B. Upgrade now to unlock unlimited lead generation and cold email outreach.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact inline usage indicator for specific actions
interface DemoLimitIndicatorProps {
  type: 'lead' | 'email'
  className?: string
}

export function DemoLimitIndicator({ type, className }: DemoLimitIndicatorProps) {
  const { state, isDemo } = useOnboardingContext()
  
  if (!isDemo) return null

  const { demoUsage } = state
  const remaining = type === 'lead' ? demoUsage.leads_remaining : demoUsage.emails_remaining
  const limit = type === 'lead' ? demoUsage.leads_limit : demoUsage.emails_limit
  const isExhausted = remaining === 0

  return (
    <Badge 
      variant={isExhausted ? "destructive" : "secondary"}
      className={cn("text-xs", className)}
    >
      {remaining}/{limit} {type === 'lead' ? 'leads' : 'emails'} left
    </Badge>
  )
}
