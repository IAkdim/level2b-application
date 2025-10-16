import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Mail, Eye, Reply, Send, Filter } from "lucide-react"

interface EmailThread {
  id: string
  leadName: string
  leadEmail: string
  company: string
  subject: string
  lastEmailDate: string
  status: "sent" | "delivered" | "opened" | "replied"
  isNewEmail: boolean
  isNewReply: boolean
  sentiment?: "positive" | "neutral" | "negative"
  threadCount: number
  lastMessage: string
}

const mockThreads: EmailThread[] = [
  {
    id: "1",
    leadName: "John Doe",
    leadEmail: "john@company.com",
    company: "Tech Corp",
    subject: "Partnership Opportunity",
    lastEmailDate: "2 hours ago",
    status: "replied",
    isNewEmail: false,
    isNewReply: true,
    sentiment: "positive",
    threadCount: 3,
    lastMessage: "Thanks for reaching out! I'd be interested in learning more about this partnership..."
  },
  {
    id: "2",
    leadName: "Sarah Wilson", 
    leadEmail: "sarah@startup.io",
    company: "Startup Inc",
    subject: "Quick Question About Your Services",
    lastEmailDate: "1 day ago",
    status: "sent",
    isNewEmail: true,
    isNewReply: false,
    threadCount: 1,
    lastMessage: "Hi Sarah, I noticed you're building something amazing at Startup Inc..."
  },
  {
    id: "3",
    leadName: "Mike Johnson",
    leadEmail: "mike@enterprise.com",
    company: "Enterprise Ltd", 
    subject: "Meeting Follow-up",
    lastEmailDate: "2 days ago",
    status: "opened",
    isNewEmail: false,
    isNewReply: false,
    threadCount: 5,
    lastMessage: "Looking forward to our meeting next week. Here's the agenda..."
  },
  {
    id: "4",
    leadName: "Lisa Chen",
    leadEmail: "lisa@agency.com",
    company: "Creative Agency",
    subject: "Not Interested",
    lastEmailDate: "3 days ago", 
    status: "replied",
    isNewEmail: false,
    isNewReply: true,
    sentiment: "negative",
    threadCount: 2,
    lastMessage: "Thank you for reaching out, but we're not interested at this time."
  }
]

function getThreadStatusVariant(status: EmailThread['status']) {
  const variants = {
    sent: 'info',
    delivered: 'success',
    opened: 'warning',
    replied: 'default',
  } as const
  return variants[status]
}

function getSentimentVariant(sentiment: 'positive' | 'neutral' | 'negative') {
  return sentiment === 'positive' ? 'success' : sentiment === 'negative' ? 'destructive' : 'warning'
}

export function EmailThreads() {
  const [threads, _setThreads] = useState<EmailThread[]>(mockThreads)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sentimentFilter, setSentimentFilter] = useState<string>("all") 
  const [showNewEmails, setShowNewEmails] = useState(false)
  const [showNewReplies, setShowNewReplies] = useState(false)
  const [dateRange, setDateRange] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"cold" | "responses">("responses")
  const [showFilters, setShowFilters] = useState(false)

  const baseFiltered = threads.filter(thread => {
    const matchesSearch = 
      thread.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.leadEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.subject.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || thread.status === statusFilter
    const matchesSentiment = sentimentFilter === "all" || thread.sentiment === sentimentFilter
    const matchesNewEmails = !showNewEmails || thread.isNewEmail
    const matchesNewReplies = !showNewReplies || thread.isNewReply
    // Date range placeholder
    const matchesDateRange = true

    return matchesSearch && matchesStatus && matchesSentiment && matchesNewEmails && matchesNewReplies && matchesDateRange
  })

  const coldCount = baseFiltered.filter(t => t.isNewEmail).length
  const responsesCount = baseFiltered.filter(t => t.isNewReply || t.status === "replied").length

  const filteredThreads = baseFiltered.filter(t =>
    activeTab === "cold" ? t.isNewEmail : (t.isNewReply || t.status === "replied")
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Threads</h1>
          <p className="text-gray-500">
            Overzicht van alle email conversations met prospects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowFilters(v => !v)}>
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
          <Button>
            <Send className="mr-2 h-4 w-4" />
            Send Campaign
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "cold" | "responses")}>
        <TabsList>
          <TabsTrigger value="cold">
            Cold email sent ({coldCount})
          </TabsTrigger>
          <TabsTrigger value="responses">
            Responses ({responsesCount})
          </TabsTrigger>
        </TabsList>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Threads</CardTitle>
            <Mail className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{threads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Replies</CardTitle>
            <Reply className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {threads.filter(t => t.isNewReply).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Sentiment</CardTitle>
            <Eye className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {threads.filter(t => t.sentiment === "positive").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Mail className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((threads.filter(t => t.status === "replied").length / threads.length) * 100)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters: collapsible */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter emails by status, sentiment, and timing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="search-threads" className="sr-only">
                    Search threads
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      id="search-threads"
                      type="text"
                      placeholder="Search threads..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="w-40">
                  <Label htmlFor="status-filter" className="sr-only">
                    Filter by status
                  </Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="opened">Opened</SelectItem>
                      <SelectItem value="replied">Replied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label htmlFor="sentiment-filter" className="sr-only">
                    Filter by sentiment
                  </Label>
                  <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                    <SelectTrigger id="sentiment-filter">
                      <SelectValue placeholder="All Sentiment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sentiment</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-new-emails"
                    checked={showNewEmails}
                    onCheckedChange={(checked) => setShowNewEmails(checked as boolean)}
                  />
                  <Label htmlFor="show-new-emails" className="text-sm font-normal cursor-pointer">
                    Show only new emails sent
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-new-replies"
                    checked={showNewReplies}
                    onCheckedChange={(checked) => setShowNewReplies(checked as boolean)}
                  />
                  <Label htmlFor="show-new-replies" className="text-sm font-normal cursor-pointer">
                    Show only new replies
                  </Label>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Label htmlFor="date-range" className="text-sm font-medium">
                  Date Range:
                </Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger id="date-range" className="w-40">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

        {/* Email Threads List - Shown in both tabs */}
        <TabsContent value="cold" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cold email sent</CardTitle>
              <CardDescription>
                {filteredThreads.length} of {threads.length} threads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredThreads.map((thread) => (
                  <div key={thread.id} className="border rounded-lg p-4 hover:bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium">{thread.leadName}</h3>
                          <span className="text-sm text-muted-foreground">{thread.company}</span>
                          {thread.isNewReply && (
                            <Badge variant="success">New Reply</Badge>
                          )}
                          {thread.isNewEmail && (
                            <Badge variant="info">New Email</Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm mb-1">{thread.subject}</p>
                        <p className="text-sm text-muted-foreground mb-2">{thread.lastMessage}</p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>{thread.lastEmailDate}</span>
                          <span>{thread.threadCount} messages</span>
                          <span>{thread.leadEmail}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {thread.sentiment && (
                          <Badge variant={getSentimentVariant(thread.sentiment)}>
                            {thread.sentiment}
                          </Badge>
                        )}
                        <Badge variant={getThreadStatusVariant(thread.status)}>
                          {thread.status}
                        </Badge>
                        <Button variant="ghost" size="sm" aria-label={`View thread with ${thread.leadName}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Responses</CardTitle>
              <CardDescription>
                {filteredThreads.length} of {threads.length} threads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredThreads.map((thread) => (
                  <div key={thread.id} className="border rounded-lg p-4 hover:bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium">{thread.leadName}</h3>
                          <span className="text-sm text-muted-foreground">{thread.company}</span>
                          {thread.isNewReply && (
                            <Badge variant="success">New Reply</Badge>
                          )}
                          {thread.isNewEmail && (
                            <Badge variant="info">New Email</Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm mb-1">{thread.subject}</p>
                        <p className="text-sm text-muted-foreground mb-2">{thread.lastMessage}</p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>{thread.lastEmailDate}</span>
                          <span>{thread.threadCount} messages</span>
                          <span>{thread.leadEmail}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {thread.sentiment && (
                          <Badge variant={getSentimentVariant(thread.sentiment)}>
                            {thread.sentiment}
                          </Badge>
                        )}
                        <Badge variant={getThreadStatusVariant(thread.status)}>
                          {thread.status}
                        </Badge>
                        <Button variant="ghost" size="sm" aria-label={`View thread with ${thread.leadName}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}