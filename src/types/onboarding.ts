// Onboarding types for Level2B

// =============================================================================
// USER STATE MODEL
// =============================================================================
// This is the deterministic state machine that decides what screen to show

export type UserFlowState = 
  | 'loading'
  | 'unauthenticated'           // → Login page
  | 'demo_active'               // → App with demo mode UI + walkthrough
  | 'demo_exhausted'            // → Paywall
  | 'paywall'                   // → Paywall (manual trigger or limit hit)
  | 'onboarding'                // → Multi-step onboarding form
  | 'subscribing'               // → Subscription selection page
  | 'payment_pending'           // → Waiting for webhook
  | 'subscribed'                // → Full app access
  | 'thank_you'                 // → Post-payment thank you page

// State machine transitions
export const STATE_TRANSITIONS: Record<UserFlowState, UserFlowState[]> = {
  loading: ['unauthenticated', 'demo_active', 'demo_exhausted', 'onboarding', 'subscribing', 'subscribed'],
  unauthenticated: ['demo_active'],
  demo_active: ['demo_exhausted', 'paywall', 'onboarding'],
  demo_exhausted: ['paywall', 'onboarding'],
  paywall: ['onboarding'],
  onboarding: ['subscribing'],
  subscribing: ['payment_pending', 'subscribed'],
  payment_pending: ['subscribed', 'thank_you'],
  subscribed: [],
  thank_you: ['subscribed'],
}

// =============================================================================
// ONBOARDING FORM
// =============================================================================

export interface OnboardingFormAnswers {
  // Step 1: Desired outcome
  desired_outcome: string
  // Step 2: Business type
  business_type: string
  company_size: string
  // Step 3: Target audience
  target_audience: string
  industry: string
  // Step 4: Current situation
  current_outreach: string
  // Step 5: Success definition
  success_definition: string
}

export const DEFAULT_FORM_ANSWERS: OnboardingFormAnswers = {
  desired_outcome: '',
  business_type: '',
  company_size: '',
  target_audience: '',
  industry: '',
  current_outreach: '',
  success_definition: '',
}

// Form step configuration
export interface OnboardingStep {
  id: number
  title: string
  description: string
  fields: (keyof OnboardingFormAnswers)[]
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: "What's your goal?",
    description: "Help us understand what you want to achieve with Level2B",
    fields: ['desired_outcome'],
  },
  {
    id: 2,
    title: "About your business",
    description: "Tell us about your company so we can personalise your experience",
    fields: ['business_type', 'company_size'],
  },
  {
    id: 3,
    title: "Who are you targeting?",
    description: "Understanding your ideal customer helps us optimise your outreach",
    fields: ['target_audience', 'industry'],
  },
  {
    id: 4,
    title: "Current outreach",
    description: "Where are you now with lead generation and cold outreach?",
    fields: ['current_outreach'],
  },
  {
    id: 5,
    title: "Define success",
    description: "What does success look like for you in 90 days?",
    fields: ['success_definition'],
  },
]

// Option presets for form fields
export const BUSINESS_TYPE_OPTIONS = [
  { value: 'b2b_saas', label: 'B2B SaaS' },
  { value: 'agency', label: 'Marketing/Sales Agency' },
  { value: 'consulting', label: 'Consulting/Professional Services' },
  { value: 'ecommerce', label: 'E-commerce/Retail' },
  { value: 'fintech', label: 'Fintech/Financial Services' },
  { value: 'healthcare', label: 'Healthcare/Medical' },
  { value: 'manufacturing', label: 'Manufacturing/Industrial' },
  { value: 'other', label: 'Other' },
]

export const COMPANY_SIZE_OPTIONS = [
  { value: 'solo', label: 'Solo founder' },
  { value: '2-10', label: '2-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
]

export const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'other', label: 'Other' },
]

export const CURRENT_OUTREACH_OPTIONS = [
  { value: 'none', label: "I haven't started cold outreach yet" },
  { value: 'manual', label: 'I send emails manually, one by one' },
  { value: 'basic_tools', label: 'I use basic email tools (Gmail, Outlook)' },
  { value: 'crm', label: 'I use a CRM but struggle with outreach' },
  { value: 'other_platform', label: 'I use another sales platform' },
  { value: 'experienced', label: "I'm experienced but want to scale" },
]

export const DESIRED_OUTCOME_OPTIONS = [
  { value: 'generate_leads', label: 'Generate more qualified leads' },
  { value: 'automate_outreach', label: 'Automate my cold email outreach' },
  { value: 'increase_replies', label: 'Increase my email reply rates' },
  { value: 'scale_sales', label: 'Scale my sales operations' },
  { value: 'find_clients', label: 'Find new clients for my agency/services' },
  { value: 'explore', label: "I'm exploring what's possible" },
]

// =============================================================================
// DEMO MODE
// =============================================================================

export interface DemoUsage {
  leads_used: number
  leads_limit: number
  leads_remaining: number
  emails_used: number
  emails_limit: number
  emails_remaining: number
  all_exhausted: boolean
}

export const DEFAULT_DEMO_USAGE: DemoUsage = {
  leads_used: 0,
  leads_limit: 5,
  leads_remaining: 5,
  emails_used: 0,
  emails_limit: 1,
  emails_remaining: 1,
  all_exhausted: false,
}

// =============================================================================
// WALKTHROUGH
// =============================================================================

export type WalkthroughStepId = 
  | 'welcome'
  | 'navigate_leads'
  | 'generate_lead'
  | 'view_lead'
  | 'navigate_templates'
  | 'create_template'
  | 'send_email'
  | 'complete'

export interface WalkthroughStep {
  id: WalkthroughStepId
  title: string
  description: string
  targetSelector?: string  // CSS selector for highlight
  position?: 'top' | 'bottom' | 'left' | 'right'
  action?: 'click' | 'navigate' | 'input'
  nextRoute?: string
  isTerminal?: boolean
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Level2B! 🎉',
    description: "Let's get you set up to generate your first leads and send your first cold email in under 5 minutes.",
    position: 'bottom',
  },
  {
    id: 'navigate_leads',
    title: 'Start with Leads',
    description: "First, let's go to the Leads section where you can generate or import potential customers.",
    targetSelector: '[data-walkthrough="nav-leads"]',
    position: 'right',
    action: 'navigate',
    nextRoute: '/outreach/leads',
  },
  {
    id: 'generate_lead',
    title: 'Generate Your First Lead',
    description: 'Click here to use AI to generate a qualified lead. You have 5 free leads in demo mode.',
    targetSelector: '[data-walkthrough="generate-lead-btn"]',
    position: 'bottom',
    action: 'click',
  },
  {
    id: 'view_lead',
    title: 'Great! Lead Generated',
    description: "You've created your first lead. Click on it to see the details.",
    targetSelector: '[data-walkthrough="lead-row"]',
    position: 'bottom',
    action: 'click',
  },
  {
    id: 'navigate_templates',
    title: "Now, Let's Create an Email",
    description: 'Navigate to Templates to create a cold email template.',
    targetSelector: '[data-walkthrough="nav-templates"]',
    position: 'right',
    action: 'navigate',
    nextRoute: '/outreach/templates',
  },
  {
    id: 'create_template',
    title: 'Generate Email Template',
    description: 'Use AI to generate a personalised cold email template.',
    targetSelector: '[data-walkthrough="generate-template-btn"]',
    position: 'bottom',
    action: 'click',
  },
  {
    id: 'send_email',
    title: 'Send Your First Email',
    description: "You have 1 free email in demo mode. Let's use it!",
    targetSelector: '[data-walkthrough="send-email-btn"]',
    position: 'bottom',
    action: 'click',
  },
  {
    id: 'complete',
    title: 'Demo Complete! 🎊',
    description: "You've experienced the core of Level2B. Ready to unlock unlimited leads and emails?",
    isTerminal: true,
  },
]

// =============================================================================
// COMPLETE ONBOARDING STATE
// =============================================================================

export interface OnboardingState {
  // User identification
  userId: string | null
  
  // Onboarding form
  isNewUser: boolean
  onboardingCompleted: boolean
  onboardingSkipped: boolean
  currentOnboardingStep: number
  formAnswers: OnboardingFormAnswers
  
  // Demo mode
  demoModeActive: boolean
  demoUsage: DemoUsage
  
  // Walkthrough
  walkthroughActive: boolean
  walkthroughCompleted: boolean
  currentWalkthroughStep: WalkthroughStepId
  stepsCompleted: WalkthroughStepId[]
  
  // Subscription
  hasSubscription: boolean
  subscriptionStatus: string | null
  
  // Computed flow state
  flowState: UserFlowState
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  userId: null,
  isNewUser: true,
  onboardingCompleted: false,
  onboardingSkipped: false,
  currentOnboardingStep: 1,
  formAnswers: DEFAULT_FORM_ANSWERS,
  demoModeActive: true,
  demoUsage: DEFAULT_DEMO_USAGE,
  walkthroughActive: true,
  walkthroughCompleted: false,
  currentWalkthroughStep: 'welcome',
  stepsCompleted: [],
  hasSubscription: false,
  subscriptionStatus: null,
  flowState: 'loading',
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine the user flow state based on onboarding state
 * This is the core state machine logic
 */
export function calculateFlowState(state: Omit<OnboardingState, 'flowState'>): UserFlowState {
  // Not logged in
  if (!state.userId) {
    return 'unauthenticated'
  }
  
  // Has active subscription - full access
  if (state.hasSubscription) {
    return 'subscribed'
  }
  
  // Check if demo is exhausted
  if (state.demoUsage.all_exhausted) {
    // If onboarding not done, go to paywall first
    if (!state.onboardingCompleted && !state.onboardingSkipped) {
      return 'demo_exhausted'
    }
    // If onboarding done but no subscription, they need to subscribe
    return 'subscribing'
  }
  
  // Demo still active
  if (state.demoModeActive) {
    return 'demo_active'
  }
  
  // Onboarding in progress
  if (!state.onboardingCompleted && !state.onboardingSkipped) {
    return 'onboarding'
  }
  
  // Onboarding done, needs to subscribe
  return 'subscribing'
}

/**
 * Check if user can perform a demo action
 */
export function canPerformDemoAction(
  usage: DemoUsage, 
  actionType: 'lead' | 'email'
): { allowed: boolean; remaining: number; message: string } {
  if (actionType === 'lead') {
    if (usage.leads_remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: "You've used all 5 demo leads. Upgrade to generate unlimited leads!",
      }
    }
    return {
      allowed: true,
      remaining: usage.leads_remaining,
      message: `${usage.leads_remaining} lead${usage.leads_remaining === 1 ? '' : 's'} remaining`,
    }
  }
  
  if (actionType === 'email') {
    if (usage.emails_remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: "You've sent your 1 demo email. Upgrade to send unlimited emails!",
      }
    }
    return {
      allowed: true,
      remaining: usage.emails_remaining,
      message: `${usage.emails_remaining} email${usage.emails_remaining === 1 ? '' : 's'} remaining`,
    }
  }
  
  return { allowed: false, remaining: 0, message: 'Invalid action type' }
}

/**
 * Get the next walkthrough step
 */
export function getNextWalkthroughStep(
  currentStep: WalkthroughStepId
): WalkthroughStep | null {
  const currentIndex = WALKTHROUGH_STEPS.findIndex(s => s.id === currentStep)
  if (currentIndex === -1 || currentIndex >= WALKTHROUGH_STEPS.length - 1) {
    return null
  }
  return WALKTHROUGH_STEPS[currentIndex + 1]
}

/**
 * Get walkthrough step by ID
 */
export function getWalkthroughStep(stepId: WalkthroughStepId): WalkthroughStep | undefined {
  return WALKTHROUGH_STEPS.find(s => s.id === stepId)
}

/**
 * Calculate onboarding progress percentage
 */
export function getOnboardingProgress(currentStep: number, totalSteps = 5): number {
  return Math.round((currentStep / totalSteps) * 100)
}

/**
 * Calculate demo usage percentage
 */
export function getDemoUsageProgress(usage: DemoUsage): number {
  const totalLimit = usage.leads_limit + usage.emails_limit
  const totalUsed = usage.leads_used + usage.emails_used
  return Math.round((totalUsed / totalLimit) * 100)
}
