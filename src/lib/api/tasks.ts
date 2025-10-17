import { supabase } from '../supabaseClient'
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types/crm'

/**
 * Fetch tasks with optional filters
 */
export async function getTasks(
  orgId: string,
  filters?: TaskFilters
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
    .eq('org_id', orgId)

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
 * Create a new task
 */
export async function createTask(
  orgId: string,
  input: CreateTaskInput
): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      org_id: orgId,
      ...input,
      status: input.status || 'pending',
      priority: input.priority || 'medium',
      created_by: user?.id
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
 * Get overdue tasks for an organization
 */
export async function getOverdueTasks(orgId: string): Promise<Task[]> {
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
    .eq('org_id', orgId)
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })

  if (error) throw error

  return data || []
}

/**
 * Get tasks due today for an organization
 */
export async function getTasksDueToday(orgId: string): Promise<Task[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

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
    .eq('org_id', orgId)
    .in('status', ['pending', 'in_progress'])
    .gte('due_date', today.toISOString())
    .lt('due_date', tomorrow.toISOString())
    .order('due_date', { ascending: true })

  if (error) throw error

  return data || []
}
