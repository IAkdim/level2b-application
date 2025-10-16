import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Users, Calendar, TrendingUp, ArrowUpRight } from "lucide-react"

export function Dashboard() {
  const stats = [
    {
      name: "Total Emails Sent",
      value: "2,847",
      change: "+12.5%",
      changeType: "positive",
      icon: Mail,
    },
    {
      name: "Active Leads",
      value: "1,429",
      change: "+3.2%",
      changeType: "positive",
      icon: Users,
    },
    {
      name: "Meetings Booked",
      value: "89",
      change: "+18.7%",
      changeType: "positive",
      icon: Calendar,
    },
    {
      name: "Reply Rate",
      value: "24.3%",
      change: "-2.1%",
      changeType: "negative",
      icon: TrendingUp,
    },
  ]

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
        {stats.map((stat) => (
          <Card key={stat.name} className="border-border/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stat.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs font-medium ${
                  stat.changeType === "positive" ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
                }`}>
                  {stat.change}
                </span>
                <span className="text-xs text-muted-foreground">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Recent Activity - Use subtle background instead of heavy card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <p className="text-sm text-muted-foreground">Laatste updates van je email campaigns</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2 bg-muted/30 rounded-lg p-6 border border-border/30">
            <div className="flex items-start gap-4 p-4 bg-background rounded-md hover:bg-accent/50 transition-colors">
              <div className="flex h-2 w-2 rounded-full bg-muted-foreground/40 mt-2"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  Email sent to John Doe
                </p>
                <p className="text-xs text-muted-foreground">
                  2 minutes ago
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-background rounded-md hover:bg-accent/50 transition-colors">
              <div className="flex h-2 w-2 rounded-full bg-muted-foreground/40 mt-2"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  Reply received from Sarah Wilson
                </p>
                <p className="text-xs text-muted-foreground">
                  5 minutes ago
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-background rounded-md hover:bg-accent/50 transition-colors">
              <div className="flex h-2 w-2 rounded-full bg-muted-foreground/40 mt-2"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  Meeting scheduled with Mike Johnson
                </p>
                <p className="text-xs text-muted-foreground">
                  15 minutes ago
                </p>
              </div>
            </div>
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
              <Button size="sm" className="w-full">
                Generate New Template
              </Button>
              <Button size="sm" variant="outline" className="w-full">
                Import Leads
              </Button>
              <Button size="sm" variant="outline" className="w-full">
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}