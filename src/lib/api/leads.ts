import { supabase } from '../supabaseClient'
import type {
  Lead,
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilters,
  PaginationParams,
  PaginatedResponse
} from '@/types/crm'

/**
 * Fetch all leads for the current organization with optional filters
 */
export async function getLeads(
  orgId: string,
  filters?: LeadFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Lead>> {
  const page = pagination?.page || 1
  const limit = pagination?.limit || 50
  const offset = (page - 1) * limit

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)

  // Apply filters
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }

  if (filters?.sentiment) {
    query = query.eq('sentiment', filters.sentiment)
  }

  if (filters?.source) {
    query = query.eq('source', filters.source)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
  }

  // Apply pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
    hasMore: (count || 0) > offset + limit
  }
}

/**
 * Fetch a single lead by ID
 */
export async function getLead(leadId: string): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (error) throw error
  if (!data) throw new Error('Lead not found')

  return data
}

/**
 * Create a new lead
 */
export async function createLead(
  orgId: string,
  input: CreateLeadInput
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      org_id: orgId,
      ...input,
      status: input.status || 'new'
    })
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create lead')

  return data
}

/**
 * Update an existing lead
 */
export async function updateLead(
  leadId: string,
  input: UpdateLeadInput
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update(input)
    .eq('id', leadId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Lead not found')

  return data
}

/**
 * Delete a lead
 */
export async function deleteLead(leadId: string): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) throw error
}

/**
 * Update lead's last contact timestamp
 */
export async function updateLastContact(leadId: string): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) throw error
}

/**
 * Get lead statistics for an organization
 */
export async function getLeadStats(orgId: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('status')
    .eq('org_id', orgId)

  if (error) throw error

  const stats = {
    total: data?.length || 0,
    new: 0,
    contacted: 0,
    replied: 0,
    meeting_scheduled: 0,
    closed: 0,
    lost: 0
  }

  data?.forEach(lead => {
    if (lead.status in stats) {
      stats[lead.status as keyof typeof stats]++
    }
  })

  return stats
}
