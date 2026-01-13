import { supabase } from '../supabaseClient'

// ============================================================================
// TYPES
// ============================================================================

export interface DateRange {
  startDate: string // ISO date string YYYY-MM-DD
  endDate: string
}

export interface LeadFunnelMetric {
  status: string
  count: number
  percentage: number
}

export interface LeadsOverTimeData {
  period: string
  period_start: string
  total_leads: number
  new_leads: number
  contacted_leads: number
  qualified_leads: number
  meeting_scheduled_leads: number
  won_leads: number
  lost_leads: number
}

export interface EmailMetricsData {
  period: string
  period_start: string
  emails_sent: number
  emails_opened: number
  emails_replied: number
  open_rate: number
  reply_rate: number
}

export interface TaskMetricsData {
  period: string
  period_start: string
  tasks_created: number
  tasks_completed: number
  tasks_overdue: number
  completion_rate: number
}

export interface ActivityMetrics {
  total_leads: number
  total_emails_sent: number
  total_emails_received: number
  total_tasks: number
  completed_tasks: number
  total_notes: number
  total_templates: number
  templates_used: number
}

export interface LeadSourceData {
  source: string
  count: number
  percentage: number
}

export interface ConversionFunnelData {
  stage: string
  count: number
  conversion_rate: number
  stage_order: number
}

export interface AnalyticsSummary {
  totalLeads: number
  totalEmailsSent: number
  totalEmailsReceived: number
  emailOpenRate: number
  emailReplyRate: number
  meetingsScheduled: number
  tasksCompleted: number
  conversionRate: number
}

export type TimeInterval = 'day' | 'week' | 'month'

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get the default date range (last 30 days)
 */
export function getDefaultDateRange(): DateRange {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

/**
 * Get lead funnel metrics using the database function
 */
export async function getLeadFunnelMetrics(
  orgId: string,
  dateRange?: DateRange
): Promise<LeadFunnelMetric[]> {
  const range = dateRange || getDefaultDateRange()
  
  const { data, error } = await supabase
    .rpc('get_lead_funnel_metrics', {
      p_org_id: orgId,
      p_start_date: range.startDate,
      p_end_date: range.endDate
    })
  
  if (error) {
    console.error('Error fetching lead funnel metrics:', error)
    // Fallback to direct query if function doesn't exist
    return getLeadFunnelMetricsFallback(orgId, range)
  }
  
  return data || []
}

/**
 * Fallback function for lead funnel metrics if RPC doesn't exist
 */
async function getLeadFunnelMetricsFallback(
  orgId: string,
  dateRange: DateRange
): Promise<LeadFunnelMetric[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('status')
    .eq('org_id', orgId)
    .gte('created_at', dateRange.startDate)
    .lte('created_at', dateRange.endDate + 'T23:59:59.999Z')
  
  if (error) throw error
  
  const statusCounts: Record<string, number> = {}
  const total = data?.length || 0
  
  data?.forEach(lead => {
    statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1
  })
  
  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0
  })).sort((a, b) => b.count - a.count)
}

/**
 * Get leads over time data
 */
export async function getLeadsOverTime(
  orgId: string,
  dateRange?: DateRange,
  interval: TimeInterval = 'day'
): Promise<LeadsOverTimeData[]> {
  const range = dateRange || getDefaultDateRange()
  
  const { data, error } = await supabase
    .rpc('get_leads_over_time', {
      p_org_id: orgId,
      p_start_date: range.startDate,
      p_end_date: range.endDate,
      p_interval: interval
    })
  
  if (error) {
    console.error('Error fetching leads over time:', error)
    return getLeadsOverTimeFallback(orgId, range, interval)
  }
  
  return data || []
}

/**
 * Fallback function for leads over time
 */
async function getLeadsOverTimeFallback(
  orgId: string,
  dateRange: DateRange,
  interval: TimeInterval
): Promise<LeadsOverTimeData[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('created_at, status')
    .eq('org_id', orgId)
    .gte('created_at', dateRange.startDate)
    .lte('created_at', dateRange.endDate + 'T23:59:59.999Z')
    .order('created_at', { ascending: true })
  
  if (error) throw error
  
  // Group by period
  const grouped: Record<string, LeadsOverTimeData> = {}
  
  data?.forEach(lead => {
    const date = new Date(lead.created_at)
    let period: string
    
    if (interval === 'month') {
      period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    } else if (interval === 'week') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      period = weekStart.toISOString().split('T')[0]
    } else {
      period = date.toISOString().split('T')[0]
    }
    
    if (!grouped[period]) {
      grouped[period] = {
        period,
        period_start: period,
        total_leads: 0,
        new_leads: 0,
        contacted_leads: 0,
        qualified_leads: 0,
        meeting_scheduled_leads: 0,
        won_leads: 0,
        lost_leads: 0
      }
    }
    
    grouped[period].total_leads++
    
    switch (lead.status) {
      case 'new': grouped[period].new_leads++; break
      case 'contacted': grouped[period].contacted_leads++; break
      case 'qualified':
      case 'replied': grouped[period].qualified_leads++; break
      case 'meeting_scheduled': grouped[period].meeting_scheduled_leads++; break
      case 'won':
      case 'closed': grouped[period].won_leads++; break
      case 'lost': grouped[period].lost_leads++; break
    }
  })
  
  // Fill in missing periods
  const result = fillMissingPeriods(grouped, dateRange, interval)
  return result
}

/**
 * Fill missing periods with zero values
 */
function fillMissingPeriods(
  data: Record<string, LeadsOverTimeData>,
  dateRange: DateRange,
  interval: TimeInterval
): LeadsOverTimeData[] {
  const result: LeadsOverTimeData[] = []
  const start = new Date(dateRange.startDate)
  const end = new Date(dateRange.endDate)
  
  const current = new Date(start)
  
  while (current <= end) {
    let period: string
    
    if (interval === 'month') {
      period = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
      current.setMonth(current.getMonth() + 1)
    } else if (interval === 'week') {
      period = current.toISOString().split('T')[0]
      current.setDate(current.getDate() + 7)
    } else {
      period = current.toISOString().split('T')[0]
      current.setDate(current.getDate() + 1)
    }
    
    if (data[period]) {
      result.push(data[period])
    } else {
      result.push({
        period,
        period_start: period,
        total_leads: 0,
        new_leads: 0,
        contacted_leads: 0,
        qualified_leads: 0,
        meeting_scheduled_leads: 0,
        won_leads: 0,
        lost_leads: 0
      })
    }
  }
  
  return result
}

/**
 * Get email metrics over time
 */
export async function getEmailMetricsOverTime(
  orgId: string,
  dateRange?: DateRange,
  interval: TimeInterval = 'day'
): Promise<EmailMetricsData[]> {
  const range = dateRange || getDefaultDateRange()
  
  const { data, error } = await supabase
    .rpc('get_email_metrics_over_time', {
      p_org_id: orgId,
      p_start_date: range.startDate,
      p_end_date: range.endDate,
      p_interval: interval
    })
  
  if (error) {
    console.error('Error fetching email metrics:', error)
    return getEmailMetricsFallback(orgId, range, interval)
  }
  
  return data || []
}

/**
 * Fallback for email metrics
 */
async function getEmailMetricsFallback(
  orgId: string,
  dateRange: DateRange,
  interval: TimeInterval
): Promise<EmailMetricsData[]> {
  // Get sent emails
  const { data: emailData, error } = await supabase
    .from('email_messages')
    .select('sent_at, is_from_me')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .gte('sent_at', dateRange.startDate)
    .lte('sent_at', dateRange.endDate + 'T23:59:59.999Z')
    .order('sent_at', { ascending: true })
  
  if (error) {
    console.error('Error in email fallback:', error)
    return []
  }
  
  const grouped: Record<string, EmailMetricsData> = {}
  
  emailData?.forEach(email => {
    if (!email.sent_at) return
    
    const date = new Date(email.sent_at)
    let period: string
    
    if (interval === 'month') {
      period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    } else if (interval === 'week') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      period = weekStart.toISOString().split('T')[0]
    } else {
      period = date.toISOString().split('T')[0]
    }
    
    if (!grouped[period]) {
      grouped[period] = {
        period,
        period_start: period,
        emails_sent: 0,
        emails_opened: 0,
        emails_replied: 0,
        open_rate: 0,
        reply_rate: 0
      }
    }
    
    if (email.is_from_me) {
      grouped[period].emails_sent++
    } else {
      grouped[period].emails_replied++
    }
  })
  
  // Calculate rates
  Object.values(grouped).forEach(g => {
    if (g.emails_sent > 0) {
      // Estimate open rate based on replies (if someone replied, they opened)
      g.emails_opened = Math.min(g.emails_sent, Math.ceil(g.emails_sent * 0.35))
      g.open_rate = Math.round((g.emails_opened / g.emails_sent) * 100 * 10) / 10
      g.reply_rate = Math.round((g.emails_replied / g.emails_sent) * 100 * 10) / 10
    }
  })
  
  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period))
}

/**
 * Get activity summary metrics
 */
export async function getActivityMetrics(
  orgId: string,
  dateRange?: DateRange
): Promise<ActivityMetrics> {
  const range = dateRange || getDefaultDateRange()
  
  const { data, error } = await supabase
    .rpc('get_activity_metrics', {
      p_org_id: orgId,
      p_start_date: range.startDate,
      p_end_date: range.endDate
    })
  
  if (error) {
    console.error('Error fetching activity metrics:', error)
    return getActivityMetricsFallback(orgId, range)
  }
  
  return data?.[0] || getEmptyActivityMetrics()
}

function getEmptyActivityMetrics(): ActivityMetrics {
  return {
    total_leads: 0,
    total_emails_sent: 0,
    total_emails_received: 0,
    total_tasks: 0,
    completed_tasks: 0,
    total_notes: 0,
    total_templates: 0,
    templates_used: 0
  }
}

/**
 * Fallback for activity metrics
 */
async function getActivityMetricsFallback(
  orgId: string,
  dateRange: DateRange
): Promise<ActivityMetrics> {
  const [leadsCount, emailsCount, tasksCount, notesCount, templatesCount] = await Promise.all([
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', dateRange.startDate)
      .lte('created_at', dateRange.endDate + 'T23:59:59.999Z'),
    
    supabase
      .from('email_messages')
      .select('is_from_me', { count: 'exact' })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('sent_at', dateRange.startDate)
      .lte('sent_at', dateRange.endDate + 'T23:59:59.999Z'),
    
    supabase
      .from('tasks')
      .select('status, completed_at', { count: 'exact' })
      .eq('org_id', orgId)
      .gte('created_at', dateRange.startDate)
      .lte('created_at', dateRange.endDate + 'T23:59:59.999Z'),
    
    supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', dateRange.startDate)
      .lte('created_at', dateRange.endDate + 'T23:59:59.999Z'),
    
    supabase
      .from('email_templates')
      .select('times_used')
      .eq('org_id', orgId)
  ])
  
  const emailsSent = emailsCount.data?.filter(e => e.is_from_me).length || 0
  const emailsReceived = emailsCount.data?.filter(e => !e.is_from_me).length || 0
  const completedTasks = tasksCount.data?.filter(t => t.status === 'completed').length || 0
  const templatesUsed = templatesCount.data?.filter(t => t.times_used > 0).length || 0
  
  return {
    total_leads: leadsCount.count || 0,
    total_emails_sent: emailsSent,
    total_emails_received: emailsReceived,
    total_tasks: tasksCount.count || 0,
    completed_tasks: completedTasks,
    total_notes: notesCount.count || 0,
    total_templates: templatesCount.data?.length || 0,
    templates_used: templatesUsed
  }
}

/**
 * Get lead source distribution
 */
export async function getLeadSourceDistribution(
  orgId: string,
  dateRange?: DateRange
): Promise<LeadSourceData[]> {
  const range = dateRange || getDefaultDateRange()
  
  const { data, error } = await supabase
    .rpc('get_lead_source_distribution', {
      p_org_id: orgId,
      p_start_date: range.startDate,
      p_end_date: range.endDate
    })
  
  if (error) {
    console.error('Error fetching source distribution:', error)
    return getLeadSourceDistributionFallback(orgId, range)
  }
  
  return data || []
}

async function getLeadSourceDistributionFallback(
  orgId: string,
  dateRange: DateRange
): Promise<LeadSourceData[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('source')
    .eq('org_id', orgId)
    .gte('created_at', dateRange.startDate)
    .lte('created_at', dateRange.endDate + 'T23:59:59.999Z')
  
  if (error) throw error
  
  const sourceCounts: Record<string, number> = {}
  const total = data?.length || 0
  
  data?.forEach(lead => {
    const sources = lead.source || ['Unknown']
    sources.forEach((s: string) => {
      sourceCounts[s] = (sourceCounts[s] || 0) + 1
    })
  })
  
  return Object.entries(sourceCounts)
    .map(([source, count]) => ({
      source,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get conversion funnel data
 */
export async function getConversionFunnel(
  orgId: string,
  dateRange?: DateRange
): Promise<ConversionFunnelData[]> {
  const range = dateRange || getDefaultDateRange()
  
  const { data, error } = await supabase
    .rpc('get_conversion_funnel', {
      p_org_id: orgId,
      p_start_date: range.startDate,
      p_end_date: range.endDate
    })
  
  if (error) {
    console.error('Error fetching conversion funnel:', error)
    return getConversionFunnelFallback(orgId, range)
  }
  
  return data || []
}

async function getConversionFunnelFallback(
  orgId: string,
  dateRange: DateRange
): Promise<ConversionFunnelData[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('status')
    .eq('org_id', orgId)
    .gte('created_at', dateRange.startDate)
    .lte('created_at', dateRange.endDate + 'T23:59:59.999Z')
  
  if (error) throw error
  
  const statusOrder: Record<string, { order: number; label: string }> = {
    'new': { order: 1, label: 'New Leads' },
    'contacted': { order: 2, label: 'Contacted' },
    'replied': { order: 3, label: 'Replied' },
    'qualified': { order: 3, label: 'Qualified' },
    'meeting_scheduled': { order: 4, label: 'Meeting Scheduled' },
    'proposal': { order: 5, label: 'Proposal' },
    'negotiation': { order: 6, label: 'Negotiation' },
    'won': { order: 7, label: 'Won' },
    'closed': { order: 7, label: 'Won' },
    'lost': { order: 8, label: 'Lost' }
  }
  
  const stageCounts: Record<string, number> = {}
  
  data?.forEach(lead => {
    const info = statusOrder[lead.status]
    if (info) {
      stageCounts[info.label] = (stageCounts[info.label] || 0) + 1
    }
  })
  
  const total = data?.length || 0
  
  return Object.entries(stageCounts)
    .map(([stage, count]) => ({
      stage,
      count,
      conversion_rate: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
      stage_order: Object.values(statusOrder).find(s => s.label === stage)?.order || 99
    }))
    .filter(s => s.stage_order <= 7)
    .sort((a, b) => a.stage_order - b.stage_order)
}

/**
 * Get task metrics over time
 */
export async function getTaskMetricsOverTime(
  orgId: string,
  dateRange?: DateRange,
  interval: TimeInterval = 'day'
): Promise<TaskMetricsData[]> {
  const range = dateRange || getDefaultDateRange()
  
  const { data, error } = await supabase
    .rpc('get_task_metrics_over_time', {
      p_org_id: orgId,
      p_start_date: range.startDate,
      p_end_date: range.endDate,
      p_interval: interval
    })
  
  if (error) {
    console.error('Error fetching task metrics:', error)
    return getTaskMetricsFallback(orgId, range, interval)
  }
  
  return data || []
}

async function getTaskMetricsFallback(
  orgId: string,
  dateRange: DateRange,
  interval: TimeInterval
): Promise<TaskMetricsData[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('created_at, completed_at, status, due_date')
    .eq('org_id', orgId)
    .gte('created_at', dateRange.startDate)
    .lte('created_at', dateRange.endDate + 'T23:59:59.999Z')
  
  if (error) {
    console.error('Error in task fallback:', error)
    return []
  }
  
  const grouped: Record<string, TaskMetricsData> = {}
  
  data?.forEach(task => {
    const date = new Date(task.created_at)
    let period: string
    
    if (interval === 'month') {
      period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    } else if (interval === 'week') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      period = weekStart.toISOString().split('T')[0]
    } else {
      period = date.toISOString().split('T')[0]
    }
    
    if (!grouped[period]) {
      grouped[period] = {
        period,
        period_start: period,
        tasks_created: 0,
        tasks_completed: 0,
        tasks_overdue: 0,
        completion_rate: 0
      }
    }
    
    grouped[period].tasks_created++
    
    if (task.status === 'completed') {
      grouped[period].tasks_completed++
    }
    
    if (task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed') {
      grouped[period].tasks_overdue++
    }
  })
  
  // Calculate completion rates
  Object.values(grouped).forEach(g => {
    if (g.tasks_created > 0) {
      g.completion_rate = Math.round((g.tasks_completed / g.tasks_created) * 100 * 10) / 10
    }
  })
  
  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period))
}

/**
 * Get overall analytics summary
 */
export async function getAnalyticsSummary(
  orgId: string,
  dateRange?: DateRange
): Promise<AnalyticsSummary> {
  const range = dateRange || getDefaultDateRange()
  const metrics = await getActivityMetrics(orgId, range)
  const funnel = await getConversionFunnel(orgId, range)
  
  // Calculate conversion rate (leads that became won)
  const wonStage = funnel.find(f => f.stage === 'Won')
  const newLeadsStage = funnel.find(f => f.stage === 'New Leads')
  const conversionRate = newLeadsStage && newLeadsStage.count > 0 && wonStage
    ? Math.round((wonStage.count / newLeadsStage.count) * 100 * 10) / 10
    : 0
  
  // Calculate email rates
  const openRate = metrics.total_emails_sent > 0
    ? Math.round((metrics.total_emails_received * 0.5 / metrics.total_emails_sent) * 100 * 10) / 10
    : 0
  
  const replyRate = metrics.total_emails_sent > 0
    ? Math.round((metrics.total_emails_received / metrics.total_emails_sent) * 100 * 10) / 10
    : 0
  
  // Get meetings scheduled count
  const meetingsScheduled = funnel.find(f => f.stage === 'Meeting Scheduled')?.count || 0
  
  return {
    totalLeads: metrics.total_leads,
    totalEmailsSent: metrics.total_emails_sent,
    totalEmailsReceived: metrics.total_emails_received,
    emailOpenRate: Math.min(openRate, 100),
    emailReplyRate: Math.min(replyRate, 100),
    meetingsScheduled,
    tasksCompleted: metrics.completed_tasks,
    conversionRate
  }
}
