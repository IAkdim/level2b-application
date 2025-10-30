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
 * Hook to fetch unique source tags
 */
export function useUniqueSources() {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['unique-sources', selectedOrg?.id],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return leadsApi.getUniqueSources(selectedOrg.id)
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

/**
 * Hook to import leads from CSV with progress tracking
 */
export function useImportLeads() {
  const { selectedOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      leads,
      onProgress,
    }: {
      leads: CreateLeadInput[]
      onProgress?: (processed: number, total: number) => void
    }) => {
      if (!selectedOrg) throw new Error('No organization selected')

      // Check for existing emails
      const emails = leads.map(lead => lead.email.toLowerCase())
      const existingEmails = await leadsApi.checkExistingEmails(selectedOrg.id, emails)

      // Helper to check if lead data actually changed
      const hasChanges = (oldLead: Lead, newData: CreateLeadInput): boolean => {
        // Compare relevant fields
        if (oldLead.name !== newData.name) return true
        if (oldLead.email !== newData.email) return true
        if ((oldLead.phone || '') !== (newData.phone || '')) return true
        if ((oldLead.company || '') !== (newData.company || '')) return true
        if ((oldLead.title || '') !== (newData.title || '')) return true
        if (oldLead.status !== newData.status) return true
        if ((oldLead.sentiment || '') !== (newData.sentiment || '')) return true
        if ((oldLead.notes || '') !== (newData.notes || '')) return true

        // Compare source arrays
        const oldSources = JSON.stringify((oldLead.source || []).sort())
        const newSources = JSON.stringify((newData.source || []).sort())
        if (oldSources !== newSources) return true

        return false
      }

      // Process leads in batches of 50
      const BATCH_SIZE = 50
      const results: Array<{
        success: boolean
        wasUpdate: boolean
        hasChanges?: boolean
        lead?: Lead
        error?: string
        input: CreateLeadInput
      }> = []

      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE)

        // Process batch sequentially (could be parallelized but may hit rate limits)
        const batchResults = await Promise.allSettled(
          batch.map(async (input) => {
            const existingLeadId = existingEmails.get(input.email.toLowerCase())
            const result = await leadsApi.upsertLead(selectedOrg.id, input, existingLeadId)
            return result
          })
        )

        // Collect results
        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const actuallyChanged = result.value.wasUpdate && result.value.oldLead
              ? hasChanges(result.value.oldLead, batch[idx])
              : true // New leads always count as changed

            results.push({
              success: true,
              wasUpdate: result.value.wasUpdate,
              hasChanges: actuallyChanged,
              lead: result.value.lead,
              input: batch[idx],
            })
          } else {
            results.push({
              success: false,
              wasUpdate: false,
              hasChanges: false,
              error: result.reason?.message || 'Unknown error',
              input: batch[idx],
            })
          }
        })

        // Update progress
        if (onProgress) {
          onProgress(Math.min(i + BATCH_SIZE, leads.length), leads.length)
        }
      }

      // Transform results into categorized arrays
      const createdLeads = results
        .filter(r => r.success && !r.wasUpdate && r.lead)
        .map(r => r.lead!)

      // Only include updated leads where data actually changed
      const updatedLeads = results
        .filter(r => r.success && r.wasUpdate && r.hasChanges && r.lead)
        .map(r => r.lead!)

      const failedLeads = results
        .filter(r => !r.success)
        .map(r => ({ lead: r.input, error: r.error || 'Unknown error' }))

      // Count skipped duplicates (no changes)
      const skippedDuplicates = results.filter(
        r => r.success && r.wasUpdate && !r.hasChanges
      ).length

      return {
        createdLeads,
        updatedLeads,
        failedLeads,
        totalCreated: createdLeads.length,
        totalUpdated: updatedLeads.length,
        totalFailed: failedLeads.length,
        totalSkipped: skippedDuplicates,
      }
    },
    onSuccess: () => {
      // Invalidate all leads queries to refetch
      queryClient.invalidateQueries({ queryKey: ['leads', selectedOrg?.id] })
      queryClient.invalidateQueries({ queryKey: ['lead-stats', selectedOrg?.id] })
    },
  })
}
