import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import * as tasksApi from '@/lib/api/tasks'
import type { CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types/crm'

/**
 * Hook to fetch tasks with filters
 */
export function useTasks(filters?: TaskFilters) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['tasks', user?.id, filters],
    queryFn: () => {
      if (!user) throw new Error('Not authenticated')
      return tasksApi.getUserTasks(user.id, filters)
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
 * Hook to create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

/**
 * Hook to update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      tasksApi.updateTask(taskId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task', data.id] })
    },
  })
}

/**
 * Hook to delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
