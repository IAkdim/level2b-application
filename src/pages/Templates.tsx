import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Plus, Search, Edit, Copy, Trash2, Sparkles, TrendingUp, Mail } from "lucide-react"

interface Template {
  id: string
  name: string
  subject: string
  content: string
  category: "cold_outreach" | "follow_up" | "meeting_request" | "custom"
  performance: {
    sentCount: number
    openRate: number
    replyRate: number
  }
  lastUsed: string
  createdDate: string
  isAiGenerated: boolean
}

const mockTemplates: Template[] = [
  {
    id: "1",
    name: "Tech Startup Outreach",
    subject: "Quick question about {{company_name}}",
    content: "Hi {{first_name}},\n\nI've been following {{company_name}} and I'm impressed by your work in the {{industry}} space.\n\nI'd love to show you how we've helped similar companies increase their revenue by 40%.\n\nWould you be open to a 15-minute call this week?\n\nBest regards,\n{{sender_name}}",
    category: "cold_outreach",
    performance: { sentCount: 245, openRate: 34.2, replyRate: 12.8 },
    lastUsed: "2 days ago",
    createdDate: "2 weeks ago",
    isAiGenerated: true
  },
  {
    id: "2", 
    name: "Follow-up - No Response",
    subject: "Re: Quick question about {{company_name}}",
    content: "Hi {{first_name}},\n\nI sent you a message last week about helping {{company_name}} with revenue growth.\n\nI understand you're busy, but I thought you might be interested in seeing how we helped TechCorp increase their MRR by 45% in 3 months.\n\nWould a quick 10-minute call work for you?\n\nBest,\n{{sender_name}}",
    category: "follow_up",
    performance: { sentCount: 89, openRate: 28.1, replyRate: 18.2 },
    lastUsed: "1 day ago", 
    createdDate: "2 weeks ago",
    isAiGenerated: false
  },
  {
    id: "3",
    name: "Meeting Request Template", 
    subject: "Coffee chat about {{topic}}?",
    content: "Hi {{first_name}},\n\nI hope this email finds you well.\n\nI'd love to connect and discuss {{topic}} over a quick coffee chat.\n\nHere's my calendar link: {{calendar_link}}\n\nLooking forward to hearing from you!\n\nBest,\n{{sender_name}}",
    category: "meeting_request",
    performance: { sentCount: 67, openRate: 42.3, replyRate: 31.2 },
    lastUsed: "5 days ago",
    createdDate: "1 month ago", 
    isAiGenerated: true
  }
]

function getCategoryVariant(category: Template['category']) {
  const variants = {
    cold_outreach: 'info',
    follow_up: 'warning',
    meeting_request: 'success',
    custom: 'secondary',
  } as const
  return variants[category]
}

export function Templates() {
  const [templates, _setTemplates] = useState<Template[]>(mockTemplates)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter
    
    return matchesSearch && matchesCategory
  })

  const handleGenerateTemplate = () => {
    setIsGenerating(true)
    // Simulate Claude AI generation
    setTimeout(() => {
      setIsGenerating(false)
      // Here you would call your backend Claude AI integration
      alert("Claude AI template generation would happen here!")
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Beheer je email templates en genereer nieuwe met Claude AI
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleGenerateTemplate} disabled={isGenerating}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate with AI"}
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Generated</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter(t => t.isAiGenerated).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(templates.reduce((acc, t) => acc + t.performance.openRate, 0) / templates.length)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Reply Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(templates.reduce((acc, t) => acc + t.performance.replyRate, 0) / templates.length)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="search-templates" className="sr-only">
                    Search templates
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      id="search-templates"
                      type="text"
                      placeholder="Search templates..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Label htmlFor="category-filter" className="sr-only">
                    Filter by category
                  </Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger id="category-filter">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="meeting_request">Meeting Request</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Templates Grid */}
          <div className="grid gap-4">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                tabIndex={0}
                role="button"
                aria-pressed={selectedTemplate?.id === template.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedTemplate?.id === template.id && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedTemplate(template)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedTemplate(template)
                  }
                }}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {template.name}
                        {template.isAiGenerated && (
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                        )}
                      </CardTitle>
                      <CardDescription>{template.subject}</CardDescription>
                    </div>
                    <Badge variant={getCategoryVariant(template.category)}>
                      {template.category.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {template.content.substring(0, 150)}...
                  </p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <div className="flex space-x-4">
                      <span>Sent: {template.performance.sentCount}</span>
                      <span>Open: {template.performance.openRate}%</span>
                      <span>Reply: {template.performance.replyRate}%</span>
                    </div>
                    <span>Last used: {template.lastUsed}</span>
                  </div>
                  <div className="flex justify-end space-x-2 mt-3">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Template Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Preview</CardTitle>
              <CardDescription>
                {selectedTemplate ? "Edit and preview your template" : "Select a template to preview"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTemplate ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      type="text"
                      value={selectedTemplate.name}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject-line">Subject Line</Label>
                    <Input
                      id="subject-line"
                      type="text"
                      value={selectedTemplate.subject}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-content">Email Content</Label>
                    <textarea
                      id="email-content"
                      value={selectedTemplate.content}
                      rows={10}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      readOnly
                    />
                  </div>
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Performance Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Sent:</span>
                        <span>{selectedTemplate.performance.sentCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Open Rate:</span>
                        <span>{selectedTemplate.performance.openRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reply Rate:</span>
                        <span>{selectedTemplate.performance.replyRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a template to view and edit</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}