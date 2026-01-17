import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { getUserMeetings, type Meeting } from "@/lib/api/meetings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Search, RefreshCw, ExternalLink, CalendarCheck, Video, Phone, MapPin } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { nl } from "date-fns/locale"

function getStatusVariant(status: Meeting['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants = {
    active: 'default',
    canceled: 'destructive'
  } as const
  return variants[status] || 'default'
}

function getStatusLabel(status: Meeting['status']): string {
  const labels = {
    active: 'Active',
    canceled: 'Cancelled'
  }
  return labels[status] || status
}

export function Meetings() {
  const { user } = useAuth()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const loadMeetings = useCallback(async () => {
    console.log('[Meetings] loadMeetings called')
    if (!user) {
      console.log('[Meetings] No user, returning')
      return
    }

    try {
      setIsLoading(true)
      console.log('[Meetings] Fetching meetings for user:', user.id)
      const data = await getUserMeetings(user.id)
      console.log('[Meetings] Meetings loaded:', data.length, 'meetings')
      console.log('[Meetings] First meeting:', data[0])
      setMeetings(data)
    } catch (error) {
      console.error('[Meetings] Error loading meetings:', error)
      toast.error('Error loading meetings')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = 
      meeting.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meeting.invitee_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (meeting.invitee_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (meeting.lead?.company?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Automatic synchronisation of Calendly meetings with your CRM
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="group hover:shadow-lg transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <div className="rounded-lg bg-muted p-2 group-hover:bg-primary/10 transition-colors">
              <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meetings.length}</div>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-lg transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
            <div className="rounded-lg bg-muted p-2 group-hover:bg-info/10 transition-colors">
              <Calendar className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Calendar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => new Date(m.end_time) < new Date()).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.status === 'canceled').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <Label htmlFor="search-meetings" className="sr-only">
                Search meetings
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-meetings"
                  type="text"
                  placeholder="Search meetings..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="status-filter" className="sr-only">
                Filter by status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
<SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content based on view mode */}
      <Card>
        <CardHeader>
          <CardTitle>Meetings</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading...' : `${filteredMeetings.length} of ${meetings.length} meetings`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMeetings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No meetings found
                </p>
              ) : (
                filteredMeetings.map((meeting) => {
                  const meetingDate = new Date(meeting.start_time)
                  const endDate = meeting.end_time ? new Date(meeting.end_time) : null
                  const duration = endDate 
                    ? Math.round((endDate.getTime() - meetingDate.getTime()) / 60000)
                    : 30
                  
                  const TypeIcon = meeting.location?.includes('zoom') || meeting.location?.includes('meet') 
                    ? Video 
                    : meeting.location?.includes('phone') 
                      ? Phone 
                      : MapPin

                  return (
                    <div key={meeting.id} className="border rounded-lg p-4 hover:bg-muted/50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-medium">{meeting.name}</h3>
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <Badge variant={getStatusVariant(meeting.status as any)}>
                              {getStatusLabel(meeting.status as any)}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                            <span>
                              {meeting.invitee_name || meeting.invitee_email}
                              {meeting.lead?.company && ` - ${meeting.lead.company}`}
                            </span>
                            <span>{format(meetingDate, 'PPP', { locale: nl })} om {format(meetingDate, 'HH:mm')}</span>
                            <span>{duration} min</span>
                          </div>
                          {meeting.location && meeting.location.startsWith('http') && (
                            <a 
                              href={meeting.location} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              Join Meeting <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {meeting.location && !meeting.location.startsWith('http') && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {meeting.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}