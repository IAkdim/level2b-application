import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Mail, Users, FileText, Calendar, Check, Minimize2, Maximize2, ChevronRight, LucideIcon, Sparkles, ArrowRight, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { eventBus } from "@/lib/eventBus"
import { supabase } from "@/lib/supabaseClient"

const STORAGE_KEY = "ai_emailer_onboarding_tasks"
const DISMISSED_KEY = "ai_emailer_onboarding_dismissed"

interface OnboardingTask {
  id: string
  title: string
  description: string
  icon: LucideIcon
  completed: boolean
  checkType: 'manual' | 'leads' | 'templates' | 'emails' | 'meetings'
  actionUrl?: string
  actionType?: 'navigate' | 'external'
  stepNumber: number
}

const DEFAULT_TASKS: OnboardingTask[] = [
  {
    id: 'connect-gmail',
    title: 'Connect your Gmail account',
    description: 'Link your Gmail to start sending emails',
    icon: Mail,
    completed: false,
    checkType: 'manual',
    actionUrl: '/configuration',
    actionType: 'navigate',
    stepNumber: 0
  },
  {
    id: 'create-template',
    title: 'Create an email template',
    description: 'Use AI to generate your first outreach template',
    icon: FileText,
    completed: false,
    checkType: 'templates',
    actionUrl: '/outreach/templates',
    actionType: 'navigate',
    stepNumber: 1
  },
  {
    id: 'add-leads',
    title: 'Add your first leads',
    description: 'Import or manually add leads to your CRM',
    icon: Users,
    completed: false,
    checkType: 'leads',
    actionUrl: '/outreach/leads',
    actionType: 'navigate',
    stepNumber: 2
  },
  {
    id: 'send-email',
    title: 'Send your first email',
    description: 'Send a test email to verify everything works',
    icon: Mail,
    completed: false,
    checkType: 'emails',
    actionUrl: '/outreach/email-threads',
    actionType: 'navigate',
    stepNumber: 3
  },
  {
    id: 'connect-calendly',
    title: 'Connect Calendly (Optional)',
    description: 'Link Calendly to track meeting bookings',
    icon: Calendar,
    completed: false,
    checkType: 'meetings',
    actionUrl: '/configuration',
    actionType: 'navigate',
    stepNumber: 4
  }
]

export function FirstVisitModal() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [tasks, setTasks] = useState<OnboardingTask[]>(DEFAULT_TASKS)

  useEffect(() => {
    // Load saved tasks state
    try {
      const savedTasks = localStorage.getItem(STORAGE_KEY)
      const dismissed = localStorage.getItem(DISMISSED_KEY)
      
      if (dismissed === 'true') {
        setOpen(false)
        return
      }

      if (savedTasks) {
        const parsed = JSON.parse(savedTasks)
        
        // Merge saved state with default tasks to restore icon components
        const mergedTasks = DEFAULT_TASKS.map(defaultTask => {
          const savedTask = parsed.find((t: any) => t.id === defaultTask.id)
          return savedTask ? {
            ...defaultTask,
            completed: savedTask.completed
          } : defaultTask
        })
        
        setTasks(mergedTasks)
        
        // Check if all completed
        const allCompleted = mergedTasks.every((t: OnboardingTask) => t.completed)
        if (!allCompleted) {
          setOpen(true)
        }
      } else {
        setOpen(true)
      }
    } catch {
      setOpen(true)
    }

    // Listen for guide open event
    const unsub = eventBus.on("guide:open", () => {
      setOpen(true)
      setMinimized(false)
    })
    
    return () => unsub()
  }, [])

  // Auto-check tasks based on actual data
  useEffect(() => {
    if (!open) return

    const checkTasks = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const updatedTasks = [...tasks]
        let hasChanges = false

        // Check for Gmail connection
        if (session.provider_token && !tasks[0].completed) {
          updatedTasks[0].completed = true
          hasChanges = true
        }

        // Check for templates (now index 1)
        if (tasks[1].checkType === 'templates' && !tasks[1].completed) {
          const { count } = await supabase
            .from('email_templates')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)

          if (count && count > 0) {
            updatedTasks[1].completed = true
            hasChanges = true
          }
        }

        // Check for leads (now index 2)
        if (tasks[2].checkType === 'leads' && !tasks[2].completed) {
          const { count } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)

          if (count && count > 0) {
            updatedTasks[2].completed = true
            hasChanges = true
          }
        }

        if (hasChanges) {
          setTasks(updatedTasks)
          saveTasks(updatedTasks)
        }
      } catch (error) {
        console.error('Error checking tasks:', error)
      }
    }

    checkTasks()
    
    // Re-check every 30 seconds while modal is open
    const interval = setInterval(checkTasks, 30000)
    return () => clearInterval(interval)
  }, [open, tasks])

  const saveTasks = (newTasks: OnboardingTask[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks))
    } catch {}
  }

  const toggleTask = (taskId: string) => {
    const newTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    )
    setTasks(newTasks)
    saveTasks(newTasks)
  }

  const handleTaskClick = (task: OnboardingTask) => {
    // If task is already completed, don't navigate
    if (task.completed) return

    // Navigate to the task's action URL
    if (task.actionUrl) {
      if (task.actionType === 'navigate') {
        // Minimize modal and navigate
        setMinimized(true)
        navigate(task.actionUrl)
      } else if (task.actionType === 'external') {
        // Open in new tab
        window.open(task.actionUrl, '_blank')
      }
    }
  }

  const skipAll = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {}
    setOpen(false)
  }

  const completedCount = tasks.filter(t => t.completed).length
  const progress = (completedCount / tasks.length) * 100
  const allCompleted = completedCount === tasks.length

  // Auto-hide when all completed
  useEffect(() => {
    if (allCompleted && open) {
      const timer = setTimeout(() => {
        setOpen(false)
        try {
          localStorage.setItem(DISMISSED_KEY, 'true')
        } catch {}
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [allCompleted, open])

  if (!open) return null

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card className="w-80 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {completedCount}/{tasks.length}
                </Badge>
                <span className="text-sm font-medium">Getting Started</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMinimized(false)}
                  className="h-7 w-7 p-0"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipAll}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Progress value={progress} className="h-2 mt-2" />
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Welcome to Level2B!
                  {allCompleted && (
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Complete!
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Let's get you set up in 5 easy steps
                </CardDescription>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMinimized(true)}
              className="h-8 w-8 p-0"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipAll}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar with label */}
          <div className="space-y-2 bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">Your Progress</span>
              </div>
              <span className="text-muted-foreground">
                {completedCount} of {tasks.length} completed
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            {!allCompleted && completedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Great start! Keep going to unlock your full potential.
              </p>
            )}
          </div>

          {/* Tasks list with step numbers */}
          <div className="space-y-2">
            {tasks.map((task, index) => {
              const Icon = task.icon
              const isNextStep = !task.completed && tasks.slice(0, index).every(t => t.completed)
              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className={`flex items-center gap-4 rounded-lg border p-4 transition-all ${
                    task.completed
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-500/30'
                      : isNextStep
                      ? 'bg-primary/5 border-primary/30 hover:border-primary/50 cursor-pointer ring-2 ring-primary/20'
                      : 'hover:bg-muted/50 hover:border-muted-foreground/30 cursor-pointer'
                  }`}
                >
                  {/* Step number or checkmark */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-semibold text-sm transition-all ${
                      task.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : isNextStep
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/30 text-muted-foreground'
                    }`}
                  >
                    {task.completed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      task.stepNumber + 1
                    )}
                  </div>
                  
                  {/* Icon */}
                  <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
                    task.completed 
                      ? 'bg-green-100 dark:bg-green-900/30' 
                      : isNextStep
                      ? 'bg-primary/10'
                      : 'bg-muted'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      task.completed 
                        ? 'text-green-600' 
                        : isNextStep
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {task.description}
                    </p>
                  </div>
                  
                  {/* Arrow for next step */}
                  {!task.completed && (
                    <div className={`shrink-0 ${isNextStep ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isNextStep ? (
                        <ArrowRight className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5 opacity-50" />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-4 border-t">
            <Button variant="ghost" onClick={skipAll} className="sm:w-auto text-muted-foreground">
              Skip for now
            </Button>
            {allCompleted ? (
              <Button onClick={() => setOpen(false)} className="sm:w-auto">
                <Rocket className="h-4 w-4 mr-2" />
                Start using Level2B
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setMinimized(true)} className="sm:w-auto">
                <Minimize2 className="h-4 w-4 mr-2" />
                Continue later
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
