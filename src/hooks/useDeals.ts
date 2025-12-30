import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import * as dealsApi from '@/lib/api/deals'
import type {
  DealWithTaskCount,
  CreateDealInput,
  UpdateDealInput,
  DealFilters,
  PaginationParams,
  DealStage
} from '@/types/crm'
import { toast } from 'sonner'

/**
 * Hook to fetch paginated deals with filters
 */
export function useDeals(filters?: DealFilters, pagination?: PaginationParams) {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['deals', selectedOrg?.id, filters, pagination],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return dealsApi.getDeals(selectedOrg.id, filters, pagination)
    },
    enabled: !!selectedOrg,
  })
}

/**
 * Hook to fetch deals grouped by stage (for pipeline view)
 */
export function useDealsGroupedByStage(filters?: Omit<DealFilters, 'stage'>) {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['deals-grouped', selectedOrg?.id, filters],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return dealsApi.getDealsGroupedByStage(selectedOrg.id, filters)
    },
    enabled: !!selectedOrg,
    staleTime: 30000, // 30 seconds - pipeline doesn't need instant updates
  })
}

/**
 * Hook to fetch a single deal by ID
 */
export function useDeal(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => {
      if (!dealId) throw new Error('Deal ID is required')
      return dealsApi.getDeal(dealId)
    },
    enabled: !!dealId,
  })
}

/**
 * Hook to fetch deal statistics
 */
export function useDealStats() {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['deal-stats', selectedOrg?.id],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return dealsApi.getDealStats(selectedOrg.id)
    },
    enabled: !!selectedOrg,
  })
}

/**
 * Hook to create a new deal
 */
export function useCreateDeal() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateDealInput) => {
      if (!selectedOrg) throw new Error('No organization selected')
      return dealsApi.createDeal(selectedOrg.id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deals-grouped', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deal-stats', selectedOrg?.id] })
      toast.success('Deal created successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create deal')
    },
  })
}

/**
 * Hook to update an existing deal
 */
export function useUpdateDeal() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ dealId, input }: { dealId: string; input: UpdateDealInput }) =>
      dealsApi.updateDeal(dealId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deals-grouped', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deal-stats', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deal', data.id] })
      toast.success('Deal updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update deal')
    },
  })
}

/**
 * Hook to update deal stage (for drag-and-drop)
 */
export function useUpdateDealStage() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: DealStage }) =>
      dealsApi.updateDealStage(dealId, stage),

    // Refetch after mutation completes
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deals-grouped', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deal-stats', selectedOrg?.id] })
    },

    onError: (err: any) => {
      toast.error(err.message || 'Failed to update deal stage')
    },
  })
}

/**
 * Hook to delete a deal
 */
export function useDeleteDeal() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dealId: string) => dealsApi.deleteDeal(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deals-grouped', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['deal-stats', selectedOrg?.id] })
      toast.success('Deal deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete deal')
    },
  })
}
