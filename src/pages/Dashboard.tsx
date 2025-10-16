import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Users, Calendar, TrendingUp } from "lucide-react"

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight inline-block">Dashboard</h1>
        <div className="h-1 w-20 bg-brand-600 rounded mt-2" />
        <p className="text-gray-500 mt-2">
          Overzicht van je AI emailer prestaties
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs ${
                stat.changeType === "positive" ? "text-green-600" : "text-red-600"
              }`}>
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Laatste updates van je email campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex h-2 w-2 rounded-full bg-green-500"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Email sent to John Doe
                  </p>
                  <p className="text-sm text-gray-500">
                    2 minutes ago
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex h-2 w-2 rounded-full bg-blue-500"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Reply received from Sarah Wilson
                  </p>
                  <p className="text-sm text-gray-500">
                    5 minutes ago
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex h-2 w-2 rounded-full bg-purple-500"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Meeting scheduled with Mike Johnson  
                  </p>
                  <p className="text-sm text-gray-500">
                    15 minutes ago
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Snelle acties voor je workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full">
              Generate New Template
            </Button>
            <Button variant="outline" className="w-full">
              Import Leads
            </Button>
            <Button variant="outline" className="w-full">
              View Analytics
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}