// src/lib/api/usageLimits.ts
// Daily usage limits tracking and enforcement

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

/**
 * Get current daily usage for an organization
 */
export async function getDailyUsage(orgId: string): Promise<DailyUsage> {
  const { data, error } = await supabase.rpc('get_daily_usage', {
    p_org_id: orgId
  })

  if (error) {
    console.error('Error fetching daily usage:', error)
    throw new Error('Failed to fetch usage limits')
  }

  if (!data || data.length === 0) {
    throw new Error('No usage data found for organization')
  }

  const usage = data[0]
  
  return {
    templatesGenerated: usage.templates_generated,
    emailsSent: usage.emails_sent,
    templateLimit: usage.template_limit,
    emailLimit: usage.email_limit,
    templatesRemaining: usage.templates_remaining,
    emailsRemaining: usage.emails_remaining,
  }
}

/**
 * Check if an action is allowed (under limit)
 */
export async function checkUsageLimit(
  orgId: string,
  actionType: 'template' | 'email'
): Promise<{ allowed: boolean; usage?: DailyUsage; error?: UsageLimitError }> {
  // Get current usage
  const usage = await getDailyUsage(orgId)
  
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
 * Increment usage counter (only if under limit)
 */
export async function incrementUsage(
  orgId: string,
  actionType: 'template' | 'email',
  amount: number = 1
): Promise<{ success: boolean; error?: UsageLimitError }> {
  const { data, error } = await supabase.rpc('increment_usage', {
    p_org_id: orgId,
    p_action_type: actionType,
    p_amount: amount
  })

  if (error) {
    console.error('Error incrementing usage:', error)
    throw new Error('Failed to update usage counter')
  }

  // If data is false, limit was reached
  if (data === false) {
    const usage = await getDailyUsage(orgId)
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    return {
      success: false,
      error: {
        limitType: actionType,
        current: actionType === 'template' ? usage.templatesGenerated : usage.emailsSent,
        limit: actionType === 'template' ? usage.templateLimit : usage.emailLimit,
        resetsAt: tomorrow,
      }
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
