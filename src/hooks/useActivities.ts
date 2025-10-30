import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import * as activitiesApi from '@/lib/api/activities'
import type { CreateActivityInput, ActivityFilters } from '@/types/crm'

/**
 * Hook to fetch activities for a specific lead
 */
export function useActivities(leadId: string | undefined, filters?: ActivityFilters) {
  return useQuery({
    queryKey: ['activities', leadId, filters],
    queryFn: () => {
      if (!leadId) throw new Error('Lead ID is required')
      return activitiesApi.getActivities(leadId, filters)
    },
    enabled: !!leadId,
  })
}

/**
 * Hook to fetch recent activities across all leads in organization
 */
export function useRecentActivities(limit: number = 10) {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['recent-activities', selectedOrg?.id, limit],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return activitiesApi.getRecentActivities(selectedOrg.id, limit)
    },
    enabled: !!selectedOrg,
  })
}

/**
 * Hook to create a new activity
 */
export function useCreateActivity() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateActivityInput) => {
      if (!selectedOrg) throw new Error('No organization selected')
      return activitiesApi.createActivity(selectedOrg.id, input)
    },
    onSuccess: (data) => {
      // Invalidate activities for this lead
      queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['recent-activities', selectedOrg?.id] })
    },
  })
}

/**
 * Hook to update an activity
 */
export function useUpdateActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ activityId, updates }: { activityId: string; updates: Partial<CreateActivityInput> }) =>
      activitiesApi.updateActivity(activityId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] })
    },
  })
}

/**
 * Hook to delete an activity
 */
export function useDeleteActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ activityId }: { activityId: string; leadId: string }) =>
      activitiesApi.deleteActivity(activityId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities', variables.leadId] })
    },
  })
}

/**
 * Hook to fetch organization-wide activities with filters
 */
export function useOrgActivities(filters?: {
  type?: string[]
  userId?: string
  dateFrom?: string
  limit?: number
}) {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['org-activities', selectedOrg?.id, filters],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return activitiesApi.getOrgActivities(selectedOrg.id, filters)
    },
    enabled: !!selectedOrg,
  })
}
