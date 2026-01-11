import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Mail, Calendar, Download, Filter, CalendarDays } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"

interface MetricData {
  label: string
  value: string
  icon: any
}

interface LeadsByStatus {
  status: string
  count: number
}

export function Analytics() {
  const { selectedOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus[]>([])
  const [totalLeads, setTotalLeads] = useState(0)
  const [totalActivities, setTotalActivities] = useState(0)
  const [totalNotes, setTotalNotes] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)

  useEffect(() => {
    if (selectedOrg) {
      loadAnalytics()
    }
  }, [selectedOrg])

  async function loadAnalytics() {
    if (!selectedOrg) return

    try {
      setIsLoading(true)

      // Get total emails sent
      const { count: emailCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)
        .eq('type', 'email')

      // Get total calls made
      const { count: callCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)
        .eq('type', 'call')

      // Get meetings booked
      const { count: meetingsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)
        .eq('status', 'meeting_scheduled')

      // Get total leads
      const { count: leadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)

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

      // Get leads by status
      const { data: statusData } = await supabase
        .from('leads')
        .select('status')
        .eq('org_id', selectedOrg.id)

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

      // Get activities count
      const { count: activitiesCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)

      setTotalActivities(activitiesCount || 0)

      // Get notes count
      const { count: notesCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)

      setTotalNotes(notesCount || 0)

      // Get tasks count
      const { count: tasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)

      setTotalTasks(tasksCount || 0)

    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'new': 'New',
      'contacted': 'Contacted',
      'qualified': 'Qualified',
      'meeting_scheduled': 'Meeting Scheduled',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'won': 'Won',
      'lost': 'Lost'
    }
    return labels[status] || status
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'new': 'bg-blue-500',
      'contacted': 'bg-cyan-500',
      'qualified': 'bg-green-500',
      'meeting_scheduled': 'bg-purple-500',
      'proposal': 'bg-yellow-500',
      'negotiation': 'bg-orange-500',
      'won': 'bg-emerald-500',
      'lost': 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20"></div>
            <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
          </div>
          <span className="text-sm text-muted-foreground">Loading analytics...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Detailed insights into your email campaign performance
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <CalendarDays className="mr-2 h-4 w-4" />
            Date Range
          </Button>
          <Button size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics - Keep cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-border/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Email Performance Chart - Remove heavy card, use section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold">Email Performance Over Time</h2>
          <p className="text-sm text-muted-foreground">Emails sent, opened, and replied over the last 6 months</p>
        </div>
        <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg border border-border/30">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Chart component would go here</p>
            <p className="text-sm text-muted-foreground">
              Integration with charts library (Chart.js, Recharts, etc.)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* Lead Status Distribution */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle>Lead Status Distribution</CardTitle>
            <CardDescription>
              Distribution of leads across different statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leadsByStatus.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leads yet
                </div>
              ) : (
                leadsByStatus.map((item) => (
                  <div key={item.status} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${getStatusColor(item.status)}`}></div>
                      <span className="font-medium">{getStatusLabel(item.status)}</span>
                    </div>
                    <span className="font-semibold">{item.count} ({totalLeads > 0 ? Math.round((item.count / totalLeads) * 100) : 0}%)</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle>Activities Overview</CardTitle>
            <CardDescription>
              Total number of activities in your system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Total Leads</span>
                <span className="font-semibold">{totalLeads.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Activities</span>
                <span className="font-semibold">{totalActivities.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Notes</span>
                <span className="font-semibold">{totalNotes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Tasks</span>
                <span className="font-semibold">{totalTasks.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Performance Chart - Remove heavy card, use section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold">Email Performance Over Time</h2>
          <p className="text-sm text-muted-foreground">Emails verzonden, geopend en beantwoord over de laatste maanden</p>
        </div>
        <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg border border-border/30">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Chart component goes here</p>
            <p className="text-sm text-muted-foreground">
              Integration with charts library (Chart.js, Recharts, etc.)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}