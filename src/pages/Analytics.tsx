import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Mail, Calendar, Download, Filter, CalendarDays } from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/AuthContext"

interface MetricData {
  label: string
  value: string
  icon: any
}

const STATUS_COLORS: Record<string, string> = {
  'new': '#3b82f6',
  'contacted': '#06b6d4',
  'replied': '#8b5cf6',
  'qualified': '#10b981',
  'meeting_scheduled': '#a855f7',
  'proposal': '#f59e0b',
  'negotiation': '#f97316',
  'won': '#22c55e',
  'closed': '#22c55e',
  'lost': '#ef4444'
}

<<<<<<< HEAD
 const Analytics = () => {
  const { user } = useAuth()
  const { selectedOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus[]>([])
  const [totalLeads, setTotalLeads] = useState(0)
  const [totalActivities, setTotalActivities] = useState(0)
  const [totalNotes, setTotalNotes] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)

  // Helper to build user-centric filter
  const buildFilter = useCallback((query: any) => {
    if (!user) return query
    if (selectedOrg?.id) {
      return query.or(`user_id.eq.${user.id},org_id.eq.${selectedOrg.id}`)
    }
    return query.eq('user_id', user.id)
  }, [user, selectedOrg?.id])

  const loadAnalytics = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)

      // Get total emails sent (user-centric)
      let emailQuery = supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'email')
      emailQuery = buildFilter(emailQuery)
      const { count: emailCount } = await emailQuery

      // Get total calls made (user-centric)
      let callQuery = supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'call')
      callQuery = buildFilter(callQuery)
      const { count: _callCount } = await callQuery

      // Get meetings booked (user-centric)
      let meetingsQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'meeting_scheduled')
      meetingsQuery = buildFilter(meetingsQuery)
      const { count: meetingsCount } = await meetingsQuery

      // Get total leads (user-centric)
      let leadsQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
      leadsQuery = buildFilter(leadsQuery)
      const { count: leadsCount } = await leadsQuery

      setTotalLeads(leadsCount || 0)
      setTotalActivities(emailCount || 0)
      setTotalNotes(0)
      setTotalTasks(0)

      // Calculate open rate (mock for now)
      const openRate = emailCount && emailCount > 0 ? Math.round((emailCount * 0.34)) : 0
      const replyRate = emailCount && emailCount > 0 ? Math.round((emailCount * 0.12)) : 0

      setMetrics([
        {
          label: "Total Emails Sent",
          value: (emailCount || 0).toLocaleString(),
          icon: Mail
        },
        {
          label: "Open Rate",
          value: emailCount && emailCount > 0 ? `${Math.round((openRate / emailCount) * 100)}%` : "0%",
          icon: TrendingUp
        },
        {
          label: "Reply Rate", 
          value: emailCount && emailCount > 0 ? `${Math.round((replyRate / emailCount) * 100)}%` : "0%",
          icon: TrendingDown
        },
        {
          label: "Meetings Scheduled",
          value: (meetingsCount || 0).toLocaleString(),
          icon: Calendar
        }
      ])

      // Get leads by status (user-centric)
      let statusQuery = supabase
        .from('leads')
        .select('status')
      statusQuery = buildFilter(statusQuery)
      const { data: statusData } = await statusQuery

      if (statusData) {
        const statusCounts = statusData.reduce((acc: Record<string, number>, lead) => {
          acc[lead.status] = (acc[lead.status] || 0) + 1
          return acc
        }, {})

        const statusArray = Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count: count as number
        }))

        setLeadsByStatus(statusArray)
      }

      // Get activities count (user-centric)
      let activitiesQuery = supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
      activitiesQuery = buildFilter(activitiesQuery)
      const { count: activitiesCount } = await activitiesQuery

      setTotalActivities(activitiesCount || 0)

      // Get notes count (user-centric)
      let notesQuery = supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
      notesQuery = buildFilter(notesQuery)
      const { count: notesCount } = await notesQuery

      setTotalNotes(notesCount || 0)

      // Get tasks count (user-centric)
      let tasksQuery = supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
      tasksQuery = buildFilter(tasksQuery)
      const { count: tasksCount } = await tasksQuery

      setTotalTasks(tasksCount || 0)

    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, buildFilter])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'new': 'New',
    'contacted': 'Contacted',
    'replied': 'Replied',
    'qualified': 'Qualified',
    'meeting_scheduled': 'Meeting Scheduled',
    'proposal': 'Proposal',
    'negotiation': 'Negotiation',
    'won': 'Won',
    'closed': 'Closed',
    'lost': 'Lost'
  }
  return labels[status] || status
}
export default Analytics;

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// Empty state component
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
      <BarChart3 className="h-12 w-12 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-1">Data will appear once you start tracking leads</p>
    </div>
  )
}

// Loading skeleton
function ChartSkeleton() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20"></div>
          <div className="absolute inset-0 h-8 w-8 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
        </div>
        <span className="text-xs text-muted-foreground">Loading data...</span>
      </div>
    </div>
  )
}

=======
>>>>>>> b19906cd00ff665611dd3b74ac447c6681cbb747
export function Analytics() {
  const [dateRangePreset, setDateRangePreset] = useState<string>('30d')
  const [interval, setInterval] = useState<TimeInterval>('day')
  
  // Calculate date range from preset
  const dateRange = useMemo(() => getDateRangeFromPreset(dateRangePreset), [dateRangePreset])
  
  // Determine appropriate interval based on date range
  const effectiveInterval = useMemo(() => {
    const days = DATE_RANGE_PRESETS[dateRangePreset as keyof typeof DATE_RANGE_PRESETS]?.days || 30
    if (days <= 14) return 'day'
    if (days <= 90) return interval === 'month' ? 'week' : interval
    return interval === 'day' ? 'week' : interval
  }, [dateRangePreset, interval])
  
  // Fetch all analytics data
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useAnalyticsSummary(dateRange)
  const { data: funnelMetrics, isLoading: funnelLoading } = useLeadFunnelMetrics(dateRange)
  const { data: leadsOverTime, isLoading: leadsTimeLoading } = useLeadsOverTime(dateRange, effectiveInterval)
  const { data: emailMetrics, isLoading: emailLoading } = useEmailMetricsOverTime(dateRange, effectiveInterval)
  const { data: sourceDistribution, isLoading: sourceLoading } = useLeadSourceDistribution(dateRange)
  const { data: conversionFunnel, isLoading: conversionLoading } = useConversionFunnel(dateRange)
  const { data: activityMetrics, isLoading: activityLoading } = useActivityMetrics(dateRange)
  
  const isLoading = summaryLoading || funnelLoading || leadsTimeLoading || emailLoading || sourceLoading || conversionLoading
  
  // Format leads over time data for the chart
  const leadsChartData = useMemo(() => {
    if (!leadsOverTime?.length) return []
    
    return leadsOverTime.map(item => ({
      ...item,
      period: formatPeriodLabel(item.period, effectiveInterval)
    }))
  }, [leadsOverTime, effectiveInterval])
  
  // Format email metrics for chart
  const emailChartData = useMemo(() => {
    if (!emailMetrics?.length) return []
    
    return emailMetrics.map(item => ({
      ...item,
      period: formatPeriodLabel(item.period, effectiveInterval)
    }))
  }, [emailMetrics, effectiveInterval])
  
  // Format source distribution for pie chart
  const sourceChartData = useMemo(() => {
    if (!sourceDistribution?.length) return []
    
    return sourceDistribution.slice(0, 8).map((item, index) => ({
      name: item.source,
      value: item.count,
      percentage: item.percentage,
      fill: PIE_COLORS[index % PIE_COLORS.length]
    }))
  }, [sourceDistribution])
  
  // Format funnel data with colors
  const funnelChartData = useMemo(() => {
    if (!funnelMetrics?.length) return []
    
    return funnelMetrics.map(item => ({
      name: getStatusLabel(item.status),
      value: item.count,
      percentage: item.percentage,
      fill: STATUS_COLORS[item.status] || COLORS.muted
    }))
  }, [funnelMetrics])
  
  // Export to CSV
  function handleExport() {
    if (!summary || !funnelMetrics) return
    
    const csvData = [
      ['Analytics Report', ''],
      ['Date Range', `${dateRange.startDate} to ${dateRange.endDate}`],
      ['Generated', new Date().toISOString()],
      [''],
      ['Summary Metrics', ''],
      ['Total Leads', summary.totalLeads],
      ['Emails Sent', summary.totalEmailsSent],
      ['Emails Received', summary.totalEmailsReceived],
      ['Open Rate', `${summary.emailOpenRate}%`],
      ['Reply Rate', `${summary.emailReplyRate}%`],
      ['Meetings Scheduled', summary.meetingsScheduled],
      ['Conversion Rate', `${summary.conversionRate}%`],
      [''],
      ['Lead Status Distribution', ''],
      ...funnelMetrics.map(item => [getStatusLabel(item.status), item.count])
    ]
    
    const csv = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-report-${dateRange.startDate}-${dateRange.endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  function handleRefresh() {
    refetchSummary()
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Real-time insights into your sales pipeline and outreach performance
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATE_RANGE_PRESETS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={interval} onValueChange={(v) => setInterval(v as TimeInterval)}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button size="sm" onClick={handleExport} disabled={!summary}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Leads"
          value={summary?.totalLeads ?? 0}
          icon={Users}
          isLoading={summaryLoading}
        />
        <MetricCard
          label="Emails Sent"
          value={summary?.totalEmailsSent ?? 0}
          icon={Mail}
          isLoading={summaryLoading}
        />
        <MetricCard
          label="Reply Rate"
          value={`${summary?.emailReplyRate ?? 0}%`}
          icon={summary?.emailReplyRate && summary.emailReplyRate > 10 ? TrendingUp : TrendingDown}
          trend={summary?.emailReplyRate && summary.emailReplyRate > 10 ? 'up' : 'neutral'}
          isLoading={summaryLoading}
        />
        <MetricCard
          label="Meetings Scheduled"
          value={summary?.meetingsScheduled ?? 0}
          icon={Calendar}
          isLoading={summaryLoading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Conversion Rate"
          value={`${summary?.conversionRate ?? 0}%`}
          icon={Target}
          trend={summary?.conversionRate && summary.conversionRate > 5 ? 'up' : 'neutral'}
          isLoading={summaryLoading}
          size="sm"
        />
        <MetricCard
          label="Tasks Completed"
          value={activityMetrics?.completed_tasks ?? 0}
          icon={CheckCircle2}
          isLoading={activityLoading}
          size="sm"
        />
        <MetricCard
          label="Total Notes"
          value={activityMetrics?.total_notes ?? 0}
          icon={BarChart3}
          isLoading={activityLoading}
          size="sm"
        />
        <MetricCard
          label="Templates Used"
          value={activityMetrics?.templates_used ?? 0}
          icon={Mail}
          isLoading={activityLoading}
          size="sm"
        />
      </div>

      {/* Leads Over Time Chart */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle>Lead Activity Over Time</CardTitle>
          <CardDescription>
            New leads created and their status progression
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {leadsTimeLoading ? (
              <ChartSkeleton />
            ) : !leadsChartData.length ? (
              <EmptyChart message="No lead data for this period" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leadsChartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorContacted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="total_leads" 
                    name="Total Leads"
                    stroke={COLORS.primary} 
                    fill="url(#colorTotal)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="contacted_leads" 
                    name="Contacted"
                    stroke={COLORS.secondary} 
                    fill="url(#colorContacted)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="meeting_scheduled_leads" 
                    name="Meetings"
                    stroke={COLORS.success} 
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Performance Chart */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle>Email Performance</CardTitle>
          <CardDescription>
            Emails sent and replies received over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {emailLoading ? (
              <ChartSkeleton />
            ) : !emailChartData.length || emailChartData.every(d => d.emails_sent === 0) ? (
              <EmptyChart message="No email data for this period" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={emailChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="emails_sent" 
                    name="Sent"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: COLORS.primary, strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="emails_replied" 
                    name="Replies"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    dot={{ fill: COLORS.success, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Status Distribution */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle>Lead Status Distribution</CardTitle>
            <CardDescription>
              Current distribution of leads across pipeline stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {funnelLoading ? (
                <ChartSkeleton />
              ) : !funnelChartData.length ? (
                <EmptyChart message="No leads to display" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="value" 
                      name="Leads"
                      radius={[0, 4, 4, 0]}
                    >
                      {funnelChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            
            {/* Status Legend */}
            {funnelChartData.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {funnelChartData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-muted-foreground">{item.name}:</span>
                    <span className="font-medium">{item.value}</span>
                    <span className="text-muted-foreground">({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
            <CardDescription>
              Where your leads are coming from
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {sourceLoading ? (
                <ChartSkeleton />
              ) : !sourceChartData.length ? (
                <EmptyChart message="No source data available" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={(props: any) => `${props.name} (${props.payload?.percentage || 0}%)`}
                      labelLine={true}
                    >
                      {sourceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            {/* Source Legend */}
            {sourceChartData.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {sourceChartData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-muted-foreground truncate">{item.name}:</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>
            Lead progression through your sales pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {conversionLoading ? (
              <ChartSkeleton />
            ) : !conversionFunnel?.length ? (
              <EmptyChart message="No conversion data available" />
            ) : (
              <div className="flex items-center gap-4 h-full overflow-x-auto pb-4">
                {conversionFunnel.map((stage, index) => (
                  <div key={stage.stage} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-32 h-24 rounded-lg flex flex-col items-center justify-center text-white font-medium"
                        style={{ 
                          backgroundColor: STATUS_COLORS[stage.stage.toLowerCase().replace(' ', '_')] || COLORS.primary,
                          opacity: 1 - (index * 0.1)
                        }}
                      >
                        <span className="text-2xl font-bold">{stage.count}</span>
                        <span className="text-xs opacity-90">{stage.stage}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-2">
                        {stage.conversion_rate}% of total
                      </span>
                    </div>
                    {index < conversionFunnel.length - 1 && (
                      <div className="mx-2 text-muted-foreground">→</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Overview */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle>Activity Overview</CardTitle>
          <CardDescription>
            Summary of all activities in the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-4 bg-muted/50 rounded-lg animate-pulse">
                  <div className="h-4 w-20 bg-muted rounded mb-2"></div>
                  <div className="h-8 w-16 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : !activityMetrics ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity data available
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActivityStat 
                label="Leads Created" 
                value={activityMetrics.total_leads}
              />
              <ActivityStat 
                label="Emails Sent" 
                value={activityMetrics.total_emails_sent}
              />
              <ActivityStat 
                label="Emails Received" 
                value={activityMetrics.total_emails_received}
              />
              <ActivityStat 
                label="Tasks Created" 
                value={activityMetrics.total_tasks}
              />
              <ActivityStat 
                label="Tasks Completed" 
                value={activityMetrics.completed_tasks}
              />
              <ActivityStat 
                label="Notes Added" 
                value={activityMetrics.total_notes}
              />
              <ActivityStat 
                label="Templates" 
                value={activityMetrics.total_templates}
              />
              <ActivityStat 
                label="Templates Used" 
                value={activityMetrics.templates_used}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Helper Components

interface MetricCardProps {
  label: string
  value: number | string
  icon: any
  trend?: 'up' | 'down' | 'neutral'
  isLoading?: boolean
  size?: 'sm' | 'default'
}

function MetricCard({ label, value, icon: Icon, trend, isLoading, size = 'default' }: MetricCardProps) {
  return (
    <Card className="border-border/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`font-medium text-muted-foreground ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {label}
        </CardTitle>
        <Icon className={`text-muted-foreground/50 ${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className={`bg-muted rounded animate-pulse ${size === 'sm' ? 'h-6 w-12' : 'h-8 w-16'}`}></div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${size === 'sm' ? 'text-lg' : 'text-2xl'}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {trend === 'up' && (
              <TrendingUp className="h-4 w-4 text-green-500" />
            )}
            {trend === 'down' && (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-border/30">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value.toLocaleString()}</p>
    </div>
  )
}

function formatPeriodLabel(period: string, interval: TimeInterval): string {
  if (interval === 'month') {
    // Format: 2026-01 -> Jan 2026
    const [year, month] = period.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  if (interval === 'week') {
    // Format: 2026-02 -> Week 2
    if (period.includes('W') || period.match(/^\d{4}-\d{2}$/)) {
      const parts = period.split('-')
      if (parts.length === 2 && parts[1].length <= 2) {
        return `Week ${parseInt(parts[1])}`
      }
    }
  }
  // Daily format: 2026-01-13 -> Jan 13
  try {
    const date = new Date(period)
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  } catch {
    // Fall through
  }
  return period
}
