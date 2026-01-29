import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { 
  FileText, 
  Users, 
  Send, 
  MessageSquare, 
  Calendar,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  Upload,
  Mail,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  Play,
  Zap
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabaseClient"
import { isCalendlyConnected } from "@/lib/api/calendly"
import { getDailyUsage, type DailyUsage } from "@/lib/api/usageLimits"

interface WorkflowStep {
  id: string
  number: number
  title: string
  description: string
  icon: any
  status: 'completed' | 'current' | 'upcoming' | 'locked'
  action: string
  actionUrl: string
  count?: number
  badge?: string
}

interface QuickStat {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function WorkflowHub() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null)
  const [quickStats, setQuickStats] = useState({
    templatesCount: 0,
    leadsCount: 0,
    emailsSent: 0,
    pendingReplies: 0,
    meetingsBooked: 0
  })

  useEffect(() => {
    if (user) {
      loadWorkflowData()
    }
  }, [user])

  const loadWorkflowData = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      // Load all counts in parallel
      const [
        templatesResult,
        leadsResult,
        emailsResult,
        meetingsResult,
        calendlyConnected,
        usage
      ] = await Promise.all([
        supabase.from('email_templates').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('activities').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'email'),
        supabase.from('calendly_meetings').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        isCalendlyConnected().catch(() => false),
        getDailyUsage().catch(() => null)
      ])

      const templatesCount = templatesResult.count || 0
      const leadsCount = leadsResult.count || 0
      const emailsSent = emailsResult.count || 0
      const meetingsBooked = meetingsResult.count || 0

      setQuickStats({
        templatesCount,
        leadsCount,
        emailsSent,
        pendingReplies: 0, // Would need separate query
        meetingsBooked
      })

      setDailyUsage(usage)

      // Determine workflow step statuses
      const steps: WorkflowStep[] = [
        {
          id: 'templates',
          number: 1,
          title: 'Create Email Template',
          description: 'Use AI to generate personalised cold email templates',
          icon: FileText,
          status: templatesCount > 0 ? 'completed' : 'current',
          action: templatesCount > 0 ? 'Manage Templates' : 'Create Template',
          actionUrl: '/outreach/templates',
          count: templatesCount,
          badge: templatesCount > 0 ? `${templatesCount} saved` : undefined
        },
        {
          id: 'leads',
          number: 2,
          title: 'Add Your Leads',
          description: 'Import CSV, generate with AI, or add manually',
          icon: Users,
          status: templatesCount === 0 ? 'locked' : leadsCount > 0 ? 'completed' : 'current',
          action: leadsCount > 0 ? 'Manage Leads' : 'Add Leads',
          actionUrl: '/outreach/leads',
          count: leadsCount,
          badge: leadsCount > 0 ? `${leadsCount} leads` : undefined
        },
        {
          id: 'send',
          number: 3,
          title: 'Send Outreach',
          description: 'Send personalised emails to your leads',
          icon: Send,
          status: leadsCount === 0 ? 'locked' : emailsSent > 0 ? 'completed' : 'current',
          action: emailsSent > 0 ? 'Send More' : 'Start Sending',
          actionUrl: '/outreach/leads',
          count: emailsSent,
          badge: emailsSent > 0 ? `${emailsSent} sent` : undefined
        },
        {
          id: 'replies',
          number: 4,
          title: 'Track Responses',
          description: 'Monitor replies and generate AI responses',
          icon: MessageSquare,
          status: emailsSent === 0 ? 'locked' : 'current',
          action: 'View Threads',
          actionUrl: '/outreach/email-threads',
          badge: undefined
        },
        {
          id: 'meetings',
          number: 5,
          title: 'Book Meetings',
          description: 'Prospects book via Calendly links in your emails',
          icon: Calendar,
          status: !calendlyConnected ? 'locked' : meetingsBooked > 0 ? 'completed' : 'upcoming',
          action: calendlyConnected ? 'View Meetings' : 'Connect Calendly',
          actionUrl: calendlyConnected ? '/meetings' : '/configuration?tab=connections',
          count: meetingsBooked,
          badge: meetingsBooked > 0 ? `${meetingsBooked} booked` : undefined
        }
      ]

      setWorkflowSteps(steps)
    } catch (error) {
      console.error('Error loading workflow data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Find the current active step
  const currentStep = workflowSteps.find(s => s.status === 'current') || workflowSteps[0]
  const completedSteps = workflowSteps.filter(s => s.status === 'completed').length
  const progress = (completedSteps / workflowSteps.length) * 100

  const getStepStatusStyles = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return {
          ring: 'ring-success/20 bg-success/10',
          icon: 'text-success',
          text: 'text-foreground'
        }
      case 'current':
        return {
          ring: 'ring-primary ring-2 bg-primary/10 shadow-lg shadow-primary/20',
          icon: 'text-primary',
          text: 'text-foreground'
        }
      case 'upcoming':
        return {
          ring: 'ring-border bg-muted/50',
          icon: 'text-muted-foreground',
          text: 'text-muted-foreground'
        }
      case 'locked':
        return {
          ring: 'ring-border bg-muted/30 opacity-60',
          icon: 'text-muted-foreground/50',
          text: 'text-muted-foreground/50'
        }
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Workflow Progress Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Your Sales Workflow</CardTitle>
                <CardDescription>
                  {completedSteps === workflowSteps.length 
                    ? "All steps completed! Keep the momentum going."
                    : `${completedSteps} of ${workflowSteps.length} steps completed`
                  }
                </CardDescription>
              </div>
            </div>
            {currentStep && currentStep.status !== 'locked' && (
              <Button onClick={() => navigate(currentStep.actionUrl)} className="gap-2">
                <Play className="h-4 w-4" />
                {currentStep.action}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <div className="grid gap-4">
        {workflowSteps.map((step, index) => {
          const styles = getStepStatusStyles(step.status)
          const isLast = index === workflowSteps.length - 1

          return (
            <div key={step.id} className="relative">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-6 top-16 w-0.5 h-8 bg-border" />
              )}
              
              <Card 
                className={cn(
                  "transition-all duration-200 cursor-pointer",
                  step.status === 'current' && "ring-2 ring-primary/50 shadow-md",
                  step.status === 'locked' && "opacity-60 cursor-not-allowed",
                  step.status !== 'locked' && "hover:shadow-md hover:border-primary/30"
                )}
                onClick={() => step.status !== 'locked' && navigate(step.actionUrl)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Step number/icon */}
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center ring-1 transition-all",
                      styles.ring
                    )}>
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="h-6 w-6 text-success" />
                      ) : (
                        <step.icon className={cn("h-6 w-6", styles.icon)} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium uppercase tracking-wider", styles.text)}>
                          Step {step.number}
                        </span>
                        {step.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {step.badge}
                          </Badge>
                        )}
                        {step.status === 'current' && (
                          <Badge variant="default" className="text-xs bg-primary animate-pulse">
                            Current
                          </Badge>
                        )}
                      </div>
                      <h3 className={cn("font-semibold mt-0.5", styles.text)}>
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>

                    {/* Action */}
                    {step.status !== 'locked' && (
                      <Button 
                        variant={step.status === 'current' ? 'default' : 'outline'} 
                        size="sm"
                        className="gap-1 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(step.actionUrl)
                        }}
                      >
                        {step.action}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>

      {/* Daily Usage Card */}
      {dailyUsage && (
        <Card className="border-info/30 bg-info/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-info/10 p-2">
                  <Mail className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Daily Email Quota</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dailyUsage.emailsRemaining} of {dailyUsage.emailLimit} remaining
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-info">
                  {dailyUsage.emailsRemaining}/{dailyUsage.emailLimit}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-info/20 rounded-full h-1.5">
                <div 
                  className="bg-info h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(dailyUsage.emailsSent / dailyUsage.emailLimit) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
