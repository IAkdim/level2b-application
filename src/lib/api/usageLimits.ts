// src/lib/api/usageLimits.ts
// Daily usage limits tracking and enforcement (USER-CENTRIC)

import { supabase } from '@/lib/supabaseClient'

export interface DailyUsage {
  templatesGenerated: number
  emailsSent: number
  templateLimit: number
  emailLimit: number
  templatesRemaining: number
  emailsRemaining: number
}

export interface UsageLimitError {
  limitType: 'template' | 'email'
  current: number
  limit: number
  resetsAt: Date
}

// Default limits for free users
const DEFAULT_TEMPLATE_LIMIT = 10
const DEFAULT_EMAIL_LIMIT = 50

/**
 * Get current daily usage for a user
 * Reads limits from subscriptions table
 */
export async function getDailyUsage(): Promise<DailyUsage> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Try to get usage from database
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', user.id)
    .eq('usage_date', today)
    .maybeSingle()

  if (error) {
    console.error('Error fetching daily usage:', error)
    throw new Error('Failed to fetch usage limits')
  }

  // Get limits from subscription if available, otherwise use defaults
  let templateLimit = DEFAULT_TEMPLATE_LIMIT
  let emailLimit = DEFAULT_EMAIL_LIMIT

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_tier')
    .eq('user_id', user.id)
    .maybeSingle()

  if (subscription) {
    // Set limits based on plan tier
    switch (subscription.plan_tier) {
      case 'starter':
        templateLimit = 10
        emailLimit = 50
        break
      case 'pro':
        templateLimit = 100
        emailLimit = 500
        break
      case 'enterprise':
        templateLimit = 1000
        emailLimit = 5000
        break
    }
  }

  const usage = data || { templates_generated: 0, emails_sent: 0 }

  return {
    templatesGenerated: usage.templates_generated || 0,
    emailsSent: usage.emails_sent || 0,
    templateLimit,
    emailLimit,
    templatesRemaining: Math.max(0, templateLimit - (usage.templates_generated || 0)),
    emailsRemaining: Math.max(0, emailLimit - (usage.emails_sent || 0)),
  }
}

/**
 * Check if an action is allowed (under limit)
 */
export async function checkUsageLimit(
  actionType: 'template' | 'email'
): Promise<{ allowed: boolean; usage?: DailyUsage; error?: UsageLimitError }> {
  // Get current usage
  const usage = await getDailyUsage()

  // Check limit
  const isUnderLimit = actionType === 'template'
    ? usage.templatesRemaining > 0
    : usage.emailsRemaining > 0

  if (!isUnderLimit) {
    // Calculate reset time (midnight)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    return {
      allowed: false,
      usage,
      error: {
        limitType: actionType,
        current: actionType === 'template' ? usage.templatesGenerated : usage.emailsSent,
        limit: actionType === 'template' ? usage.templateLimit : usage.emailLimit,
        resetsAt: tomorrow,
      }
    }
  }

  return {
    allowed: true,
    usage,
  }
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  actionType: 'template' | 'email',
  amount: number = 1
): Promise<{ success: boolean; error?: UsageLimitError }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const today = new Date().toISOString().split('T')[0]

  // Upsert the usage record
  const { data: existingUsage } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', user.id)
    .eq('usage_date', today)
    .maybeSingle()

  const column = actionType === 'template' ? 'templates_generated' : 'emails_sent'
  const currentValue = existingUsage?.[column] || 0

  if (existingUsage) {
    // Update existing record
    const { error } = await supabase
      .from('daily_usage')
      .update({ [column]: currentValue + amount })
      .eq('id', existingUsage.id)

    if (error) {
      console.error('Error incrementing usage:', error)
      throw new Error('Failed to update usage counter')
    }
  } else {
    // Insert new record
    const { error } = await supabase
      .from('daily_usage')
      .insert({
        user_id: user.id,
        usage_date: today,
        [column]: amount,
      })

    if (error) {
      console.error('Error creating usage record:', error)
      throw new Error('Failed to create usage counter')
    }
  }

  return { success: true }
}

/**
 * Format usage limit error message
 */
export function formatUsageLimitError(error: UsageLimitError): string {
  const type = error.limitType === 'template' ? 'template generation' : 'email sending'
  const hours = Math.ceil((error.resetsAt.getTime() - Date.now()) / (1000 * 60 * 60))

  return `Daily ${type} limit reached (${error.current}/${error.limit}). Limit resets in ${hours} hours.`
}

/**
 * Get time until limit reset
 * Returns formatted string like "5h 23m"
 */
export function getTimeUntilReset(): string {
  const now = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  const diffMs = tomorrow.getTime() - now.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}
