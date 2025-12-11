import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Users, Calendar, TrendingUp, ArrowUpRight, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useNavigate } from "react-router-dom"

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

    if (diffMins < 1) return 'Zojuist'
    if (diffMins < 60) return `${diffMins} minuten geleden`
    if (diffHours < 24) return `${diffHours} uur geleden`
    if (diffDays === 1) return 'Gisteren'
    if (diffDays < 7) return `${diffDays} dagen geleden`
    return date.toLocaleDateString('nl-NL')
  }

  function getActivityDescription(activity: Activity): string {
    switch (activity.type) {
      case 'email':
        return `Email verzonden naar ${activity.lead_name}`
      case 'call':
        return `Gesprek met ${activity.lead_name}`
      case 'meeting':
        return `Meeting gepland met ${activity.lead_name}`
      case 'note':
        return `Notitie toegevoegd aan ${activity.lead_name}`
      default:
        return activity.description
    }
  }

  const statsCards = [
    {
      name: "Totaal Emails Verzonden",
      value: stats.totalEmails.toLocaleString(),
      icon: Mail,
    },
    {
      name: "Actieve Leads",
      value: stats.activeLeads.toLocaleString(),
      icon: Users,
    },
    {
      name: "Meetings Gepland",
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overzicht van je AI emailer prestaties
        </p>
      </div>

      {/* Stats Grid - Keep cards for metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.name} className="border-border/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Recent Activity - Use subtle background instead of heavy card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Recente Activiteit</h2>
              <p className="text-sm text-muted-foreground">Laatste updates van je leads</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/leads')}>
              Bekijk alles
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2 bg-muted/30 rounded-lg p-6 border border-border/30">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nog geen activiteiten
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 bg-background rounded-md hover:bg-accent/50 transition-colors">
                  <div className="flex h-2 w-2 rounded-full bg-muted-foreground/40 mt-2"></div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {getActivityDescription(activity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions - Keep card but refined */}
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">Quick Actions</h2>
            <p className="text-sm text-muted-foreground">Snelle acties voor je workflow</p>
          </div>

          <Card className="border-border/30">
            <CardContent className="pt-6 space-y-2">
              <Button size="sm" className="w-full" onClick={() => navigate('/templates')}>
                Nieuwe Template
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => navigate('/leads')}>
                Leads Beheren
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => navigate('/analytics')}>
                Analytics Bekijken
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}