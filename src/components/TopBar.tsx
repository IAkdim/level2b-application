import { Bell, Search, HelpCircle, Building2, ChevronDown, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from "@/lib/supabaseClient"
import { reAuthenticateWithGoogle } from "@/lib/api/reauth"
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
import { Settings, User, LogOut, Plus, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useEffect } from "react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { OrganizationSelector } from "@/components/OrganizationSelector"
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  subscribeToNotifications,
  type Notification 
} from "@/lib/api/notifications"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { getUserSettings } from "@/lib/api/userSettings"

export function TopBar() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState<string>('')
  const [orgSelectorOpen, setOrgSelectorOpen] = useState(false)
  const { selectedOrg, userOrgs, setOrganization } = useOrganization()

  function getNotificationIcon(type: Notification["type"]) {
    const baseClasses = "h-2 w-2 rounded-full"
    switch (type) {
      case 'meeting_scheduled':
      case 'success':
        return <div className={`${baseClasses} bg-green-500`} />
      case 'daily_limit_warning':
      case 'warning':
        return <div className={`${baseClasses} bg-yellow-500`} />
      case 'email_bounced':
      case 'meeting_canceled':
      case 'error':
        return <div className={`${baseClasses} bg-red-500`} />
      default:
        return <div className={`${baseClasses} bg-blue-500`} />
    }
  }

  async function loadNotifications() {
    try {
      setIsLoadingNotifications(true)
      const notifs = await getNotifications(20)
      const count = await getUnreadCount()
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading notifications:', error)
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setIsLoadingNotifications(false)
    }
  }

  async function handleNotificationClick(notification: Notification) {
    try {
      if (!notification.read) {
        await markAsRead(notification.id)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        )
      }

      if (notification.action_url) {
        navigate(notification.action_url)
      }
    } catch (error) {
      console.error('Error handling notification click:', error)
      toast.error('Error processing notification')
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await markAllAsRead()
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Error marking as read')
    }
  }

  async function handleDeleteNotification(notificationId: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      const deletedNotif = notifications.find(n => n.id === notificationId)
      if (deletedNotif && !deletedNotif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Error deleting notification')
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-GB')
  }

  useEffect(() => {
    async function fetchUser() {
      try {
        const authResponse = await supabase.auth.getSession()
        const session = authResponse.data.session

        if (session && session.user) {
          const userResponse = await supabase
            .from("users")
            .select("full_name, avatar_url, email")
            .eq("id", session.user.id)
            .single()

          if (!userResponse.error && userResponse.data) {
            setUser(userResponse.data)
          }
          
          // Load user settings to get display name
          if (selectedOrg?.id) {
            try {
              const settings = await getUserSettings(selectedOrg.id)
              if (settings?.full_name) {
                setUserName(settings.full_name)
              } else if (userResponse.data?.full_name) {
                setUserName(userResponse.data.full_name)
              } else {
                setUserName(session.user.email?.split('@')[0] || 'User')
              }
            } catch (error) {
              console.error('Error loading user settings:', error)
              setUserName(userResponse.data?.full_name || session.user.email?.split('@')[0] || 'User')
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }

    fetchUser()
    loadNotifications()

    let subscription: any = null
    
    try {
      subscription = subscribeToNotifications((newNotification) => {
        setNotifications(prev => [newNotification, ...prev])
        setUnreadCount(prev => prev + 1)
        
        toast.info(newNotification.title, {
          description: newNotification.message,
        })
      })
    } catch (error) {
      console.error('Error subscribing to notifications:', error)
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [selectedOrg?.id])

  return (
    <TooltipProvider>
      <div className="h-14 border-b bg-background">
        <div className="flex h-full items-center justify-between px-6">
          {/* Left side - Organization Selector */}
          <div className="flex items-center gap-4">
            {selectedOrg && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 h-8 px-3">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{selectedOrg.name}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {userOrgs.map((userOrg) => (
                    <DropdownMenuItem
                      key={userOrg.org_id}
                      onClick={() => setOrganization(userOrg.organization)}
                      className={selectedOrg.id === userOrg.org_id ? "bg-accent" : ""}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{userOrg.organization.name}</span>
                        <span className="text-xs text-muted-foreground">{userOrg.role}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setOrgSelectorOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Manage Organizations
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-4">
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

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 pb-2">
                  <h3 className="font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs"
                      onClick={handleMarkAllAsRead}
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <Separator />
                <ScrollArea className="h-[400px]">
                  <div className="p-2">
                    {isLoadingNotifications ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full text-left p-3 rounded-lg hover:bg-accent transition-colors relative group ${
                            !notification.read ? 'bg-accent/50' : ''
                          }`}
                        >
                          <div className="flex gap-3">
                            <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-none">
                                  {notification.title}
                                </p>
                                <button
                                  onClick={(e) => handleDeleteNotification(notification.id, e)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimeAgo(notification.created_at)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user?.avatar_url || ""}
                      alt={userName || user?.full_name || ""}
                    />
                    <AvatarFallback>
                      {userName || user?.full_name
                        ? (userName || user.full_name)
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{userName || user?.full_name || ""}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuration')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await reAuthenticateWithGoogle()
                      toast.success("Re-authenticating with Google...")
                    } catch (error) {
                      console.error("Re-authentication failed:", error)
                      toast.error("Re-authentication failed. Please try again.")
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-connect Gmail
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={async () => {
                    await supabase.auth.signOut()
                    window.location.href = "/login"
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Organization Selector Dialog */}
      <OrganizationSelector open={orgSelectorOpen} onOpenChange={setOrgSelectorOpen} />
    </TooltipProvider>
  )
}
