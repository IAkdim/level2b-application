import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import * as leadsApi from '@/lib/api/leads'
import type { Lead, CreateLeadInput, UpdateLeadInput, LeadFilters, PaginationParams } from '@/types/crm'

/**
 * Hook to fetch paginated leads with filters
 */
export function useLeads(filters?: LeadFilters, pagination?: PaginationParams) {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['leads', selectedOrg?.id, filters, pagination],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return leadsApi.getLeads(selectedOrg.id, filters, pagination)
    },
    enabled: !!selectedOrg,
  })
}

/**
 * Hook to fetch a single lead by ID
 */
export function useLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => {
      if (!leadId) throw new Error('Lead ID is required')
      return leadsApi.getLead(leadId)
    },
    enabled: !!leadId,
  })
}

/**
 * Hook to fetch lead statistics
 */
export function useLeadStats() {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['lead-stats', selectedOrg?.id],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return leadsApi.getLeadStats(selectedOrg.id)
    },
    enabled: !!selectedOrg,
  })
}

/**
 * Hook to create a new lead
 */
export function useCreateLead() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateLeadInput) => {
      if (!selectedOrg) throw new Error('No organization selected')
      return leadsApi.createLead(selectedOrg.id, input)
    },
    onSuccess: () => {
      // Invalidate leads queries to refetch
      queryClient.invalidateQueries({ queryKey: ['leads', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-stats', selectedOrg?.id] })
    },
  })
}

/**
 * Hook to update a lead
 */
export function useUpdateLead() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: UpdateLeadInput }) =>
      leadsApi.updateLead(leadId, input),
    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['leads', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['lead', data.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-stats', selectedOrg?.id] })
    },
  })
}

/**
 * Hook to delete a lead
 */
export function useDeleteLead() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leadId: string) => leadsApi.deleteLead(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-stats', selectedOrg?.id] })
    },
  })
}

/**
 * Hook to update lead status
 */
export function useUpdateLeadStatus() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: Lead['status'] }) =>
      leadsApi.updateLeadStatus(leadId, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['lead', data.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-stats', selectedOrg?.id] })
    },
  })
}
