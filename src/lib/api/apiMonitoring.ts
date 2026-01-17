import { supabase } from '@/lib/supabaseClient'

export interface ApiUsageStats {
  total_calls: number
  successful_calls: number
  failed_calls: number
  total_leads_requested: number
  total_leads_generated: number
  avg_duration_ms: number
  calls_by_method: Record<string, number>
  calls_by_day: Record<string, number>
}

export interface RateLimitInfo {
  leads_generated: number
  hour_start: string
  limit_remaining: number
}

export interface ApiUsageLog {
  id: string
  organization_id: string
  user_id: string
  endpoint: string
  method: string
  leads_requested: number
  leads_generated: number
  success: boolean
  error_message?: string
  duration_ms?: number
  ip_address?: string
  user_agent?: string
  created_at: string
}

/**
 * Get API usage statistics for current organization
 */
export async function getApiUsageStats(
  organizationId: string,
  days: number = 7
): Promise<ApiUsageStats> {
  const { data, error } = await supabase.rpc('get_api_usage_stats', {
    p_org_id: organizationId,
    p_days: days
  })

  if (error) {
    console.error('Error fetching API usage stats:', error)
    throw new Error(error.message)
  }

  return data?.[0] || {
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    total_leads_requested: 0,
    total_leads_generated: 0,
    avg_duration_ms: 0,
    calls_by_method: {},
    calls_by_day: {}
  }
}

/**
 * Get current hourly rate limit info for user
 */
export async function getRateLimitInfo(
  userId: string,
  organizationId: string
): Promise<RateLimitInfo> {
  const { data, error } = await supabase.rpc('get_hourly_rate_limit', {
    p_user_id: userId,
    p_org_id: organizationId
  })

  if (error) {
    console.error('Error fetching rate limit:', error)
    throw new Error(error.message)
  }

  return data?.[0] || {
    leads_generated: 0,
    hour_start: new Date().toISOString(),
    limit_remaining: 50
  }
}

/**
 * Get recent API usage logs
 */
export async function getApiUsageLogs(
  organizationId: string,
  limit: number = 50
): Promise<ApiUsageLog[]> {
  const { data, error } = await supabase
    .from('api_usage_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching API usage logs:', error)
    throw new Error(error.message)
  }

  return data || []
}
