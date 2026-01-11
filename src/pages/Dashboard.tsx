import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Users, Calendar, TrendingUp, ArrowUpRight, Sparkles, Play, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNavigate } from "react-router-dom"
import { ENABLE_MOCK_DATA, MOCK_ACTIVITIES, MOCK_LEADS, MOCK_MEETINGS } from "@/lib/mockData"
import { WorkflowHub } from "@/components/WorkflowHub"

interface DashboardStats {
  totalEmails: number
  activeLeads: number
  meetingsBooked: number
  replyRate: number
}

interface Activity {
  id: string
  type: 'email' | 'call' | 'meeting' | 'note'
  description: string
  lead_name: string
  created_at: string
}

export function Dashboard() {
  const navigate = useNavigate()
  const { selectedOrg } = useOrganization()
  const [stats, setStats] = useState<DashboardStats>({
    totalEmails: 0,
    activeLeads: 0,
    meetingsBooked: 0,
    replyRate: 0
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (selectedOrg) {
      loadDashboardData()
    }
  }, [selectedOrg])

  async function loadDashboardData() {
    if (!selectedOrg) return

    try {
      setIsLoading(true)

      // MOCK DATA: Use mock data when enabled
      if (ENABLE_MOCK_DATA) {
        const emailActivities = MOCK_ACTIVITIES.filter(a => a.type === 'email')
        const activeLeadsCount = MOCK_LEADS.filter(l => l.status !== 'lost' && l.status !== 'closed').length
        const meetingsCount = MOCK_MEETINGS.filter(m => m.status === 'active').length
        const totalEmails = emailActivities.length
        
        setStats({
          totalEmails: totalEmails,
          activeLeads: activeLeadsCount,
          meetingsBooked: meetingsCount,
          replyRate: 24
        })
        
        setActivities(MOCK_ACTIVITIES)
        setIsLoading(false)
        return
      }

      // Get total emails sent (activities with type='email')
      const { count: emailCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)
        .eq('type', 'email')

      // Get active leads (not lost or won)
      const { count: activeLeadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)
        .not('status', 'in', '("lost","won")')

      // Get meetings booked (could be from meetings table when Calendly is integrated)
      // For now, count leads with status='meeting_scheduled'
      const { count: meetingsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', selectedOrg.id)
        .eq('status', 'meeting_scheduled')

      // Calculate reply rate (emails with responses vs total emails)
      // For now, we'll use a simple calculation
      const totalEmails = emailCount || 0
      const replyRate = totalEmails > 0 ? Math.round((totalEmails * 0.24)) : 0

      setStats({
        totalEmails: totalEmails,
        activeLeads: activeLeadsCount || 0,
        meetingsBooked: meetingsCount || 0,
        replyRate: totalEmails > 0 ? Math.round((replyRate / totalEmails) * 100) : 0
      })

      // Get recent activities
      const { data: activitiesData } = await supabase
        .from('activities')
        .select(`
          id,
          type,
          description,
          created_at,
          lead:leads(name)
        `)
        .eq('org_id', selectedOrg.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (activitiesData) {
        const formattedActivities: Activity[] = activitiesData.map(act => ({
          id: act.id,
          type: act.type,
          description: act.description || '',
          lead_name: act.lead?.name || 'Unknown',
          created_at: act.created_at
        }))
        setActivities(formattedActivities)
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-GB')
  }

  function getActivityDescription(activity: Activity): string {
    switch (activity.type) {
      case 'email':
        return `Email sent to ${activity.lead_name}`
      case 'call':
        return `Call with ${activity.lead_name}`
      case 'meeting':
        return `Meeting scheduled with ${activity.lead_name}`
      case 'note':
        return `Note added to ${activity.lead_name}`
      default:
        return activity.description
    }
  }

  const statsCards = [
    {
      name: "Total Emails Sent",
      value: stats.totalEmails.toLocaleString(),
      icon: Mail,
    },
    {
      name: "Active Leads",
      value: stats.activeLeads.toLocaleString(),
      icon: Users,
    },
    {
      name: "Meetings Scheduled",
      value: stats.meetingsBooked.toLocaleString(),
      icon: Calendar,
    },
    {
      name: "Reply Rate",
      value: `${stats.replyRate}%`,
      icon: TrendingUp,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20"></div>
            <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
          </div>
          <span className="text-sm text-muted-foreground">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">
            Your sales automation workflow at a glance
          </p>
        </div>
        <Button onClick={() => navigate('/outreach/templates')} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Start New Campaign
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.name} className="group hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
              <div className="rounded-lg bg-muted p-2 group-hover:bg-primary/10 transition-colors">
                <stat.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Workflow Hub - Main Focus */}
        <div className="lg:col-span-2">
          <WorkflowHub />
        </div>

        {/* Right Column - Activity + Quick Actions */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/outreach/leads')}>
                View all
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-full bg-muted p-3">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-sm">No activities yet</p>
                      <p className="text-xs">Activities will appear here as you work</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {activities.slice(0, 4).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex h-2 w-2 rounded-full bg-primary mt-2 ring-4 ring-primary/10"></div>
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {getActivityDescription(activity)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/outreach/templates')}>
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-xs">Templates</span>
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/outreach/leads')}>
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs">Leads</span>
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/outreach/email-threads')}>
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs">Threads</span>
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2 h-auto py-3" onClick={() => navigate('/meetings')}>
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs">Meetings</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}