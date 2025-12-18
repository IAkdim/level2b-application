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
  const limit = pagination?.limit || 500
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
    if (Array.isArray(filters.sentiment)) {
      query = query.in('sentiment', filters.sentiment)
    } else {
      query = query.eq('sentiment', filters.sentiment)
    }
  }

  // Source filter - check if lead's source array contains ANY of the filter tags
  if (filters?.source && filters.source.length > 0) {
    query = query.overlaps('source', filters.source)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`)
  }

  // Apply sorting
  const sortBy = filters?.sortBy || 'created_at'
  const sortOrder = filters?.sortOrder || 'desc'
  const ascending = sortOrder === 'asc'

  // Apply pagination and ordering
  query = query
    .order(sortBy, { ascending })
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
 * Update lead status
 */
export async function updateLeadStatus(leadId: string, status: Lead['status']): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Lead not found')

  return data
}

/**
 * Get all unique source tags for an organization
 */
export async function getUniqueSources(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('source')
    .eq('org_id', orgId)
    .not('source', 'is', null)

  if (error) throw error

  // Flatten all source arrays and get unique values
  const allSources = data?.flatMap(lead => lead.source || []) || []
  const uniqueSources = Array.from(new Set(allSources)).sort()

  return uniqueSources
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

  const byStatus = {
    new: 0,
    contacted: 0,
    replied: 0,
    meeting_scheduled: 0,
    closed: 0,
    lost: 0
  }

  data?.forEach(lead => {
    if (lead.status in byStatus) {
      byStatus[lead.status as keyof typeof byStatus]++
    }
  })

  return {
    total: data?.length || 0,
    by_status: byStatus
  }
}

/**
 * Check which emails already exist in the organization
 */
export async function checkExistingEmails(
  orgId: string,
  emails: string[]
): Promise<Map<string, string>> {
  if (emails.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('leads')
    .select('id, email')
    .eq('org_id', orgId)
    .in('email', emails)

  if (error) throw error

  // Return map of email -> lead id
  const existingEmails = new Map<string, string>()
  data?.forEach(lead => {
    existingEmails.set(lead.email.toLowerCase(), lead.id)
  })

  return existingEmails
}

/**
 * Create or update a lead (upsert by email within organization)
 */
export async function upsertLead(
  orgId: string,
  input: CreateLeadInput,
  existingLeadId?: string
): Promise<{ lead: Lead; wasUpdate: boolean; oldLead?: Lead }> {
  // If we have an existing lead ID, update it
  if (existingLeadId) {
    // First, fetch the old lead data for comparison
    const { data: oldData, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', existingLeadId)
      .single()

    if (fetchError) throw fetchError

    // Then update
    const { data, error } = await supabase
      .from('leads')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingLeadId)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Failed to update lead')

    return { lead: data, wasUpdate: true, oldLead: oldData }
  }

  // Otherwise, create new lead
  const { data, error } = await supabase
    .from('leads')
    .insert({
      org_id: orgId,
      ...input,
      status: input.status || 'new',
    })
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create lead')

  return { lead: data, wasUpdate: false }
}
