import { Bell, Search, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Settings, User, LogOut } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Notification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type: "info" | "success" | "warning" | "error"
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    title: "New reply received",
    message: "John Doe replied to your email about partnership",
    time: "2 minutes ago",
    read: false,
    type: "info",
  },
  {
    id: "2",
    title: "Meeting scheduled",
    message: "Sarah Wilson scheduled a meeting for tomorrow at 2 PM",
    time: "1 hour ago",
    read: false,
    type: "success",
  },
  {
    id: "3",
    title: "Campaign completed",
    message: "Your 'Q1 Outreach' campaign has finished sending to 50 leads",
    time: "3 hours ago",
    read: true,
    type: "success",
  },
  {
    id: "4",
    title: "Email bounced",
    message: "Email to mike@company.com bounced. Please verify the address.",
    time: "5 hours ago",
    read: false,
    type: "error",
  },
  {
    id: "5",
    title: "Daily limit approaching",
    message: "You've sent 45 of 50 daily emails",
    time: "Yesterday",
    read: true,
    type: "warning",
  },
]

export function TopBar() {
  const unreadCount = mockNotifications.filter((n) => !n.read).length

  const getNotificationIcon = (type: Notification["type"]) => {
    const baseClasses = "h-2 w-2 rounded-full"
    switch (type) {
      case "success":
        return <div className={`${baseClasses} bg-green-500`} />
      case "warning":
        return <div className={`${baseClasses} bg-yellow-500`} />
      case "error":
        return <div className={`${baseClasses} bg-red-500`} />
      default:
        return <div className={`${baseClasses} bg-blue-500`} />
    }
  }

  return (
    <TooltipProvider>
      <div className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-6">
          {/* Left side - could add breadcrumbs here */}
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              AI Email Outreach Platform
            </h2>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Search">
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search <kbd className="ml-2 text-xs">⌘K</kbd></p>
              </TooltipContent>
            </Tooltip>

            {/* Help */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Help">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Help & Documentation</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 pb-2">
                  <h3 className="font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      Mark all read
                    </Button>
                  )}
                </div>
                <Separator />
                <ScrollArea className="h-[400px]">
                  <div className="p-2">
                    {mockNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No notifications</p>
                      </div>
                    ) : (
                      mockNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="flex gap-3">
                            <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-none">
                                  {notification.title}
                                </p>
                                {!notification.read && (
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {notification.time}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <Separator />
                <div className="p-2">
                  <Button variant="ghost" className="w-full justify-center text-xs" size="sm">
                    View all notifications
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6" />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">John Doe</p>
                    <p className="text-xs text-muted-foreground">john@company.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
