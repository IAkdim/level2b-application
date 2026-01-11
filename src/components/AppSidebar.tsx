import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  Calendar,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  MessageSquare,
  Building2,
  Send,
  Star,
} from "lucide-react"
import { eventBus } from "@/lib/eventBus"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { submitFeedback } from '@/lib/api/feedback'
import { useOrganization } from '@/contexts/OrganizationContext'
import type { FeedbackType } from '@/types/crm'

interface NavItem {
  name: string
  href: string
  icon: any
  badge?: number
  shortcut?: string
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Home, shortcut: "⌘D" },
  { name: "Outreach", href: "/outreach/leads", icon: Users, shortcut: "⌘O" },
  { name: "Meetings", href: "/meetings", icon: Calendar, shortcut: "⌘M" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, shortcut: "⌘A" },
  { name: "Organization", href: "/organization", icon: Building2, shortcut: "⌘G" },
  { name: "Configuration", href: "/configuration", icon: Settings, shortcut: "⌘," },
]

export function AppSidebar() {
  const location = useLocation()
  const { selectedOrg } = useOrganization()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('other')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  // Load collapsed state from localStorage
  useEffect(() => {
    const collapsed = localStorage.getItem("sidebar-collapsed")
    if (collapsed) {
      setIsCollapsed(JSON.parse(collapsed))
    }
  }, [])

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState))
  }

  // Check if item is active
  const isItemActive = (item: NavItem) => {
    if (item.href === "/" && location.pathname === "/") return true
    if (item.href !== "/" && location.pathname.startsWith(item.href)) return true
    return false
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      toast.error('Please enter a message')
      return
    }

    if (!selectedOrg?.id) {
      toast.error('No organisation selected')
      return
    }

    setIsSubmittingFeedback(true)
    try {
      await submitFeedback(selectedOrg.id, {
        type: feedbackType,
        message: feedbackMessage.trim(),
        rating: feedbackRating > 0 ? feedbackRating : undefined,
        page_url: window.location.href,
      })
      
      toast.success('Thank you for your feedback!')
      setShowFeedbackDialog(false)
      setFeedbackMessage('')
      setFeedbackType('other')
      setFeedbackRating(0)
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error('Could not send feedback')
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  // Render navigation item
  const renderNavItem = (item: NavItem) => {
    const isActive = isItemActive(item)

const content = (
  <Link
    to={item.href}
    className={cn(
      "group flex items-center rounded-lg transition-all duration-200",
      isCollapsed
        ? "justify-center p-2.5" // centered layout when collapsed
        : "px-3 py-2.5 text-sm font-medium", // standard layout when expanded
      isActive
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
    aria-current={isActive ? "page" : undefined}
  >
    <item.icon
      className={cn(
        "h-4 w-4 flex-shrink-0 transition-colors", // slightly smaller icons globally
        !isCollapsed && "mr-3" // spacing for expanded layout
      )}
      aria-hidden="true"
    />
    {!isCollapsed && (
      <>
        <span className="flex-1">{item.name}</span>
        {item.badge && (
          <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
            {item.badge}
          </Badge>
        )}
      </>
    )}
  </Link>
)


    if (isCollapsed) {
      return (
        <Tooltip key={item.name} delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.name}
            {item.shortcut && (
              <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {item.shortcut}
              </kbd>
            )}
          </TooltipContent>
        </Tooltip>
      )
    }

    return <div key={item.name}>{content}</div>
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex h-full flex-col border-r border-border/60 bg-background transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-border/60">
          {!isCollapsed && (
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Level2B
            </h1>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            className={cn("ml-auto hover:bg-muted", isCollapsed && "mx-auto")}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="space-y-1" role="navigation" aria-label="Main navigation">
            {navigation.map((item) => renderNavItem(item))}
          </nav>
        </ScrollArea>

        <Separator />

        {/* Footer Actions */}
        <div className="p-3 space-y-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => eventBus.emit("guide:open")}
                className={cn("w-full", isCollapsed && "px-0")}
              >
                <BookOpen className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                {!isCollapsed && "View Guide"}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">View Guide</TooltipContent>
            )}
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full", isCollapsed && "px-0")}
                onClick={() => setShowFeedbackDialog(true)}
              >
                <MessageSquare className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                {!isCollapsed && "Feedback"}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">Send feedback</TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Your Feedback</DialogTitle>
            <DialogDescription>
              Help us improve Level2B by sharing your feedback
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-2">
              <Label htmlFor="feedback-type">Type</Label>
              <Select value={feedbackType} onValueChange={(val) => setFeedbackType(val as FeedbackType)}>
                <SelectTrigger id="feedback-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">🐛 Bug Report</SelectItem>
                  <SelectItem value="feature">✨ Feature Request</SelectItem>
                  <SelectItem value="improvement">💡 Improvement</SelectItem>
                  <SelectItem value="other">💬 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>How satisfied are you with Level2B?</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= feedbackRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Message</Label>
              <Textarea
                id="feedback-message"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Share your thoughts, suggestions, or issues..."
                rows={6}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={() => setShowFeedbackDialog(false)}
                variant="outline"
                disabled={isSubmittingFeedback}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitFeedback} disabled={isSubmittingFeedback}>
                <Send className="mr-2 h-4 w-4" />
                {isSubmittingFeedback ? 'Sending...' : 'Send Feedback'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}