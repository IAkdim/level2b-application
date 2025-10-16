import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar, List, Search, Plus, Clock, User, MapPin, Video } from "lucide-react"

interface Meeting {
  id: string
  title: string
  prospectName: string
  prospectEmail: string
  company: string
  date: string
  time: string
  duration: number // in minutes
  type: "video" | "phone" | "in_person"
  status: "scheduled" | "confirmed" | "completed" | "cancelled"
  location?: string
  meetingUrl?: string
  notes?: string
  calendarEvent?: string
}

const mockMeetings: Meeting[] = [
  {
    id: "1",
    title: "Product Demo with Tech Corp",
    prospectName: "John Doe",
    prospectEmail: "john@techcorp.com",
    company: "Tech Corp",
    date: "2025-10-10",
    time: "14:00",
    duration: 30,
    type: "video", 
    status: "confirmed",
    meetingUrl: "https://zoom.us/j/123456789",
    notes: "Interested in enterprise package. Focus on scalability features."
  },
  {
    id: "2",
    title: "Partnership Discussion",
    prospectName: "Sarah Wilson",
    prospectEmail: "sarah@startup.io", 
    company: "Startup Inc",
    date: "2025-10-11",
    time: "10:30",
    duration: 45,
    type: "video",
    status: "scheduled",
    meetingUrl: "https://teams.microsoft.com/l/meetup-join/123",
    notes: "Potential integration partnership. Prepare API documentation."
  },
  {
    id: "3",
    title: "Coffee Chat",
    prospectName: "Mike Johnson", 
    prospectEmail: "mike@enterprise.com",
    company: "Enterprise Ltd",
    date: "2025-10-12",
    time: "09:00",
    duration: 60,
    type: "in_person",
    status: "confirmed",
    location: "Coffee Lab, Downtown",
    notes: "Casual introduction meeting. Discuss pain points."
  },
  {
    id: "4",
    title: "Follow-up Call",
    prospectName: "Lisa Chen",
    prospectEmail: "lisa@agency.com",
    company: "Creative Agency", 
    date: "2025-10-15",
    time: "15:30",
    duration: 30,
    type: "phone",
    status: "scheduled",
    notes: "Follow-up on proposal. Answer pricing questions."
  }
]

const typeIcons = {
  video: Video,
  phone: Clock,
  in_person: MapPin
}

function getStatusVariant(status: Meeting['status']) {
  const variants = {
    scheduled: 'info',
    confirmed: 'success',
    completed: 'secondary',
    cancelled: 'destructive'
  } as const
  return variants[status]
}

export function Meetings() {
  const [meetings, _setMeetings] = useState<Meeting[]>(mockMeetings)
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedWeek, setSelectedWeek] = useState(new Date())

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = 
      meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.prospectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.company.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || meeting.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Generate calendar week days
  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday start
    startOfWeek.setDate(diff)
    
    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek)
      currentDay.setDate(startOfWeek.getDate() + i)
      weekDays.push(currentDay)
    }
    return weekDays
  }

  const weekDays = getWeekDays(selectedWeek)

  const getMeetingsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    return filteredMeetings.filter(meeting => meeting.date === dateString)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            Beheer je sales meetings en synchroniseer met Calendly
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-r-none"
            >
              <List className="mr-2 h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="rounded-l-none"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Calendar
            </Button>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meetings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => {
                const meetingDate = new Date(m.date)
                const weekStart = weekDays[0]
                const weekEnd = weekDays[6]
                return meetingDate >= weekStart && meetingDate <= weekEnd
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.status === "confirmed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.length > 0 ? Math.round((meetings.filter(m => m.status === "completed").length / meetings.length) * 100) : 0}%
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
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content based on view mode */}
      {viewMode === "list" ? (
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle>Meetings List</CardTitle>
            <CardDescription>
              {filteredMeetings.length} of {meetings.length} meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredMeetings.map((meeting) => {
                const TypeIcon = typeIcons[meeting.type]
                return (
                  <div key={meeting.id} className="border rounded-lg p-4 hover:bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium">{meeting.title}</h3>
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <Badge variant={getStatusVariant(meeting.status)}>
                            {meeting.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                          <span>{meeting.prospectName} - {meeting.company}</span>
                          <span>{meeting.date} at {meeting.time}</span>
                          <span>{meeting.duration} min</span>
                        </div>
                        {meeting.notes && (
                          <p className="text-sm text-muted-foreground">{meeting.notes}</p>
                        )}
                        {meeting.meetingUrl && (
                          <a href={meeting.meetingUrl} className="text-sm text-primary hover:underline block mt-1">
                            Join Meeting
                          </a>
                        )}
                        {meeting.location && (
                          <p className="text-sm text-muted-foreground mt-1">📍 {meeting.location}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">Edit</Button>
                        <Button variant="ghost" size="sm">Cancel</Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Calendar View */
        <Card>
          <CardHeader>
            <CardTitle>Weekly Calendar</CardTitle>
            <CardDescription>
              Week of {weekDays[0].toLocaleDateString()} - {weekDays[6].toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Week Navigation */}
            <div className="flex justify-between items-center mb-6">
              <Button
                variant="outline"
                onClick={() => {
                  const prevWeek = new Date(selectedWeek)
                  prevWeek.setDate(selectedWeek.getDate() - 7)
                  setSelectedWeek(prevWeek)
                }}
              >
                Previous Week
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedWeek(new Date())}
              >
                This Week
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const nextWeek = new Date(selectedWeek)
                  nextWeek.setDate(selectedWeek.getDate() + 7)
                  setSelectedWeek(nextWeek)
                }}
              >
                Next Week
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-4">
              {weekDays.map((day, index) => {
                const dayMeetings = getMeetingsForDate(day)
                const isToday = day.toDateString() === new Date().toDateString()
                
                return (
                  <div key={index} className={`border rounded-lg p-3 min-h-[200px] ${isToday ? 'bg-blue-50 border-blue-200' : ''}`}>
                    <div className="font-medium text-sm mb-2">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="font-bold text-lg mb-3">
                      {day.getDate()}
                    </div>
                    <div className="space-y-2">
                      {dayMeetings.map((meeting) => {
                        const TypeIcon = typeIcons[meeting.type]
                        return (
                          <div key={meeting.id} className="bg-white border rounded p-2 text-xs">
                            <div className="flex items-center gap-1 mb-1">
                              <TypeIcon className="h-3 w-3" />
                              <span className="font-medium">{meeting.time}</span>
                            </div>
                            <div className="font-medium text-gray-900 mb-1">
                              {meeting.title}
                            </div>
                            <div className="text-gray-600">
                              {meeting.prospectName}
                            </div>
                            <Badge variant={getStatusVariant(meeting.status)} className="text-xs">
                              {meeting.status}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}