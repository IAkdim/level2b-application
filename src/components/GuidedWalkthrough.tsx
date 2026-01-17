// GuidedWalkthrough - Interactive step-by-step tour for demo users
// Highlights UI elements and requires task completion before advancing

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { 
  X, 
  Sparkles, 
  Target,
  ChevronRight,
  Loader2,
  CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useOnboardingContext } from '@/contexts/OnboardingContext'
import { cn } from '@/lib/utils'
import { WALKTHROUGH_STEPS, getWalkthroughStep, getNextWalkthroughStep } from '@/types/onboarding'
import type { WalkthroughStepId } from '@/types/onboarding'

// Event names for walkthrough task completion
export const WALKTHROUGH_EVENTS = {
  LEAD_GENERATED: 'walkthrough:lead_generated',
  LEAD_VIEWED: 'walkthrough:lead_viewed',
  TEMPLATE_CREATED: 'walkthrough:template_created',
  EMAIL_SENT: 'walkthrough:email_sent',
} as const

// Export for other components to trigger when tasks are completed
export function emitWalkthroughEvent(event: keyof typeof WALKTHROUGH_EVENTS) {
  window.dispatchEvent(new CustomEvent(WALKTHROUGH_EVENTS[event]))
}

interface GuidedWalkthroughProps {
  className?: string
}

export function GuidedWalkthrough({ className }: GuidedWalkthroughProps) {
  const navigate = useNavigate()
  const { 
    state, 
    isDemo, 
    advanceWalkthrough, 
    completeWalkthrough, 
    dismissWalkthrough 
  } = useOnboardingContext()
  
  const [isVisible, setIsVisible] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [waitingForTask, setWaitingForTask] = useState(false)
  const [taskCompleted, setTaskCompleted] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const targetElementRef = useRef<Element | null>(null)

  const currentStepId = state.currentWalkthroughStep
  const currentStep = getWalkthroughStep(currentStepId)
  const completedSteps = state.stepsCompleted.length
  const totalSteps = WALKTHROUGH_STEPS.length
  const progress = (completedSteps / totalSteps) * 100

  // Should show walkthrough?
  const shouldShow = isDemo && state.walkthroughActive && !state.walkthroughCompleted && currentStep

  // Steps that require task completion (user must DO something, not just click Next)
  const taskSteps: WalkthroughStepId[] = ['generate_lead', 'view_lead', 'create_template', 'send_email']
  const requiresTaskCompletion = taskSteps.includes(currentStepId)

  // Find and highlight target element
  const updateTargetPosition = useCallback(() => {
    if (!currentStep?.targetSelector) {
      setTargetRect(null)
      targetElementRef.current = null
      return
    }

    const target = document.querySelector(currentStep.targetSelector)
    targetElementRef.current = target
    
    if (target) {
      const rect = target.getBoundingClientRect()
      setTargetRect(rect)
      
      // Calculate tooltip position
      const tooltipWidth = 340
      const tooltipHeight = 260
      const padding = 20
      
      let top = 0
      let left = 0
      
      switch (currentStep.position) {
        case 'top':
          top = rect.top - tooltipHeight - padding
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2)
          break
        case 'bottom':
          top = rect.bottom + padding
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2)
          break
        case 'left':
          top = rect.top + (rect.height / 2) - (tooltipHeight / 2)
          left = rect.left - tooltipWidth - padding
          break
        case 'right':
          top = rect.top + (rect.height / 2) - (tooltipHeight / 2)
          left = rect.right + padding
          break
        default:
          top = rect.bottom + padding
          left = rect.left
      }
      
      // Keep within viewport
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding))
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding))
      
      setTooltipPosition({ top, left })
    } else {
      setTargetRect(null)
    }
  }, [currentStep])

  // Update position on step change or resize
  useEffect(() => {
    if (!shouldShow) return

    updateTargetPosition()
    
    window.addEventListener('resize', updateTargetPosition)
    window.addEventListener('scroll', updateTargetPosition, true)
    
    // Re-check periodically (for dynamic content)
    const interval = setInterval(updateTargetPosition, 300)
    
    return () => {
      window.removeEventListener('resize', updateTargetPosition)
      window.removeEventListener('scroll', updateTargetPosition, true)
      clearInterval(interval)
    }
  }, [shouldShow, updateTargetPosition, currentStepId])

  // Show with delay for smooth transition
  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), 300)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [shouldShow])

  // Reset task state when step changes
  useEffect(() => {
    setWaitingForTask(false)
    setTaskCompleted(false)
  }, [currentStepId])

  // Listen for task completion events
  useEffect(() => {
    if (!shouldShow || !requiresTaskCompletion) return

    const handleLeadGenerated = () => {
      if (currentStepId === 'generate_lead') {
        setTaskCompleted(true)
        setWaitingForTask(false)
      }
    }

    const handleLeadViewed = () => {
      if (currentStepId === 'view_lead') {
        setTaskCompleted(true)
        setWaitingForTask(false)
      }
    }

    const handleTemplateCreated = () => {
      if (currentStepId === 'create_template') {
        setTaskCompleted(true)
        setWaitingForTask(false)
      }
    }

    const handleEmailSent = () => {
      if (currentStepId === 'send_email') {
        setTaskCompleted(true)
        setWaitingForTask(false)
      }
    }

    window.addEventListener(WALKTHROUGH_EVENTS.LEAD_GENERATED, handleLeadGenerated)
    window.addEventListener(WALKTHROUGH_EVENTS.LEAD_VIEWED, handleLeadViewed)
    window.addEventListener(WALKTHROUGH_EVENTS.TEMPLATE_CREATED, handleTemplateCreated)
    window.addEventListener(WALKTHROUGH_EVENTS.EMAIL_SENT, handleEmailSent)

    return () => {
      window.removeEventListener(WALKTHROUGH_EVENTS.LEAD_GENERATED, handleLeadGenerated)
      window.removeEventListener(WALKTHROUGH_EVENTS.LEAD_VIEWED, handleLeadViewed)
      window.removeEventListener(WALKTHROUGH_EVENTS.TEMPLATE_CREATED, handleTemplateCreated)
      window.removeEventListener(WALKTHROUGH_EVENTS.EMAIL_SENT, handleEmailSent)
    }
  }, [shouldShow, requiresTaskCompletion, currentStepId])

  // Handle clicking the highlighted element
  const handleTargetClick = useCallback(() => {
    if (!currentStep) return
    
    if (requiresTaskCompletion) {
      // Start waiting for the task to complete
      setWaitingForTask(true)
      
      // Click the actual element to trigger the action
      if (targetElementRef.current && targetElementRef.current instanceof HTMLElement) {
        targetElementRef.current.click()
      }
    } else if (currentStep.action === 'navigate' && currentStep.nextRoute) {
      // Navigation step - navigate and advance
      navigate(currentStep.nextRoute)
      handleAdvance()
    } else {
      // Simple click - just advance
      handleAdvance()
    }
  }, [currentStep, requiresTaskCompletion, navigate])

  // Advance to next step
  const handleAdvance = async () => {
    if (!currentStep) return

    const nextStep = getNextWalkthroughStep(currentStepId)
    if (nextStep) {
      await advanceWalkthrough(nextStep.id)
    } else {
      await completeWalkthrough()
    }
    setTaskCompleted(false)
    setWaitingForTask(false)
  }

  const handleDismiss = async () => {
    await dismissWalkthrough()
  }

  const handleComplete = async () => {
    await completeWalkthrough()
    navigate('/onboarding')
  }

  if (!shouldShow || !isVisible) return null

  // Determine button state and text
  const getButtonState = () => {
    if (currentStep?.isTerminal) {
      return { text: 'Get Full Access', icon: Target, disabled: false, onClick: handleComplete }
    }
    
    if (requiresTaskCompletion) {
      if (taskCompleted) {
        return { text: 'Continue', icon: CheckCircle2, disabled: false, onClick: handleAdvance }
      }
      if (waitingForTask) {
        return { text: 'Complete the task...', icon: Loader2, disabled: true, onClick: () => {} }
      }
      // Has target - tell user to click it
      if (targetRect) {
        return { text: 'Click the highlighted element', icon: Target, disabled: true, onClick: () => {} }
      }
    }
    
    // Navigation step
    if (currentStep?.action === 'navigate') {
      return { text: 'Go there', icon: ChevronRight, disabled: false, onClick: handleTargetClick }
    }
    
    // Welcome/intro step without target
    return { text: 'Next', icon: ChevronRight, disabled: false, onClick: handleAdvance }
  }

  const buttonState = getButtonState()

  // Render spotlight overlay and tooltip
  return createPortal(
    <div className={cn("fixed inset-0 z-[100]", className)}>
      {/* Full screen dark overlay - blocks all clicks */}
      <div 
        className="absolute inset-0 bg-black/70 transition-opacity duration-300"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* SVG with spotlight cutout */}
      {targetRect && (
        <svg 
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none', zIndex: 1 }}
        >
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 10}
                y={targetRect.top - 10}
                width={targetRect.width + 20}
                height={targetRect.height + 20}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      )}

      {/* Pulsing highlight border around target */}
      {targetRect && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            top: targetRect.top - 10,
            left: targetRect.left - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
            zIndex: 2,
            border: '3px solid hsl(var(--primary))',
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4)',
            animation: 'spotlight-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Invisible clickable area over spotlight - passes clicks to element */}
      {targetRect && (
        <div
          className="absolute cursor-pointer"
          style={{
            top: targetRect.top - 10,
            left: targetRect.left - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
            zIndex: 3,
          }}
          onClick={handleTargetClick}
        />
      )}

      {/* Tooltip card */}
      <Card
        ref={tooltipRef}
        className={cn(
          "absolute w-[340px] shadow-2xl border-2 border-primary/40 bg-background/98 backdrop-blur-sm transition-all duration-300",
          !targetRect && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={targetRect ? { 
          top: tooltipPosition.top, 
          left: tooltipPosition.left,
          zIndex: 10,
        } : { zIndex: 10 }}
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline" className="text-xs font-semibold border-primary/40 text-primary">
                Step {completedSteps + 1} of {totalSteps}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mt-1 -mr-1 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <Progress value={progress} className="h-2 mb-5" />

          {/* Content */}
          <div className="mb-5">
            <h3 className="font-semibold text-lg mb-2">
              {currentStep?.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentStep?.description}
            </p>
          </div>

          {/* Task status indicator for task steps */}
          {requiresTaskCompletion && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4 text-sm font-medium",
              taskCompleted 
                ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30" 
                : waitingForTask
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  : "bg-muted text-muted-foreground border border-border"
            )}>
              {taskCompleted ? (
                <>
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>Task completed! Click Continue below.</span>
                </>
              ) : waitingForTask ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  <span>Complete the action to continue...</span>
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 flex-shrink-0" />
                  <span>Click the highlighted button above</span>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip tour
            </Button>

            <Button 
              size="sm" 
              onClick={buttonState.onClick}
              disabled={buttonState.disabled}
              className={cn(
                "min-w-[140px]",
                taskCompleted && "bg-green-600 hover:bg-green-700 text-white"
              )}
            >
              {waitingForTask ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <buttonState.icon className="mr-2 h-4 w-4" />
              )}
              {buttonState.text}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CSS for spotlight pulse animation */}
      <style>{`
        @keyframes spotlight-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px hsl(var(--primary) / 0.15), 0 0 50px hsl(var(--primary) / 0.5);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}

// Mini walkthrough status indicator for the top bar
export function WalkthroughIndicator() {
  const { state, isDemo } = useOnboardingContext()
  const navigate = useNavigate()

  if (!isDemo || !state.walkthroughActive || state.walkthroughCompleted) {
    return null
  }

  const completedSteps = state.stepsCompleted.length
  const totalSteps = WALKTHROUGH_STEPS.length
  const currentStep = getWalkthroughStep(state.currentWalkthroughStep)

  return (
    <button
      onClick={() => {
        if (currentStep?.nextRoute) {
          navigate(currentStep.nextRoute)
        }
      }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
    >
      <Sparkles className="h-4 w-4" />
      <span>Tour: {completedSteps}/{totalSteps}</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}

export default GuidedWalkthrough
