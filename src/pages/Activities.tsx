import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useOrgActivities } from "@/hooks/useActivities"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Mail,
  Phone,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Filter,
  X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { ActivityType } from "@/types/crm"

const activityIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  note: FileText,
  status_change: TrendingUp,
  task: CheckCircle2,
}

const activityColors: Record<ActivityType, string> = {
  email: "text-blue-500 bg-blue-500/10",
  call: "text-green-500 bg-green-500/10",
  meeting: "text-purple-500 bg-purple-500/10",
  note: "text-gray-500 bg-gray-500/10",
  status_change: "text-orange-500 bg-orange-500/10",
  task: "text-cyan-500 bg-cyan-500/10",
}

const activityLabels: Record<ActivityType, string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  status_change: "Status Change",
  task: "Task",
}

export function Activities() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  // Calculate date_from based on filter
  const dateFrom = (() => {
    const now = new Date()
    switch (dateFilter) {
      case "today":
        return new Date(now.setHours(0, 0, 0, 0)).toISOString()
      case "week":
        return new Date(now.setDate(now.getDate() - 7)).toISOString()
      case "month":
        return new Date(now.setMonth(now.getMonth() - 1)).toISOString()
      default:
        return undefined
    }
  })()

  const { data: activities = [], isLoading } = useOrgActivities({
    type: typeFilter.length > 0 ? typeFilter : undefined,
    dateFrom,
    limit: 100,
  })

  const toggleTypeFilter = (type: ActivityType) => {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const clearFilters = () => {
    setTypeFilter([])
    setDateFilter("all")
  }

  const hasActiveFilters = typeFilter.length > 0 || dateFilter !== "all"

  const renderActivityIcon = (type: ActivityType) => {
    const Icon = activityIcons[type]
    const colorClass = activityColors[type]
    return (
      <div className={`flex-shrink-0 rounded-full p-2 ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground mt-1">
            Track all interactions across your organization
          </p>
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-5 min-w-5">
              {typeFilter.length + (dateFilter !== "all" ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-border/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filters</CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Activity Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Activity Type</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(activityLabels) as ActivityType[]).map((type) => {
                  const Icon = activityIcons[type]
                  const isSelected = typeFilter.includes(type)
                  return (
                    <Button
                      key={type}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleTypeFilter(type)}
                      className="gap-2"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {activityLabels[type]}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activities Feed */}
      <Card className="border-border/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Activity Feed</CardTitle>
              <CardDescription className="mt-1">
                {activities.length} {activities.length === 1 ? "activity" : "activities"}
                {hasActiveFilters && " matching your filters"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-16 px-4">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-1">
                {hasActiveFilters ? "No activities found" : "No activities yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Activities will appear here as your team interacts with leads"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-4 p-4 rounded-lg border border-border/40 hover:border-border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/outreach/leads/${activity.lead_id}`)}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 pt-1">
                    {renderActivityIcon(activity.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        {/* Activity Header */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {activityLabels[activity.type]}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        {/* Subject */}
                        {activity.subject && (
                          <h4 className="font-medium text-sm mb-1">{activity.subject}</h4>
                        )}

                        {/* Lead Info */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">
                            {(activity as any).lead?.name}
                          </span>
                          {(activity as any).lead?.company && (
                            <>
                              <span>•</span>
                              <span>{(activity as any).lead.company}</span>
                            </>
                          )}
                        </div>

                        {/* Content */}
                        {activity.content && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {activity.content}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Creator */}
                    {activity.creator && (
                      <div className="text-xs text-muted-foreground mt-2">
                        by {activity.creator.full_name || activity.creator.email}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
