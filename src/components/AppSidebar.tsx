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
} from "lucide-react"
import { eventBus } from "@/lib/eventBus"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  { name: "Meetings", href: "/meetings", icon: Calendar, shortcut: "⌘M", badge: 2 },
  { name: "Analytics", href: "/analytics", icon: BarChart3, shortcut: "⌘A" },
  { name: "Organization", href: "/organization", icon: Building2, shortcut: "⌘G" },
  { name: "Configuration", href: "/configuration", icon: Settings, shortcut: "⌘," },
]

export function AppSidebar() {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

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

  // Render navigation item
  const renderNavItem = (item: NavItem) => {
    const isActive = isItemActive(item)

const content = (
  <Link
    to={item.href}
    className={cn(
      "group flex items-center rounded-lg transition-colors",
      isCollapsed
        ? "justify-center p-2" // centered layout when collapsed
        : "px-3 py-2 text-sm font-medium", // standard layout when expanded
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    )}
    aria-current={isActive ? "page" : undefined}
  >
    <item.icon
      className={cn(
        "h-4 w-4 flex-shrink-0", // slightly smaller icons globally
        !isCollapsed && "mr-3" // spacing for expanded layout
      )}
      aria-hidden="true"
    />
    {!isCollapsed && (
      <>
        <span className="flex-1">{item.name}</span>
        {item.badge && (
          <Badge variant="destructive" className="ml-auto">
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
          "flex h-full flex-col border-r bg-background transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {!isCollapsed && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Level2B
            </h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn("ml-auto", isCollapsed && "mx-auto")}
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
                {!isCollapsed && "Bekijk guide"}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">Bekijk guide</TooltipContent>
            )}
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full", isCollapsed && "px-0")}
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
    </TooltipProvider>
  )
}