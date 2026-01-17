import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import * as tasksApi from '@/lib/api/tasks'
import type { CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types/crm'

interface UseTasksOptions {
  includeShared?: boolean
}

/**
 * Hook to fetch tasks with filters (USER-CENTRIC)
 */
export function useTasks(filters?: TaskFilters, options?: UseTasksOptions) {
  const { user } = useAuth()
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['tasks', user?.id, selectedOrg?.id, filters, options?.includeShared],
    queryFn: () => {
      if (!user) throw new Error('Not authenticated')
      return tasksApi.getUserTasks(user.id, filters, {
        includeShared: options?.includeShared,
        orgId: selectedOrg?.id
      })
    },
    enabled: !!user,
  })
}

/**
 * Hook to fetch a single task
 */
export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => {
      if (!taskId) throw new Error('Task ID is required')
      return tasksApi.getTask(taskId)
    },
    enabled: !!taskId,
  })
}

/**
 * Hook to fetch overdue tasks (USER-CENTRIC)
 */
export function useOverdueTasks(options?: UseTasksOptions) {
  const { user } = useAuth()
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['overdue-tasks', user?.id, selectedOrg?.id, options?.includeShared],
    queryFn: () => {
      if (!user) throw new Error('Not authenticated')
      return tasksApi.getOverdueTasks(user.id, {
        includeShared: options?.includeShared,
        orgId: selectedOrg?.id
      })
    },
    enabled: !!user,
  })
}

/**
 * Hook to fetch tasks due today (USER-CENTRIC)
 */
export function useTasksDueToday(options?: UseTasksOptions) {
  const { user } = useAuth()
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['tasks-due-today', user?.id, selectedOrg?.id, options?.includeShared],
    queryFn: () => {
      if (!user) throw new Error('Not authenticated')
      return tasksApi.getTasksDueToday(user.id, {
        includeShared: options?.includeShared,
        orgId: selectedOrg?.id
      })
    },
    enabled: !!user,
  })
}

/**
 * Hook to create a new task (USER-CENTRIC)
 */
export function useCreateTask() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTaskInput) => {
      return tasksApi.createTask({ ...input, orgId: selectedOrg?.id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] })
    },
  })
}

/**
 * Hook to update a task (USER-CENTRIC)
 */
export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      tasksApi.updateTask(taskId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task', data.id] })
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] })
    },
  })
}

/**
 * Hook to delete a task (USER-CENTRIC)
 */
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] })
    },
  })
}
