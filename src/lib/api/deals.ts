import { supabase } from '../supabaseClient'
import type {
  Deal,
  DealWithTaskCount,
  CreateDealInput,
  UpdateDealInput,
  DealFilters,
  PaginationParams,
  PaginatedResponse,
  DealStage
} from '@/types/crm'

/**
 * Fetch all deals for the current organization with optional filters
 */
export async function getDeals(
  orgId: string,
  filters?: DealFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Deal>> {
  const page = pagination?.page || 1
  const limit = pagination?.limit || 50
  const offset = (page - 1) * limit

  let query = supabase
    .from('deals')
    .select(`
      *,
      lead:lead_id(id, name, email, company)
    `, { count: 'exact' })
    .eq('org_id', orgId)

  // Apply filters
  if (filters?.stage) {
    if (Array.isArray(filters.stage)) {
      query = query.in('stage', filters.stage)
    } else {
      query = query.eq('stage', filters.stage)
    }
  }

  if (filters?.value_min !== undefined) {
    query = query.gte('value', filters.value_min)
  }

  if (filters?.value_max !== undefined) {
    query = query.lte('value', filters.value_max)
  }

  if (filters?.expected_close_before) {
    query = query.lte('expected_close_date', filters.expected_close_before)
  }

  if (filters?.expected_close_after) {
    query = query.gte('expected_close_date', filters.expected_close_after)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`)
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
 * Fetch a single deal by ID
 */
export async function getDeal(dealId: string): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      lead:lead_id(id, name, email, company)
    `)
    .eq('id', dealId)
    .single()

  if (error) throw error
  if (!data) throw new Error('Deal not found')

  return data
}

/**
 * Create a new deal
 */
export async function createDeal(
  orgId: string,
  input: CreateDealInput
): Promise<Deal> {
  const { data: userData } = await supabase.auth.getUser()

  const dealData = {
    org_id: orgId,
    ...input,
    currency: input.currency || 'USD',
    stage: input.stage || 'lead',
    created_by: userData?.user?.id
  }

  const { data, error } = await supabase
    .from('deals')
    .insert(dealData)
    .select(`
      *,
      lead:lead_id(id, name, email, company)
    `)
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create deal')

  return data
}

/**
 * Update an existing deal
 */
export async function updateDeal(
  dealId: string,
  input: UpdateDealInput
): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .update(input)
    .eq('id', dealId)
    .select('*')
    .single()

  if (error) throw error
  if (!data) throw new Error('Deal not found')

  return data
}

/**
 * Update deal stage (critical for drag-and-drop)
 */
export async function updateDealStage(
  dealId: string,
  newStage: DealStage
): Promise<Deal> {
  const updates: any = { stage: newStage }

  // Auto-set actual_close_date when closing
  if (newStage === 'closed_won' || newStage === 'closed_lost') {
    updates.actual_close_date = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', dealId)
    .select('*')
    .single()

  if (error) throw error
  if (!data) throw new Error('Deal not found')

  return data
}

/**
 * Delete a deal
 */
export async function deleteDeal(dealId: string): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', dealId)

  if (error) throw error
}

/**
 * Get deals grouped by stage for pipeline view
 */
export async function getDealsGroupedByStage(
  orgId: string,
  filters?: Omit<DealFilters, 'stage'>
): Promise<Record<DealStage, DealWithTaskCount[]>> {
  // Fetch all deals for the org
  let query = supabase
    .from('deals')
    .select(`
      *,
      lead:lead_id(id, name, email, company)
    `)
    .eq('org_id', orgId)

  // Apply filters (excluding stage since we want all stages)
  if (filters?.value_min !== undefined) {
    query = query.gte('value', filters.value_min)
  }

  if (filters?.value_max !== undefined) {
    query = query.lte('value', filters.value_max)
  }

  if (filters?.expected_close_before) {
    query = query.lte('expected_close_date', filters.expected_close_before)
  }

  if (filters?.expected_close_after) {
    query = query.gte('expected_close_date', filters.expected_close_after)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`)
  }

  const { data: deals, error } = await query

  if (error) throw error

  // Fetch task counts for all deals
  const dealIds = (deals || []).map(d => d.id)
  let tasksData: any[] = []

  if (dealIds.length > 0) {
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, lead_id, status')
      .in('lead_id', (deals || []).map(d => d.lead_id))

    if (!tasksError && tasks) {
      tasksData = tasks
    }
  }

  // Map task counts to deals by lead_id
  const dealsWithTaskCounts: DealWithTaskCount[] = (deals || []).map(deal => {
    const dealTasks = tasksData.filter(t => t.lead_id === deal.lead_id)
    return {
      ...deal,
      task_count: dealTasks.length,
      pending_task_count: dealTasks.filter(
        t => t.status === 'pending' || t.status === 'in_progress'
      ).length
    }
  })

  // Group by stage
  const stages: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
  const grouped = stages.reduce((acc, stage) => {
    acc[stage] = dealsWithTaskCounts.filter(d => d.stage === stage)
    return acc
  }, {} as Record<DealStage, DealWithTaskCount[]>)

  return grouped
}

/**
 * Get deal statistics by stage
 */
export async function getDealStats(orgId: string): Promise<{
  byStage: Record<DealStage, { count: number; totalValue: number }>
  totalCount: number
  totalValue: number
  averageValue: number
}> {
  const { data: deals, error } = await supabase
    .from('deals')
    .select('stage, value')
    .eq('org_id', orgId)

  if (error) throw error

  const stages: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

  const byStage = stages.reduce((acc, stage) => {
    const stageDeals = (deals || []).filter(d => d.stage === stage)
    acc[stage] = {
      count: stageDeals.length,
      totalValue: stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)
    }
    return acc
  }, {} as Record<DealStage, { count: number; totalValue: number }>)

  const totalCount = (deals || []).length
  const totalValue = (deals || []).reduce((sum, d) => sum + (d.value || 0), 0)
  const averageValue = totalCount > 0 ? totalValue / totalCount : 0

  return {
    byStage,
    totalCount,
    totalValue,
    averageValue
  }
}
