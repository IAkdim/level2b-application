// GuidedWalkthrough - Interactive step-by-step tour for demo users
// Highlights UI elements and guides users to generate leads and send first email

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { 
  X, 
  Sparkles, 
  Target,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useOnboardingContext } from '@/contexts/OnboardingContext'
import { cn } from '@/lib/utils'
// Types are defined inline
import { WALKTHROUGH_STEPS, getWalkthroughStep, getNextWalkthroughStep } from '@/types/onboarding'

interface GuidedWalkthroughProps {
  className?: string
}

export function GuidedWalkthrough({ className }: GuidedWalkthroughProps) {
  const navigate = useNavigate()
  const location = useLocation()
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
  const tooltipRef = useRef<HTMLDivElement>(null)

  const currentStepId = state.currentWalkthroughStep
  const currentStep = getWalkthroughStep(currentStepId)
  const completedSteps = state.stepsCompleted.length
  const totalSteps = WALKTHROUGH_STEPS.length
  const progress = (completedSteps / totalSteps) * 100

  // Should show walkthrough?
  const shouldShow = isDemo && state.walkthroughActive && !state.walkthroughCompleted && currentStep

  // Find and highlight target element
  const updateTargetPosition = useCallback(() => {
    if (!currentStep?.targetSelector) {
      setTargetRect(null)
      return
    }

    const target = document.querySelector(currentStep.targetSelector)
    if (target) {
      const rect = target.getBoundingClientRect()
      setTargetRect(rect)
      
      // Calculate tooltip position
      const tooltipWidth = 320
      const tooltipHeight = 200
      const padding = 16
      
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
    const interval = setInterval(updateTargetPosition, 500)
    
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

  // Handle navigation for steps that require route change
  useEffect(() => {
    if (!shouldShow || !currentStep?.nextRoute) return
    
    // Check if we need to navigate
    if (currentStep.action === 'navigate' && !location.pathname.includes(currentStep.nextRoute)) {
      // Don't auto-navigate, wait for user click
    }
  }, [shouldShow, currentStep, location.pathname])

  const handleNext = async () => {
    if (!currentStep) return

    // If this step requires navigation
    if (currentStep.nextRoute && !location.pathname.includes(currentStep.nextRoute)) {
      navigate(currentStep.nextRoute)
    }

    const nextStep = getNextWalkthroughStep(currentStepId)
    if (nextStep) {
      await advanceWalkthrough(nextStep.id)
    } else {
      await completeWalkthrough()
    }
  }

  const handleDismiss = async () => {
    await dismissWalkthrough()
  }

  const handleComplete = async () => {
    await completeWalkthrough()
    navigate('/onboarding')
  }

  if (!shouldShow || !isVisible) return null

  // Render spotlight overlay and tooltip
  return createPortal(
    <div className={cn("fixed inset-0 z-[100]", className)}>
      {/* Dark overlay with spotlight cutout */}
      {targetRect && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.5)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      )}

      {/* Highlight ring around target */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip */}
      <Card
        ref={tooltipRef}
        className={cn(
          "absolute w-80 shadow-2xl border-primary/20 transition-all duration-300",
          !targetRect && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={targetRect ? { top: tooltipPosition.top, left: tooltipPosition.left } : {}}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <Badge variant="secondary" className="text-xs">
                Step {completedSteps + 1} of {totalSteps}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <Progress value={progress} className="h-1.5 mb-4" />

          {/* Content */}
          <div className="mb-4">
            <h3 className="font-semibold text-base mb-1">
              {currentStep?.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {currentStep?.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-muted-foreground"
            >
              Skip tour
            </Button>

            {currentStep?.isTerminal ? (
              <Button size="sm" onClick={handleComplete}>
                <Target className="mr-2 h-4 w-4" />
                Get Full Access
              </Button>
            ) : (
              <Button size="sm" onClick={handleNext}>
                {currentStep?.action === 'navigate' ? 'Go there' : 'Next'}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
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
        // Could navigate to the step's route
        if (currentStep?.nextRoute) {
          navigate(currentStep.nextRoute)
        }
      }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
    >
      <Sparkles className="h-4 w-4" />
      <span>Setup: {completedSteps}/{totalSteps}</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}

export default GuidedWalkthrough
