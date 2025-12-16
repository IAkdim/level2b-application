import { useState, useEffect } from "react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { getMeetings, syncCalendlyMeetings, type Meeting } from "@/lib/api/meetings"
import { isCalendlyConnected } from "@/lib/api/calendly"
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
    scheduled: 'default',
    confirmed: 'default',
    completed: 'secondary',
    canceled: 'destructive',
    no_show: 'destructive',
    rescheduled: 'outline'
  } as const
  return variants[status] || 'default'
}

function getStatusLabel(status: Meeting['status']): string {
  const labels = {
    scheduled: 'Gepland',
    confirmed: 'Bevestigd',
    completed: 'Voltooid',
    canceled: 'Geannuleerd',
    no_show: 'Niet verschenen',
    rescheduled: 'Verzet'
  }
  return labels[status] || status
}

export function Meetings() {
  const { selectedOrg } = useOrganization()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [calendlyConnected, setCalendlyConnected] = useState(false)

  useEffect(() => {
    if (selectedOrg) {
      loadMeetings()
      checkCalendlyConnection()
    }
  }, [selectedOrg])

  const loadMeetings = async () => {
    console.log('[Meetings] loadMeetings called')
    if (!selectedOrg) {
      console.log('[Meetings] No selectedOrg, returning')
      return
    }

    try {
      setIsLoading(true)
      console.log('[Meetings] Fetching meetings for org:', selectedOrg.id)
      const data = await getMeetings(selectedOrg.id)
      console.log('[Meetings] Meetings loaded:', data.length, 'meetings')
      console.log('[Meetings] First meeting:', data[0])
      setMeetings(data)
    } catch (error) {
      console.error('[Meetings] Error loading meetings:', error)
      toast.error('Fout bij laden van meetings')
    } finally {
      setIsLoading(false)
    }
  }

  const checkCalendlyConnection = async () => {
    if (!selectedOrg) return

    try {
      const connected = await isCalendlyConnected(selectedOrg.id)
      setCalendlyConnected(connected)
    } catch (error) {
      console.error('Error checking Calendly connection:', error)
    }
  }

  const handleSyncMeetings = async () => {
    console.log('[Meetings] handleSyncMeetings called')
    console.log('[Meetings] selectedOrg:', selectedOrg)
    
    if (!selectedOrg) return

    setIsSyncing(true)
    try {
      console.log('[Meetings] Calling syncCalendlyMeetings...')
      const result = await syncCalendlyMeetings(selectedOrg.id)
      console.log('[Meetings] Sync result:', JSON.stringify(result))
      console.log('[Meetings] Synced:', result.synced, 'Skipped:', result.skipped, 'Total:', result.total)
      
      // Always refresh the meetings list after sync
      await loadMeetings()
      
      if (result.synced > 0) {
        toast.success(`${result.synced} nieuwe meeting(s) gesynchroniseerd!`)
      } else if (result.skipped > 0) {
        toast.info(`${result.skipped} meeting(s) waren al gesynchroniseerd`)
      } else if (result.total > 0) {
        toast.info('Meetings gecheckt, geen wijzigingen')
      } else {
        toast.info('Geen meetings gevonden in Calendly')
      }
    } catch (error) {
      console.error('[Meetings] Error syncing meetings:', error)
      toast.error('Fout bij synchroniseren van meetings')
    } finally {
      console.log('[Meetings] Setting isSyncing to false')
      setIsSyncing(false)
    }
  }

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = 
      meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meeting.attendee_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (meeting.attendee_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (meeting.lead?.company?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            Automatische synchronisatie van Calendly meetings met je CRM
          </p>
        </div>
        <div className="flex space-x-3">
          {calendlyConnected && (
            <Button 
              onClick={handleSyncMeetings} 
              disabled={isSyncing}
              variant="outline"
              className="gap-2"
            >
              {isSyncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Synchroniseren...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync Calendly
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Calendly Connection Warning */}
      {!calendlyConnected && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CalendarCheck className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Calendly niet verbonden</p>
                <p className="text-sm text-amber-800 mt-1">
                  Verbind je Calendly account in de configuratie om meetings automatisch te synchroniseren.
                </p>
                <Button
                  onClick={() => window.location.href = '/configuration?tab=company'}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  Ga naar Configuratie
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totaal</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meetings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gepland</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.status === 'scheduled' || m.status === 'confirmed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voltooid</CardTitle>
            <Calendar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Geannuleerd</CardTitle>
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
                  <SelectValue placeholder="Alle statussen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="scheduled">Gepland</SelectItem>
                  <SelectItem value="confirmed">Bevestigd</SelectItem>
                  <SelectItem value="completed">Voltooid</SelectItem>
                  <SelectItem value="canceled">Geannuleerd</SelectItem>
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
            {isLoading ? 'Laden...' : `${filteredMeetings.length} van ${meetings.length} meetings`}
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
                  Geen meetings gevonden
                </p>
              ) : (
                filteredMeetings.map((meeting) => {
                  const meetingDate = new Date(meeting.scheduled_at)
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
                            <h3 className="font-medium">{meeting.title}</h3>
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <Badge variant={getStatusVariant(meeting.status)}>
                              {getStatusLabel(meeting.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                            <span>
                              {meeting.attendee_name || meeting.attendee_email}
                              {meeting.lead?.company && ` - ${meeting.lead.company}`}
                            </span>
                            <span>{format(meetingDate, 'PPP', { locale: nl })} om {format(meetingDate, 'HH:mm')}</span>
                            <span>{duration} min</span>
                          </div>
                          {meeting.description && (
                            <p className="text-sm text-muted-foreground">{meeting.description}</p>
                          )}
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