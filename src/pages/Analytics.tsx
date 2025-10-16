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
    <div className="space-y-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Detailleerde insights in je email campaign prestaties
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
        {metricsData.map((metric) => (
          <Card key={metric.label} className="border-border/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metric.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs font-medium ${
                  metric.changeType === "positive"
                    ? "text-green-600 dark:text-green-500"
                    : metric.changeType === "negative"
                    ? "text-red-600 dark:text-red-500"
                    : "text-muted-foreground"
                }`}>
                  {metric.change}
                </span>
                <span className="text-xs text-muted-foreground">from last month</span>
              </div>
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

        {/* Conversion Funnel - Keep card for interactive data */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>
              Track prospects through your sales process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Emails Sent</span>
                <span className="font-semibold">12,847</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Emails Opened</span>
                <span className="font-semibold">4,394 (34.2%)</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Replies Received</span>
                <span className="font-semibold">1,644 (12.8%)</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/30">
                <span className="font-medium">Meetings Booked</span>
                <span className="font-semibold">287 (2.2%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ROI Analysis - Keep card */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle>ROI Analysis</CardTitle>
            <CardDescription>
              Return on investment per campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Investment</span>
                <span className="font-medium">$2,450</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Revenue Generated</span>
                <span className="font-medium">$12,340</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="font-medium">Total ROI</span>
                <span className="font-semibold">404%</span>
              </div>
              <div className="mt-4 pt-3 border-t space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cost per meeting</span>
                  <span className="font-medium">$8.54</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Revenue per meeting</span>
                  <span className="font-medium">$43.00</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance Table - Remove card, use subtle section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold">Campaign Performance</h2>
          <p className="text-sm text-muted-foreground">Detailed breakdown of each email campaign</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-background overflow-hidden">
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
        </div>
      </div>

      {/* Template Performance - Remove card, use subtle section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold">Template Performance</h2>
          <p className="text-sm text-muted-foreground">Compare performance across different email templates</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-background overflow-hidden">
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
        </div>
      </div>
    </div>
  )
}