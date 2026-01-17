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

// Default limits for users without organization
const DEFAULT_TEMPLATE_LIMIT = 10
const DEFAULT_EMAIL_LIMIT = 50

/**
 * Get current daily usage for a user (USER-CENTRIC)
 * Falls back to user-based limits if no org
 */
export async function getDailyUsage(options?: { orgId?: string }): Promise<DailyUsage> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Try to get usage from database
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', user.id)
    .eq('usage_date', today)

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('Error fetching daily usage:', error)
    throw new Error('Failed to fetch usage limits')
  }

  // Get limits from org if available, otherwise use defaults
  let templateLimit = DEFAULT_TEMPLATE_LIMIT
  let emailLimit = DEFAULT_EMAIL_LIMIT

  if (options?.orgId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('daily_template_limit, daily_email_limit')
      .eq('id', options.orgId)
      .single()

    if (orgData) {
      templateLimit = orgData.daily_template_limit || DEFAULT_TEMPLATE_LIMIT
      emailLimit = orgData.daily_email_limit || DEFAULT_EMAIL_LIMIT
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
 * Check if an action is allowed (under limit) - USER-CENTRIC
 */
export async function checkUsageLimit(
  actionType: 'template' | 'email',
  options?: { orgId?: string }
): Promise<{ allowed: boolean; usage?: DailyUsage; error?: UsageLimitError }> {
  // Get current usage
  const usage = await getDailyUsage(options)

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
 * Increment usage counter (USER-CENTRIC)
 */
export async function incrementUsage(
  actionType: 'template' | 'email',
  amount: number = 1,
  options?: { orgId?: string }
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
        org_id: options?.orgId || null,
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
