import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
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

// Date range presets for the Analytics UI
export const DATE_RANGE_PRESETS = {
  '7d': { label: 'Last 7 days', days: 7 },
  '14d': { label: 'Last 14 days', days: 14 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  '180d': { label: 'Last 6 months', days: 180 },
  '365d': { label: 'Last year', days: 365 },
} as const

/**
 * Convert a date range preset string to a DateRange object
 */
export function getDateRangeFromPreset(preset: string): DateRange {
  const presetConfig = DATE_RANGE_PRESETS[preset as keyof typeof DATE_RANGE_PRESETS]
  const days = presetConfig?.days || 30
  
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

/**
 * Hook to get analytics summary
 */
export function useAnalyticsSummary(dateRange?: DateRange) {
  const { user } = useAuth()
  
  return useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary', user?.id, dateRange],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getAnalyticsSummary(user.id, dateRange)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to get lead funnel metrics
 */
export function useLeadFunnelMetrics(dateRange?: DateRange) {
  const { user } = useAuth()
  
  return useQuery<LeadFunnelMetric[]>({
    queryKey: ['lead-funnel-metrics', user?.id, dateRange],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getLeadFunnelMetrics(user.id, dateRange)
    },
    enabled: !!user,
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
  const { user } = useAuth()
  
  return useQuery<LeadsOverTimeData[]>({
    queryKey: ['leads-over-time', user?.id, dateRange, interval],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getLeadsOverTime(user.id, dateRange, interval)
    },
    enabled: !!user,
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
  const { user } = useAuth()
  
  return useQuery<EmailMetricsData[]>({
    queryKey: ['email-metrics-over-time', user?.id, dateRange, interval],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getEmailMetricsOverTime(user.id, dateRange, interval)
    },
    enabled: !!user,
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
  const { user } = useAuth()
  
  return useQuery<TaskMetricsData[]>({
    queryKey: ['task-metrics-over-time', user?.id, dateRange, interval],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getTaskMetricsOverTime(user.id, dateRange, interval)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get activity metrics
 */
export function useActivityMetrics(dateRange?: DateRange) {
  const { user } = useAuth()
  
  return useQuery<ActivityMetrics>({
    queryKey: ['activity-metrics', user?.id, dateRange],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getActivityMetrics(user.id, dateRange)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get lead source distribution
 */
export function useLeadSourceDistribution(dateRange?: DateRange) {
  const { user } = useAuth()
  
  return useQuery<LeadSourceData[]>({
    queryKey: ['lead-source-distribution', user?.id, dateRange],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getLeadSourceDistribution(user.id, dateRange)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get conversion funnel data
 */
export function useConversionFunnel(dateRange?: DateRange) {
  const { user } = useAuth()
  
  return useQuery<ConversionFunnelData[]>({
    queryKey: ['conversion-funnel', user?.id, dateRange],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getConversionFunnel(user.id, dateRange)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook to get detailed email open rate
 */
export function useEmailOpenRate(dateRange?: DateRange) {
  const { user } = useAuth()
  
  return useQuery<analyticsApi.EmailOpenRateData>({
    queryKey: ['email-open-rate', user?.id, dateRange],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getEmailOpenRate(user.id, dateRange)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes - opens can come in frequently
  })
}

/**
 * Hook to get campaign-level open rates
 */
export function useCampaignOpenRates(dateRange?: DateRange) {
  const { user } = useAuth()
  
  return useQuery<analyticsApi.CampaignOpenRateData[]>({
    queryKey: ['campaign-open-rates', user?.id, dateRange],
    queryFn: () => {
      if (!user) throw new Error('User not authenticated')
      return analyticsApi.getCampaignOpenRates(user.id, dateRange)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}
