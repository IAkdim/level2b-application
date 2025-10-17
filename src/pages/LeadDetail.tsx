import { useParams, useNavigate } from "react-router-dom"
import { useLead } from "@/hooks/useLeads"
import { ActivityTimeline } from "@/components/ActivityTimeline"
import { TaskList } from "@/components/TaskList"
import { NotesList } from "@/components/NotesList"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Loader2
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export function LeadDetail() {
  const { leadId } = useParams<{ leadId: string }>()
  const navigate = useNavigate()
  const { data: lead, isLoading } = useLead(leadId)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Lead not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/outreach/leads')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Leads
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/outreach/leads')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
            <p className="text-muted-foreground">{lead.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Lead Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{lead.email}</p>
                </div>
              </div>

              {lead.phone && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{lead.phone}</p>
                    </div>
                  </div>
                </>
              )}

              {lead.company && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Company</p>
                      <p className="text-sm text-muted-foreground">{lead.company}</p>
                    </div>
                  </div>
                </>
              )}

              {lead.title && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Title</p>
                      <p className="text-sm text-muted-foreground">{lead.title}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Status</p>
                <Badge variant="default">{lead.status.replace('_', ' ')}</Badge>
              </div>

              {lead.sentiment && (
                <div>
                  <p className="text-sm font-medium mb-2">Sentiment</p>
                  <Badge variant="secondary">{lead.sentiment}</Badge>
                </div>
              )}

              {lead.source && (
                <div>
                  <p className="text-sm font-medium mb-1">Source</p>
                  <p className="text-sm text-muted-foreground">{lead.source}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-1">Last Contact</p>
                <p className="text-sm text-muted-foreground">
                  {lead.last_contact_at
                    ? formatDistanceToNow(new Date(lead.last_contact_at), { addSuffix: true })
                    : 'Never'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Created</p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </p>
              </div>
            </CardContent>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {lead.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Activity, Tasks, Notes */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-6">
              {leadId && <ActivityTimeline leadId={leadId} />}
            </TabsContent>

            <TabsContent value="tasks" className="mt-6">
              {leadId && <TaskList leadId={leadId} />}
            </TabsContent>

            <TabsContent value="notes" className="mt-6">
              {leadId && <NotesList leadId={leadId} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
