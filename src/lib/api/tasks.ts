import { supabase } from '../supabaseClient'
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types/crm'

interface UserCentricOptions {
  includeShared?: boolean
  orgId?: string
}

/**
 * Fetch tasks with optional filters (USER-CENTRIC)
 */
export async function getUserTasks(
  userId: string,
  filters?: TaskFilters,
  options?: UserCentricOptions
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      lead:lead_id (
        id,
        name,
        email,
        company
      ),
      assignee:assigned_to (
        id,
        full_name,
        email
      )
    `)

  // User-centric filtering: user's own OR shared via org
  if (options?.includeShared && options?.orgId) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    query = query.eq('user_id', userId)
  }

  // Apply filters
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }

  if (filters?.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to)
  }

  if (filters?.lead_id) {
    query = query.eq('lead_id', filters.lead_id)
  }

  if (filters?.due_before) {
    query = query.lte('due_date', filters.due_before)
  }

  if (filters?.due_after) {
    query = query.gte('due_date', filters.due_after)
  }

  // Order by due date (nulls last) then created date
  query = query.order('due_date', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error

  return data || []
}

/**
 * Fetch a single task by ID
 */
export async function getTask(taskId: string): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      lead:lead_id (
        id,
        name,
        email,
        company
      ),
      assignee:assigned_to (
        id,
        full_name,
        email
      )
    `)
    .eq('id', taskId)
    .single()

  if (error) throw error
  if (!data) throw new Error('Task not found')

  return data
}

/**
 * Create a new task (USER-CENTRIC)
 */
export async function createTask(
  input: CreateTaskInput & { orgId?: string }
): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { orgId, ...taskInput } = input

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      org_id: orgId || null,
      ...taskInput,
      status: taskInput.status || 'pending',
      priority: taskInput.priority || 'medium',
      created_by: user.id
    })
    .select(`
      *,
      lead:lead_id (
        id,
        name,
        email,
        company
      ),
      assignee:assigned_to (
        id,
        full_name,
        email
      )
    `)
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create task')

  return data
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  // If marking as completed, set completed_at timestamp
  const updates = { ...input }
  if (input.status === 'completed' && !input.completed_at) {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select(`
      *,
      lead:lead_id (
        id,
        name,
        email,
        company
      ),
      assignee:assigned_to (
        id,
        full_name,
        email
      )
    `)
    .single()

  if (error) throw error
  if (!data) throw new Error('Task not found')

  return data
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw error
}

/**
 * Get overdue tasks (USER-CENTRIC)
 */
export async function getOverdueTasks(
  userId: string,
  options?: UserCentricOptions
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select(`
      *,
      lead:lead_id (
        id,
        name,
        email,
        company
      ),
      assignee:assigned_to (
        id,
        full_name,
        email
      )
    `)

  // User-centric filtering
  if (options?.includeShared && options?.orgId) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })

  if (error) throw error

  return data || []
}

/**
 * Get tasks due today (USER-CENTRIC)
 */
export async function getTasksDueToday(
  userId: string,
  options?: UserCentricOptions
): Promise<Task[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let query = supabase
    .from('tasks')
    .select(`
      *,
      lead:lead_id (
        id,
        name,
        email,
        company
      ),
      assignee:assigned_to (
        id,
        full_name,
        email
      )
    `)

  // User-centric filtering
  if (options?.includeShared && options?.orgId) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
    .in('status', ['pending', 'in_progress'])
    .gte('due_date', today.toISOString())
    .lt('due_date', tomorrow.toISOString())
    .order('due_date', { ascending: true })

  if (error) throw error

  return data || []
}
