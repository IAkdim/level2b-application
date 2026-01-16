// OnboardingForm - Multi-step onboarding form for new users
// Purpose: Increase motivation, clarify goals, gather personalization data

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowRight, 
  ArrowLeft, 
  Target, 
  Building2, 
  Users, 
  TrendingUp, 
  Trophy,
  Loader2,
  SkipForward,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useOnboardingContext } from '@/contexts/OnboardingContext'
import { cn } from '@/lib/utils'
import type { OnboardingFormAnswers } from '@/types/onboarding'
import {
  ONBOARDING_STEPS,
  BUSINESS_TYPE_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  INDUSTRY_OPTIONS,
  CURRENT_OUTREACH_OPTIONS,
  DESIRED_OUTCOME_OPTIONS,
} from '@/types/onboarding'

const STEP_ICONS = [Target, Building2, Users, TrendingUp, Trophy]

export function OnboardingForm() {
  const navigate = useNavigate()
  const { 
    state, 
    updateOnboardingStep, 
    completeOnboarding, 
    skipOnboarding,
    loading: contextLoading 
  } = useOnboardingContext()
  
  const [currentStep, setCurrentStep] = useState(state.currentOnboardingStep || 1)
  const [answers, setAnswers] = useState<OnboardingFormAnswers>(state.formAnswers)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [_direction, setDirection] = useState<'forward' | 'back'>('forward')

  // Sync with context state on mount
  useEffect(() => {
    if (state.currentOnboardingStep) {
      setCurrentStep(state.currentOnboardingStep)
    }
    if (state.formAnswers) {
      setAnswers(state.formAnswers)
    }
  }, [state.currentOnboardingStep, state.formAnswers])

  const totalSteps = ONBOARDING_STEPS.length
  const progress = (currentStep / totalSteps) * 100
  const stepConfig = ONBOARDING_STEPS[currentStep - 1]
  const StepIcon = STEP_ICONS[currentStep - 1]

  // Check if current step is complete
  const isStepComplete = () => {
    const fields = stepConfig.fields
    return fields.every(field => answers[field] && answers[field].trim() !== '')
  }

  // Handle answer change
  const handleAnswerChange = (field: keyof OnboardingFormAnswers, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }))
  }

  // Save current step
  const saveCurrentStep = async () => {
    const stepAnswers: Partial<OnboardingFormAnswers> = {}
    stepConfig.fields.forEach(field => {
      stepAnswers[field] = answers[field]
    })
    await updateOnboardingStep(currentStep, stepAnswers)
  }

  // Go to next step
  const handleNext = async () => {
    setIsSubmitting(true)
    try {
      await saveCurrentStep()
      
      if (currentStep < totalSteps) {
        setDirection('forward')
        setCurrentStep(prev => prev + 1)
      } else {
        // Complete onboarding
        await completeOnboarding()
        navigate('/subscribe')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Go to previous step
  const handleBack = async () => {
    if (currentStep > 1) {
      await saveCurrentStep()
      setDirection('back')
      setCurrentStep(prev => prev - 1)
    }
  }

  // Skip onboarding
  const handleSkip = async () => {
    setIsSubmitting(true)
    try {
      await skipOnboarding()
      navigate('/subscribe')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Render field based on type
  const renderField = (fieldName: keyof OnboardingFormAnswers) => {
    switch (fieldName) {
      case 'desired_outcome':
        return (
          <div className="space-y-3">
            <Label className="text-base font-medium">What do you want to achieve?</Label>
            <RadioGroup
              value={answers.desired_outcome}
              onValueChange={(value) => handleAnswerChange('desired_outcome', value)}
              className="grid gap-3"
            >
              {DESIRED_OUTCOME_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    answers.desired_outcome === option.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span>{option.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )

      case 'business_type':
        return (
          <div className="space-y-3">
            <Label className="text-base font-medium">What type of business are you?</Label>
            <RadioGroup
              value={answers.business_type}
              onValueChange={(value) => handleAnswerChange('business_type', value)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`biz-${option.value}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    answers.business_type === option.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value={option.value} id={`biz-${option.value}`} />
                  <span className="text-sm">{option.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )

      case 'company_size':
        return (
          <div className="space-y-3">
            <Label className="text-base font-medium">How big is your team?</Label>
            <RadioGroup
              value={answers.company_size}
              onValueChange={(value) => handleAnswerChange('company_size', value)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {COMPANY_SIZE_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`size-${option.value}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    answers.company_size === option.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value={option.value} id={`size-${option.value}`} />
                  <span className="text-sm">{option.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )

      case 'target_audience':
        return (
          <div className="space-y-3">
            <Label htmlFor="target_audience" className="text-base font-medium">
              Describe your ideal customer
            </Label>
            <Textarea
              id="target_audience"
              value={answers.target_audience}
              onChange={(e) => handleAnswerChange('target_audience', e.target.value)}
              placeholder="e.g., CTOs at SaaS companies with 50-200 employees who struggle with technical debt..."
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific - this helps us personalize your outreach
            </p>
          </div>
        )

      case 'industry':
        return (
          <div className="space-y-3">
            <Label className="text-base font-medium">Which industry do you target?</Label>
            <RadioGroup
              value={answers.industry}
              onValueChange={(value) => handleAnswerChange('industry', value)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {INDUSTRY_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`industry-${option.value}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    answers.industry === option.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value={option.value} id={`industry-${option.value}`} />
                  <span className="text-sm">{option.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )

      case 'current_outreach':
        return (
          <div className="space-y-3">
            <Label className="text-base font-medium">How do you currently do outreach?</Label>
            <RadioGroup
              value={answers.current_outreach}
              onValueChange={(value) => handleAnswerChange('current_outreach', value)}
              className="grid gap-3"
            >
              {CURRENT_OUTREACH_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`outreach-${option.value}`}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    answers.current_outreach === option.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value={option.value} id={`outreach-${option.value}`} />
                  <span>{option.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )

      case 'success_definition':
        return (
          <div className="space-y-3">
            <Label htmlFor="success_definition" className="text-base font-medium">
              What does success look like in 90 days?
            </Label>
            <Textarea
              id="success_definition"
              value={answers.success_definition}
              onChange={(e) => handleAnswerChange('success_definition', e.target.value)}
              placeholder="e.g., Generate 100 qualified leads per month, book 10 demos weekly, increase reply rates to 15%..."
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific - concrete goals help us help you achieve them
            </p>
          </div>
        )

      default:
        return null
    }
  }

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Quick Setup
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Let's personalize Level2B for you
          </h1>
          <p className="text-muted-foreground mt-2">
            Answer a few questions so we can optimize your experience
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Step {currentStep} of {totalSteps}</span>
            <span className="font-medium">{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {ONBOARDING_STEPS.map((step, index) => {
              const Icon = STEP_ICONS[index]
              const isActive = index + 1 === currentStep
              const isCompleted = index + 1 < currentStep
              
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center gap-1",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                    isActive && "border-primary bg-primary/10",
                    isCompleted && "border-green-600 bg-green-50 dark:bg-green-950",
                    !isActive && !isCompleted && "border-muted"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Form Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{stepConfig.title}</CardTitle>
                <CardDescription>{stepConfig.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {stepConfig.fields.map((field) => (
              <div key={field}>
                {renderField(field)}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="text-muted-foreground"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Skip for now
          </Button>

          <Button
            onClick={handleNext}
            disabled={!isStepComplete() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : currentStep === totalSteps ? (
              <>
                Complete
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Your answers help us personalize your experience. 
          We never share your data with third parties.
        </p>
      </div>
    </div>
  )
}

export default OnboardingForm
