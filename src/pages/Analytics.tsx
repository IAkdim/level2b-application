import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Mail, Calendar, Download, Filter, CalendarDays } from "lucide-react"

interface MetricData {
  label: string
  value: string
  change: string
  changeType: "positive" | "negative" | "neutral"
  icon: any
}

const metricsData: MetricData[] = [
  {
    label: "Total Emails Sent",
    value: "12,847",
    change: "+15.2%",
    changeType: "positive",
    icon: Mail
  },
  {
    label: "Open Rate",
    value: "34.2%",
    change: "+2.1%", 
    changeType: "positive",
    icon: TrendingUp
  },
  {
    label: "Reply Rate",
    value: "12.8%",
    change: "-1.3%",
    changeType: "negative", 
    icon: TrendingDown
  },
  {
    label: "Meetings Booked",
    value: "287",
    change: "+23.7%",
    changeType: "positive",
    icon: Calendar
  }
]

const campaignPerformance = [
  { name: "Cold Outreach Campaign", sent: 2847, opened: 974, replied: 365, meetings: 89, roi: "340%" },
  { name: "Follow-up Sequence", sent: 1923, opened: 721, replied: 287, meetings: 67, roi: "280%" },
  { name: "Meeting Request Campaign", sent: 1456, opened: 623, replied: 198, meetings: 45, roi: "190%" },
  { name: "Partnership Outreach", sent: 892, opened: 267, replied: 89, meetings: 23, roi: "150%" }
]

const templatePerformance = [
  { name: "Tech Startup Outreach", sent: 245, openRate: 34.2, replyRate: 12.8, meetings: 31 },
  { name: "Follow-up - No Response", sent: 189, openRate: 28.1, replyRate: 18.2, meetings: 34 },
  { name: "Meeting Request", sent: 167, openRate: 42.3, replyRate: 31.2, meetings: 52 },
  { name: "Partnership Proposal", sent: 134, openRate: 25.7, replyRate: 8.9, meetings: 12 }
]

export function Analytics() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-gray-500">
            Detailleerde insights in je email campaign prestaties
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline">
            <CalendarDays className="mr-2 h-4 w-4" />
            Date Range
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsData.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className={`text-xs ${
                metric.changeType === "positive" 
                  ? "text-green-600" 
                  : metric.changeType === "negative" 
                  ? "text-red-600" 
                  : "text-gray-600"
              }`}>
                {metric.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Email Performance Over Time</CardTitle>
            <CardDescription>
              Emails sent, opened, and replied over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/10 rounded-lg border-2 border-dashed border-muted">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto text-gray-500 mb-3" />
                <p className="text-gray-500">Chart component would go here</p>
                <p className="text-sm text-gray-500">
                  Integration with charts library (Chart.js, Recharts, etc.)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>
              Track prospects through your sales process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-medium">Emails Sent</span>
                <span className="font-bold text-blue-600">12,847</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium">Emails Opened</span>
                <span className="font-bold text-green-600">4,394 (34.2%)</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <span className="font-medium">Replies Received</span>
                <span className="font-bold text-yellow-600">1,644 (12.8%)</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="font-medium">Meetings Booked</span>
                <span className="font-bold text-purple-600">287 (2.2%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ROI Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>ROI Analysis</CardTitle>
            <CardDescription>
              Return on investment per campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Investment</span>
                <span className="font-medium">$2,450</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Revenue Generated</span>
                <span className="font-medium">$12,340</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Total ROI</span>
                <span className="font-bold text-green-600">404%</span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Cost per meeting</span>
                  <span>$8.54</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Revenue per meeting</span>
                  <span>$43.00</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>
            Detailed breakdown of each email campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Replied</TableHead>
                  <TableHead>Meetings</TableHead>
                  <TableHead>ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignPerformance.map((campaign, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{campaign.sent.toLocaleString()}</TableCell>
                    <TableCell>
                      {campaign.opened.toLocaleString()}
                      <span className="text-muted-foreground ml-1">
                        ({Math.round((campaign.opened / campaign.sent) * 100)}%)
                      </span>
                    </TableCell>
                    <TableCell>
                      {campaign.replied.toLocaleString()}
                      <span className="text-muted-foreground ml-1">
                        ({Math.round((campaign.replied / campaign.sent) * 100)}%)
                      </span>
                    </TableCell>
                    <TableCell>{campaign.meetings}</TableCell>
                    <TableCell>
                      <Badge variant="success">{campaign.roi}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Template Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Template Performance</CardTitle>
          <CardDescription>
            Compare performance across different email templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Open Rate</TableHead>
                  <TableHead>Reply Rate</TableHead>
                  <TableHead>Meetings</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templatePerformance.map((template, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.sent}</TableCell>
                    <TableCell>{template.openRate}%</TableCell>
                    <TableCell>{template.replyRate}%</TableCell>
                    <TableCell>{template.meetings}</TableCell>
                    <TableCell>
                      <Badge variant={
                        template.replyRate > 20 ? 'success' :
                        template.replyRate > 10 ? 'warning' : 'destructive'
                      }>
                        {template.replyRate > 20 ? 'Excellent' :
                         template.replyRate > 10 ? 'Good' : 'Needs Improvement'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}