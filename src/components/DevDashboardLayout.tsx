import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Flag,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

interface NavItem {
  name: string
  href: string
  icon: any
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/dev/overview', icon: LayoutDashboard },
  { name: 'Users', href: '/dev/users', icon: Users },
  { name: 'Logs', href: '/dev/logs', icon: ScrollText },
  { name: 'Feature Flags', href: '/dev/flags', icon: Flag },
  { name: 'Settings', href: '/dev/settings', icon: Settings },
]

export default function DevDashboardLayout() {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const isItemActive = (item: NavItem) => {
    return location.pathname === item.href || location.pathname.startsWith(item.href + '/')
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-800 flex items-center px-4 bg-slate-900">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-red-500" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">Developer Dashboard</span>
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
              ADMIN ONLY
            </Badge>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <Activity className="h-4 w-4 text-green-500" />
          <span className="text-xs text-slate-400">System Operational</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'border-r border-slate-800 bg-slate-900 transition-all duration-300',
            isCollapsed ? 'w-16' : 'w-64'
          )}
        >
          <nav className="h-full flex flex-col">
            <div className="flex-1 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = isItemActive(item)
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md transition-colors',
                      'hover:bg-slate-800',
                      isActive
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-100'
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="text-sm font-medium">{item.name}</span>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Collapse Toggle */}
            <div className="p-2 border-t border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full justify-center hover:bg-slate-800"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    <span className="text-xs">Collapse</span>
                  </>
                )}
              </Button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1600px] mx-auto p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
