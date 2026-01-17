import { LucideIcon, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionIcon?: LucideIcon
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
  variant?: 'default' | 'workflow'
  workflowStep?: {
    current: number
    total: number
    nextStepLabel?: string
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  variant = 'default',
  workflowStep
}: EmptyStateProps) {
  if (variant === 'workflow' && workflowStep) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}>
        <div className="relative">
          {/* Workflow progress ring */}
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          {/* Step indicator */}
          <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg">
            {workflowStep.current}/{workflowStep.total}
          </div>
        </div>
        
        <h3 className="mt-6 text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
        
        {workflowStep.nextStepLabel && (
          <p className="mt-4 text-xs text-muted-foreground">
            Next step: <span className="font-medium text-foreground">{workflowStep.nextStepLabel}</span>
          </p>
        )}
        
        {actionLabel && onAction && (
          <Button onClick={onAction} className="mt-6 gap-2">
            {ActionIcon && <ActionIcon className="h-4 w-4" />}
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        
        {secondaryActionLabel && onSecondaryAction && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSecondaryAction}
            className="mt-2 text-muted-foreground"
          >
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {description}
      </p>
      
      <div className="mt-6 flex items-center gap-3">
        {actionLabel && onAction && (
          <Button onClick={onAction} className="gap-2">
            {ActionIcon && <ActionIcon className="h-4 w-4" />}
            {actionLabel}
          </Button>
        )}
        
        {secondaryActionLabel && onSecondaryAction && (
          <Button variant="outline" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

interface ContextualTipProps {
  icon?: LucideIcon
  title: string
  description: string
  variant?: 'info' | 'success' | 'warning'
  actionLabel?: string
  onAction?: () => void
  dismissible?: boolean
  onDismiss?: () => void
}

export function ContextualTip({
  icon: Icon,
  title,
  description,
  variant = 'info',
  actionLabel,
  onAction,
  dismissible,
  onDismiss
}: ContextualTipProps) {
  const variantStyles = {
    info: 'bg-info/10 border-info/30 text-info',
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning'
  }

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-lg border",
      variantStyles[variant]
    )}>
      {Icon && (
        <div className="shrink-0 mt-0.5">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        {actionLabel && onAction && (
          <Button 
            variant="link" 
            size="sm" 
            onClick={onAction}
            className="p-0 h-auto mt-2 text-sm"
          >
            {actionLabel} →
          </Button>
        )}
      </div>
      {dismissible && onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-6 w-6 p-0"
          onClick={onDismiss}
        >
          ×
        </Button>
      )}
    </div>
  )
}

interface StepIndicatorProps {
  steps: Array<{
    label: string
    completed: boolean
    current: boolean
  }>
}

export function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium transition-colors",
            step.completed 
              ? "bg-success text-success-foreground"
              : step.current 
              ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
              : "bg-muted text-muted-foreground"
          )}>
            {step.completed ? '✓' : index + 1}
          </div>
          <span className={cn(
            "text-sm",
            step.current ? "font-medium" : "text-muted-foreground"
          )}>
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div className={cn(
              "w-8 h-0.5 rounded",
              step.completed ? "bg-success" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  )
}
