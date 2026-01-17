import { useQuery } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import * as analyticsApi from '@/lib/api/analytics'
import type {
  DateRange,
  TimeInterval,
  LeadFunnelMetric,
  LeadsOverTimeData,
  EmailMetricsData,
  TaskMetricsData,
  ActivityMetrics,
  LeadSourceData,
  ConversionFunnelData,
  AnalyticsSummary
} from '@/lib/api/analytics'

export type { DateRange, TimeInterval }

/**
 * Hook to get analytics summary
 */
export function useAnalyticsSummary(dateRange?: DateRange) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary', selectedOrg?.id, dateRange],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getAnalyticsSummary(selectedOrg.id, dateRange)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to get lead funnel metrics
 */
export function useLeadFunnelMetrics(dateRange?: DateRange) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<LeadFunnelMetric[]>({
    queryKey: ['lead-funnel-metrics', selectedOrg?.id, dateRange],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getLeadFunnelMetrics(selectedOrg.id, dateRange)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get leads over time data
 */
export function useLeadsOverTime(
  dateRange?: DateRange,
  interval: TimeInterval = 'day'
) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<LeadsOverTimeData[]>({
    queryKey: ['leads-over-time', selectedOrg?.id, dateRange, interval],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getLeadsOverTime(selectedOrg.id, dateRange, interval)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get email metrics over time
 */
export function useEmailMetricsOverTime(
  dateRange?: DateRange,
  interval: TimeInterval = 'day'
) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<EmailMetricsData[]>({
    queryKey: ['email-metrics-over-time', selectedOrg?.id, dateRange, interval],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getEmailMetricsOverTime(selectedOrg.id, dateRange, interval)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get task metrics over time
 */
export function useTaskMetricsOverTime(
  dateRange?: DateRange,
  interval: TimeInterval = 'day'
) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<TaskMetricsData[]>({
    queryKey: ['task-metrics-over-time', selectedOrg?.id, dateRange, interval],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getTaskMetricsOverTime(selectedOrg.id, dateRange, interval)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get activity metrics
 */
export function useActivityMetrics(dateRange?: DateRange) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<ActivityMetrics>({
    queryKey: ['activity-metrics', selectedOrg?.id, dateRange],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getActivityMetrics(selectedOrg.id, dateRange)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get lead source distribution
 */
export function useLeadSourceDistribution(dateRange?: DateRange) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<LeadSourceData[]>({
    queryKey: ['lead-source-distribution', selectedOrg?.id, dateRange],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getLeadSourceDistribution(selectedOrg.id, dateRange)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get conversion funnel data
 */
export function useConversionFunnel(dateRange?: DateRange) {
  const { selectedOrg } = useOrganization()
  
  return useQuery<ConversionFunnelData[]>({
    queryKey: ['conversion-funnel', selectedOrg?.id, dateRange],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return analyticsApi.getConversionFunnel(selectedOrg.id, dateRange)
    },
    enabled: !!selectedOrg,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Get default date range helper
 */
export function useDefaultDateRange() {
  return analyticsApi.getDefaultDateRange()
}
