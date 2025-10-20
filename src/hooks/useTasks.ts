import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import * as tasksApi from '@/lib/api/tasks'
import type { CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types/crm'

/**
 * Hook to fetch tasks with filters
 */
export function useTasks(filters?: TaskFilters) {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['tasks', selectedOrg?.id, filters],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return tasksApi.getTasks(selectedOrg.id, filters)
    },
    enabled: !!selectedOrg,
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
 * Hook to fetch overdue tasks
 */
export function useOverdueTasks() {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['overdue-tasks', selectedOrg?.id],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return tasksApi.getOverdueTasks(selectedOrg.id)
    },
    enabled: !!selectedOrg,
  })
}

/**
 * Hook to fetch tasks due today
 */
export function useTasksDueToday() {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['tasks-due-today', selectedOrg?.id],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return tasksApi.getTasksDueToday(selectedOrg.id)
    },
    enabled: !!selectedOrg,
  })
}

/**
 * Hook to create a new task
 */
export function useCreateTask() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTaskInput) => {
      if (!selectedOrg) throw new Error('No organization selected')
      return tasksApi.createTask(selectedOrg.id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today', selectedOrg?.id] })
    },
  })
}

/**
 * Hook to update a task
 */
export function useUpdateTask() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      tasksApi.updateTask(taskId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['task', data.id] })
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today', selectedOrg?.id] })
    },
  })
}

/**
 * Hook to delete a task
 */
export function useDeleteTask() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today', selectedOrg?.id] })
    },
  })
}
