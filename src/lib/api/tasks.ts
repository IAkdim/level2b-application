import { supabase } from '../supabaseClient'
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types/crm'

/**
 * Fetch tasks with optional filters
 */
export async function getUserTasks(
  userId: string,
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
    .eq('user_id', userId)

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
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      ...input,
      status: input.status || 'pending',
      priority: input.priority || 'medium',
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
  const { data, error } = await supabase
    .from('tasks')
    .update(input)
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
 * Mark a task as completed
 */
export async function completeTask(taskId: string): Promise<Task> {
  return updateTask(taskId, {
    status: 'completed',
    completed_at: new Date().toISOString()
  })
}
