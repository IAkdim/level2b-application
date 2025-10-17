import { useState } from "react"
import { useActivities, useCreateActivity } from "@/hooks/useActivities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  Plus,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Activity, ActivityType } from "@/types/crm"

interface ActivityTimelineProps {
  leadId: string
}

const activityIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  note: FileText,
  status_change: TrendingUp,
  task: CheckCircle2,
}

const activityColors: Record<ActivityType, string> = {
  email: "text-blue-500",
  call: "text-green-500",
  meeting: "text-purple-500",
  note: "text-gray-500",
  status_change: "text-orange-500",
  task: "text-cyan-500",
}

export function ActivityTimeline({ leadId }: ActivityTimelineProps) {
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [activityType, setActivityType] = useState<ActivityType>("note")
  const [activityContent, setActivityContent] = useState("")
  const [activitySubject, setActivitySubject] = useState("")

  const { data: activities = [], isLoading } = useActivities(leadId)
  const createActivity = useCreateActivity()

  const handleAddActivity = async () => {
    if (!activityContent.trim()) return

    try {
      await createActivity.mutateAsync({
        lead_id: leadId,
        type: activityType,
        subject: activitySubject.trim() || undefined,
        content: activityContent.trim(),
      })

      // Reset form
      setActivityContent("")
      setActivitySubject("")
      setShowAddActivity(false)
    } catch (error) {
      console.error("Failed to create activity:", error)
    }
  }

  const renderActivityIcon = (type: ActivityType) => {
    const Icon = activityIcons[type]
    const colorClass = activityColors[type]
    return (
      <div className={`flex-shrink-0 ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Activity Timeline</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddActivity(!showAddActivity)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </Button>
      </CardHeader>
      <CardContent>
        {/* Add Activity Form */}
        {showAddActivity && (
          <div className="mb-6 p-4 border border-border/40 rounded-lg space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Subject (optional)</label>
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Brief subject..."
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Content</label>
              <Textarea
                placeholder="Describe the activity..."
                value={activityContent}
                onChange={(e) => setActivityContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddActivity(false)
                  setActivityContent("")
                  setActivitySubject("")
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddActivity}
                disabled={!activityContent.trim() || createActivity.isPending}
              >
                {createActivity.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Activity"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Timeline */}
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No activities yet</p>
            <p className="text-sm text-muted-foreground">
              Start tracking interactions with this lead
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activities.map((activity, index) => (
              <div key={activity.id} className="flex gap-4">
                {/* Icon */}
                <div className="relative">
                  {renderActivityIcon(activity.type)}
                  {index < activities.length - 1 && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-full bg-border" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {activity.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {activity.subject && (
                        <h4 className="font-medium text-sm">{activity.subject}</h4>
                      )}
                    </div>
                  </div>

                  {activity.content && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {activity.content}
                    </p>
                  )}

                  {activity.creator && (
                    <div className="mt-2 text-xs text-muted-foreground">
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
  )
}
