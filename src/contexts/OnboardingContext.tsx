// OnboardingContext - Provides onboarding, demo, and walkthrough state throughout the app

import { createContext, useContext, ReactNode } from 'react'
import { useOnboarding, UseOnboardingReturn } from '@/hooks/useOnboarding'

const OnboardingContext = createContext<UseOnboardingReturn | undefined>(undefined)

interface OnboardingProviderProps {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const onboarding = useOnboarding()

  return (
    <OnboardingContext.Provider value={onboarding}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboardingContext(): UseOnboardingReturn {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboardingContext must be used within an OnboardingProvider')
  }
  return context
}

// Re-export types for convenience
export type { UseOnboardingReturn }
