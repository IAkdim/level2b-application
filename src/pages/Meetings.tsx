import { useState, useEffect, useCallback } from "react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useAuth } from "@/contexts/AuthContext"
import { getUserMeetings, syncCalendlyMeetings, type Meeting } from "@/lib/api/meetings"
import { isCalendlyConnected } from "@/lib/api/calendly"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, Search, RefreshCw, ExternalLink, CalendarCheck, Video, Phone, MapPin, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, isPast, isFuture, isToday, parseISO } from "date-fns"
import { nl } from "date-fns/locale"
import { ENABLE_MOCK_DATA, MOCK_MEETINGS } from "@/lib/mockData"

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
  const { selectedOrg } = useOrganization()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [timeFilter, setTimeFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "agenda">("list")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendlyConnected, setCalendlyConnected] = useState(false)

  const loadMeetings = useCallback(async () => {
    console.log('[Meetings] loadMeetings called')
    if (!user) {
      console.log('[Meetings] No user, returning')
      return
    }

    try {
      setIsLoading(true)
      console.log('[Meetings] Fetching meetings for user:', user.id)
      const data = await getUserMeetings(user.id, {
        includeShared: !!selectedOrg?.id,
        orgId: selectedOrg?.id
      })
      console.log('[Meetings] Meetings loaded:', data.length, 'meetings')
      console.log('[Meetings] First meeting:', data[0])
      setMeetings(data)
    } catch (error) {
      console.error('[Meetings] Error loading meetings:', error)
      toast.error('Error loading meetings')
    } finally {
      setIsLoading(false)
    }
  }, [user, selectedOrg?.id])

  const checkCalendlyConnection = useCallback(async () => {
    // Calendly connection is org-specific, only check if org is selected
    if (!selectedOrg) {
      setCalendlyConnected(false)
      return
    }

    try {
      const connected = await isCalendlyConnected(selectedOrg.id)
      setCalendlyConnected(connected)
    } catch (error) {
      console.error('Error checking Calendly connection:', error)
    }
  }, [selectedOrg])

  useEffect(() => {
    loadMeetings()
    checkCalendlyConnection()
  }, [loadMeetings, checkCalendlyConnection])

  const handleSyncMeetings = async () => {
    console.log('[Meetings] handleSyncMeetings called')
    console.log('[Meetings] selectedOrg:', selectedOrg)

    // Calendly sync requires an organization
    if (!selectedOrg) {
      toast.error('Select an organization to sync Calendly meetings')
      return
    }

    setIsSyncing(true)
    try {
      const result = await syncCalendlyMeetings(selectedOrg.id)
      
      // Always refresh the meetings list after sync
      await loadMeetings()
      
      if (result.synced > 0) {
        toast.success(`${result.synced} new meeting(s) synchronised!`)
      } else if (result.skipped > 0) {
        toast.info(`${result.skipped} meeting(s) were already synchronised`)
      } else if (result.total > 0) {
        toast.info('Meetings checked, no changes')
      } else {
        toast.info('No meetings found in Calendly')
      }
    } catch (error) {
      console.error('[Meetings] Error syncing meetings:', error)
      toast.error('Error synchronising meetings')
    } finally {
      setIsSyncing(false)
    }
  }

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = 
      meeting.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meeting.invitee_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (meeting.invitee_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (meeting.lead?.company?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter
    
    const meetingDate = new Date(meeting.start_time)
    const matchesTime = timeFilter === "all" || 
      (timeFilter === "upcoming" && (isFuture(meetingDate) || isToday(meetingDate))) ||
      (timeFilter === "past" && isPast(meetingDate) && !isToday(meetingDate))
    
    return matchesSearch && matchesStatus && matchesTime
  })

  // Group meetings by day for agenda view
  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { locale: nl })
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push(addDays(start, i))
    }
    return days
  }

  const groupMeetingsByDay = (meetings: Meeting[]) => {
    const grouped: { [key: string]: Meeting[] } = {}
    
    meetings.forEach(meeting => {
      const dateKey = format(new Date(meeting.start_time), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(meeting)
    })
    
    return grouped
  }

  const handlePreviousWeek = () => {
    setSelectedDate(prev => subWeeks(prev, 1))
  }

  const handleNextWeek = () => {
    setSelectedDate(prev => addWeeks(prev, 1))
  }

  const handleToday = () => {
    setSelectedDate(new Date())
  }

  const weekDays = getWeekDays()
  const groupedMeetings = groupMeetingsByDay(filteredMeetings)

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Automatic synchronisation of Calendly meetings with your CRM
          </p>
        </div>
        <div className="flex gap-2">
          {calendlyConnected && (
            <Button 
              onClick={handleSyncMeetings} 
              disabled={isSyncing}
              variant="outline"
              className="gap-2"
            >
              {isSyncing ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin"></div>
                  Synchronising...
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
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-warning/10 p-2">
                <CalendarCheck className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Calendly not connected</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Connect your Calendly account in configuration to automatically synchronise meetings.
                </p>
                <Button
                  onClick={() => window.location.href = '/configuration?tab=company'}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  Go to Configuration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
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
          <div className="flex items-center justify-between">
            <CardTitle>Filters & View</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === "agenda" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("agenda")}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Week Agenda
              </Button>
            </div>
          </div>
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
                  placeholder="Search by name, email, or company..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-40">
              <Label htmlFor="time-filter" className="sr-only">
                Filter by time
              </Label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger id="time-filter">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
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
      {viewMode === "list" ? (
        <Card>
          <CardHeader>
            <CardTitle>Meetings List</CardTitle>
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
                  filteredMeetings
                    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                    .map((meeting) => {
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

                      const isPastMeeting = isPast(meetingDate) && !isToday(meetingDate)

                      return (
                        <div 
                          key={meeting.id} 
                          className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                            isPastMeeting ? 'opacity-50 bg-muted/20' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className={`font-medium ${isPastMeeting ? 'text-muted-foreground' : ''}`}>
                                  {meeting.name}
                                </h3>
                                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                <Badge variant={getStatusVariant(meeting.status as any)}>
                                  {getStatusLabel(meeting.status as any)}
                                </Badge>
                                {isPastMeeting && (
                                  <Badge variant="outline" className="text-xs">
                                    Completed
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                                <span>
                                  {meeting.invitee_name || meeting.invitee_email}
                                  {meeting.lead?.company && ` - ${meeting.lead.company}`}
                                </span>
                                <span>{format(meetingDate, 'PPP', { locale: nl })} at {format(meetingDate, 'HH:mm')}</span>
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
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Week Agenda</CardTitle>
                <CardDescription>
                  {format(weekDays[0], 'PPP', { locale: nl })} - {format(weekDays[6], 'PPP', { locale: nl })}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousWeek}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(selectedDate, 'PPP', { locale: nl })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="p-3">
                      <Input
                        type="date"
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedDate(parseISO(e.target.value))
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextWeek}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, idx) => {
                  const dateKey = format(day, 'yyyy-MM-dd')
                  const dayMeetings = groupedMeetings[dateKey] || []
                  const isCurrentDay = isToday(day)
                  const isPastDay = isPast(day) && !isToday(day)

                  return (
                    <div 
                      key={idx} 
                      className={`border rounded-lg p-3 min-h-[200px] ${
                        isCurrentDay ? 'bg-primary/5 border-primary' : ''
                      } ${isPastDay ? 'bg-muted/30' : ''}`}
                    >
                      <div className="text-center mb-3">
                        <div className={`text-xs font-medium text-muted-foreground uppercase ${
                          isCurrentDay ? 'text-primary' : ''
                        }`}>
                          {format(day, 'EEE', { locale: nl })}
                        </div>
                        <div className={`text-lg font-bold ${
                          isCurrentDay ? 'text-primary' : isPastDay ? 'text-muted-foreground' : ''
                        }`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {dayMeetings.length === 0 ? (
                          <p className="text-xs text-center text-muted-foreground py-4">
                            No meetings
                          </p>
                        ) : (
                          dayMeetings
                            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                            .map((meeting) => {
                              const meetingDate = new Date(meeting.start_time)
                              const TypeIcon = meeting.location?.includes('zoom') || meeting.location?.includes('meet') 
                                ? Video 
                                : meeting.location?.includes('phone') 
                                  ? Phone 
                                  : MapPin

                              return (
                                <div 
                                  key={meeting.id}
                                  className={`text-xs p-2 rounded border bg-background hover:bg-muted/50 cursor-pointer ${
                                    meeting.status === 'canceled' ? 'opacity-50' : ''
                                  }`}
                                  title={`${meeting.name} - ${meeting.invitee_name || meeting.invitee_email}`}
                                >
                                  <div className="flex items-center gap-1 mb-1">
                                    <TypeIcon className="h-3 w-3 flex-shrink-0" />
                                    <span className="font-medium truncate">
                                      {format(meetingDate, 'HH:mm')}
                                    </span>
                                  </div>
                                  <p className="truncate text-muted-foreground">
                                    {meeting.invitee_name || meeting.invitee_email?.split('@')[0]}
                                  </p>
                                  <p className="truncate font-medium">
                                    {meeting.name}
                                  </p>
                                </div>
                              )
                            })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}