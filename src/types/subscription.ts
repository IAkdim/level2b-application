// Subscription types for Level2B

export type PlanTier = 'starter' | 'pro' | 'enterprise' | 'none'

export type SubscriptionStatus = 
  | 'active' 
  | 'trialing' 
  | 'past_due' 
  | 'canceled' 
  | 'unpaid' 
  | 'incomplete' 
  | 'incomplete_expired' 
  | 'paused'

export interface Subscription {
  id: string
  user_id: string  // Subscriptions are per-user (account)
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: SubscriptionStatus
  price_id: string | null
  plan_tier: PlanTier
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  is_enterprise: boolean
  enterprise_granted_by: string | null
  enterprise_granted_at: string | null
  enterprise_notes: string | null
  leads_per_week_limit: number
  email_domains_limit: number
  created_at: string
  updated_at: string
}

export interface BillingHistory {
  id: string
  user_id: string  // Billing history is per-user
  stripe_invoice_id: string
  stripe_subscription_id: string | null
  amount_paid: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  invoice_pdf_url: string | null
  hosted_invoice_url: string | null
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  created_at: string
}

// Plan configuration
export interface PlanConfig {
  id: PlanTier
  name: string
  price: number | null // null for Enterprise (custom pricing)
  priceId: string | null // Stripe Price ID
  features: string[]
  limits: {
    leadsPerWeek: number | null // null = unlimited
    emailDomains: number | null
  }
  highlighted?: boolean
}

export const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 199,
    priceId: import.meta.env.VITE_STRIPE_PRICE_STARTER || null,
    features: [
      'Lead generation (1,000/week)',
      'Cold outreach mailing',
      'Analytics dashboard',
      'Email support',
    ],
    limits: {
      leadsPerWeek: 1000,
      emailDomains: 1,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 299,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO || null,
    features: [
      'Unlimited lead generation',
      'Multiple email domains',
      'Advanced analytics',
      'Priority support',
      'API access',
    ],
    limits: {
      leadsPerWeek: null, // Unlimited
      emailDomains: null,
    },
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null, // Custom
    priceId: null,
    features: [
      'Everything in Pro',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom contracts',
      'On-premise options',
    ],
    limits: {
      leadsPerWeek: null,
      emailDomains: null,
    },
  },
]

// Helper to get plan config by tier
export function getPlanConfig(tier: PlanTier): PlanConfig | undefined {
  return PLANS.find(p => p.id === tier)
}

// Check if a status grants access
export function hasActiveAccess(status: SubscriptionStatus | null): boolean {
  if (!status) return false
  return ['active', 'trialing'].includes(status)
}

// Check if status is in grace period (past_due but recent)
export function isInGracePeriod(subscription: Subscription | null): boolean {
  if (!subscription) return false
  if (subscription.subscription_status !== 'past_due') return false
  
  // 7 day grace period
  const updatedAt = new Date(subscription.updated_at)
  const gracePeriodEnd = new Date(updatedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  return new Date() < gracePeriodEnd
}

// Check if user has any access (active, trialing, or grace period)
export function hasSubscriptionAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false
  
  // Enterprise users always have access
  if (subscription.is_enterprise) return true
  
  // Active or trialing
  if (hasActiveAccess(subscription.subscription_status)) return true
  
  // Past due but in grace period
  if (isInGracePeriod(subscription)) return true
  
  return false
}

// Format price for display
export function formatPrice(price: number | null, currency = 'EUR'): string {
  if (price === null) return 'Custom'
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(price)
}

// Format date for display
export function formatPeriodEnd(dateString: string | null): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
