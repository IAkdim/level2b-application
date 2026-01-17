import { supabase } from '../supabaseClient'
import { rateLimiter } from './rateLimiter'
import type {
  Lead,
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilters,
  PaginationParams,
  PaginatedResponse
} from '@/types/crm'

interface UserCentricOptions {
  includeShared?: boolean
  orgId?: string
}

/**
 * Build the base query for leads based on user-centric or org-centric access
 */
function buildLeadsQuery(
  userId: string,
  options?: UserCentricOptions
) {
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })

  if (options?.includeShared && options?.orgId) {
    // User's own leads + shared with their org
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    // Only user's own leads
    query = query.eq('user_id', userId)
  }

  return query
}

/**
 * Fetch all leads for the current user with optional filters (USER-CENTRIC)
 */
export async function getUserLeads(
  userId: string,
  filters?: LeadFilters,
  pagination?: PaginationParams,
  options?: UserCentricOptions
): Promise<PaginatedResponse<Lead>> {
  const page = pagination?.page || 1
  const limit = pagination?.limit || 50
  const offset = (page - 1) * limit

  let query = buildLeadsQuery(userId, options)

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
 * @deprecated Use getUserLeads instead - this function is for backward compatibility
 * Fetch all leads for the current organization with optional filters
 */
export async function getLeads(
  orgId: string,
  filters?: LeadFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Lead>> {
  // Rate limit check
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const rateCheck = await rateLimiter.checkLimit('database', session.user.id)
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message || 'Too many requests. Please try again later.')
    }
  }

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
 * Create a new lead (USER-CENTRIC)
 * Always sets user_id to current user. org_id is optional for sharing.
 */
export async function createLead(
  input: CreateLeadInput & { orgId?: string }
): Promise<Lead> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { orgId, ...leadData } = input

  const { data, error } = await supabase
    .from('leads')
    .insert({
      user_id: user.id,
      org_id: orgId || null,
      ...leadData,
      status: leadData.status || 'new'
    })
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create lead')

  return data
}

/**
 * @deprecated Use createLead with orgId in input instead
 */
export async function createLeadLegacy(
  orgId: string,
  input: CreateLeadInput
): Promise<Lead> {
  return createLead({ ...input, orgId })
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
 * Get all unique source tags for a user (USER-CENTRIC)
 */
export async function getUserUniqueSources(
  userId: string,
  options?: UserCentricOptions
): Promise<string[]> {
  let query = supabase
    .from('leads')
    .select('source')
    .not('source', 'is', null)

  if (options?.includeShared && options?.orgId) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) throw error

  // Flatten all source arrays and get unique values
  const allSources = data?.flatMap(lead => lead.source || []) || []
  const uniqueSources = Array.from(new Set(allSources)).sort()

  return uniqueSources
}

/**
 * @deprecated Use getUserUniqueSources instead
 */
export async function getUniqueSources(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('source')
    .eq('org_id', orgId)
    .not('source', 'is', null)

  if (error) throw error

  const allSources = data?.flatMap(lead => lead.source || []) || []
  const uniqueSources = Array.from(new Set(allSources)).sort()

  return uniqueSources
}

/**
 * Get lead statistics for a user (USER-CENTRIC)
 */
export async function getUserLeadStats(
  userId: string,
  options?: UserCentricOptions
) {
  let query = supabase
    .from('leads')
    .select('status')

  if (options?.includeShared && options?.orgId) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

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
 * @deprecated Use getUserLeadStats instead
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
 * Check which emails already exist for a user (USER-CENTRIC)
 */
export async function checkUserExistingEmails(
  userId: string,
  emails: string[],
  options?: UserCentricOptions
): Promise<Map<string, string>> {
  if (emails.length === 0) {
    return new Map()
  }

  let query = supabase
    .from('leads')
    .select('id, email')
    .in('email', emails)

  if (options?.includeShared && options?.orgId) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) throw error

  const existingEmails = new Map<string, string>()
  data?.forEach(lead => {
    existingEmails.set(lead.email.toLowerCase(), lead.id)
  })

  return existingEmails
}

/**
 * @deprecated Use checkUserExistingEmails instead
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

  const existingEmails = new Map<string, string>()
  data?.forEach(lead => {
    existingEmails.set(lead.email.toLowerCase(), lead.id)
  })

  return existingEmails
}

/**
 * Create or update a lead (USER-CENTRIC upsert by email)
 */
export async function upsertLead(
  input: CreateLeadInput & { orgId?: string },
  existingLeadId?: string
): Promise<{ lead: Lead; wasUpdate: boolean; oldLead?: Lead }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { orgId, ...leadData } = input

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
        ...leadData,
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
      user_id: user.id,
      org_id: orgId || null,
      ...leadData,
      status: leadData.status || 'new',
    })
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create lead')

  return { lead: data, wasUpdate: false }
}

/**
 * @deprecated Use upsertLead with orgId in input instead
 */
export async function upsertLeadLegacy(
  orgId: string,
  input: CreateLeadInput,
  existingLeadId?: string
): Promise<{ lead: Lead; wasUpdate: boolean; oldLead?: Lead }> {
  return upsertLead({ ...input, orgId }, existingLeadId)
}
