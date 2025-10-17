import { useState } from "react"
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import type { Task, TaskStatus, TaskPriority } from "@/types/crm"

interface TaskListProps {
  leadId?: string
}

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-gray-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
}

export function TaskList({ leadId }: TaskListProps) {
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium")
  const [taskDueDate, setTaskDueDate] = useState("")

  const { data: tasks = [], isLoading } = useTasks(leadId ? { lead_id: leadId } : undefined)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return

    try {
      await createTask.mutateAsync({
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
        due_date: taskDueDate || undefined,
        lead_id: leadId || undefined,
      })

      // Reset form
      setTaskTitle("")
      setTaskDescription("")
      setTaskPriority("medium")
      setTaskDueDate("")
      setShowAddTask(false)
    } catch (error) {
      console.error("Failed to create task:", error)
    }
  }

  const handleToggleTask = async (task: Task) => {
    const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed"

    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        input: { status: newStatus },
      })
    } catch (error) {
      console.error("Failed to update task:", error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return

    try {
      await deleteTask.mutateAsync(taskId)
    } catch (error) {
      console.error("Failed to delete task:", error)
    }
  }

  const pendingTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled")
  const completedTasks = tasks.filter(t => t.status === "completed")

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
        <CardTitle>Tasks</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddTask(!showAddTask)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </CardHeader>
      <CardContent>
        {/* Add Task Form */}
        {showAddTask && (
          <div className="mb-6 p-4 border border-border/40 rounded-lg space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                placeholder="Task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (optional)</label>
              <Textarea
                placeholder="Task description..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Due Date (optional)</label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddTask(false)
                  setTaskTitle("")
                  setTaskDescription("")
                  setTaskPriority("medium")
                  setTaskDueDate("")
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddTask}
                disabled={!taskTitle.trim() || createTask.isPending}
              >
                {createTask.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Task"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Task Lists */}
        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground">
              Create tasks to track follow-ups and to-dos
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">
                  To Do ({pendingTasks.length})
                </h3>
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggleTask}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                  Completed ({completedTasks.length})
                </h3>
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggleTask}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TaskItemProps {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (taskId: string) => void
}

function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const isCompleted = task.status === "completed"
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted

  return (
    <div className="flex items-start gap-3 p-3 border border-border/30 rounded-lg hover:bg-muted/30 transition-colors">
      <button
        onClick={() => onToggle(task)}
        className="flex-shrink-0 mt-0.5"
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {task.description && (
          <p className={`text-sm mt-1 ${isCompleted ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge
            variant="secondary"
            className={`text-xs ${priorityColors[task.priority]} text-white`}
          >
            {task.priority}
          </Badge>

          {task.due_date && (
            <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(task.due_date), "MMM d, yyyy")}
            </div>
          )}

          {task.lead && (
            <Badge variant="outline" className="text-xs">
              {task.lead.name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
