import { supabase } from '../supabaseClient'
import type { Activity, CreateActivityInput, ActivityFilters } from '@/types/crm'

/**
 * Fetch activities for a specific lead
 */
export async function getActivities(
  leadId: string,
  filters?: ActivityFilters
): Promise<Activity[]> {
  let query = supabase
    .from('activities')
    .select(`
      *,
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .eq('lead_id', leadId)

  // Apply filters
  if (filters?.type) {
    if (Array.isArray(filters.type)) {
      query = query.in('type', filters.type)
    } else {
      query = query.eq('type', filters.type)
    }
  }

  if (filters?.created_after) {
    query = query.gte('created_at', filters.created_after)
  }

  if (filters?.created_before) {
    query = query.lte('created_at', filters.created_before)
  }

  // Order by most recent first
  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error

  return data || []
}

/**
 * Create a new activity
 */
export async function createActivity(
  orgId: string,
  input: CreateActivityInput
): Promise<Activity> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('activities')
    .insert({
      org_id: orgId,
      ...input,
      created_by: user?.id
    })
    .select(`
      *,
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create activity')

  return data
}

/**
 * Update an activity
 */
export async function updateActivity(
  activityId: string,
  updates: Partial<CreateActivityInput>
): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', activityId)
    .select(`
      *,
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .single()

  if (error) throw error
  if (!data) throw new Error('Activity not found')

  return data
}

/**
 * Delete an activity
 */
export async function deleteActivity(activityId: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)

  if (error) throw error
}

/**
 * Get recent activities across all leads in an organization
 */
export async function getRecentActivities(
  orgId: string,
  limit: number = 10
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return data || []
}

/**
 * Get organization activities with advanced filtering
 * Used for the org-wide activities page
 */
export async function getOrgActivities(
  orgId: string,
  filters?: {
    type?: string[]
    userId?: string
    dateFrom?: string
    limit?: number
  }
): Promise<Activity[]> {
  let query = supabase
    .from('activities')
    .select(`
      *,
      lead:lead_id (
        id,
        name,
        email,
        company
      ),
      creator:created_by (
        id,
        full_name,
        email
      )
    `)
    .eq('org_id', orgId)

  // Apply filters
  if (filters?.type && filters.type.length > 0) {
    query = query.in('type', filters.type)
  }

  if (filters?.userId) {
    query = query.eq('created_by', filters.userId)
  }

  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }

  // Order and limit
  query = query
    .order('created_at', { ascending: false })
    .limit(filters?.limit || 50)

  const { data, error } = await query

  if (error) throw error

  return data || []
}
