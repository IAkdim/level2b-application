import { NavLink, Outlet, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { FileText, Users, Mail, ArrowRight } from "lucide-react"

export default function OutreachLayout() {
  const base = "/outreach"
  const location = useLocation()

  // Reordered tabs for logical flow: Templates -> Leads -> Email Threads
  const tabs = [
    { 
      name: "Templates", 
      to: `${base}/templates`,
      icon: FileText,
      description: "Create email templates"
    },
    { 
      name: "Leads", 
      to: `${base}/leads`,
      icon: Users,
      description: "Manage prospects"
    },
    { 
      name: "Email Threads", 
      to: `${base}/email-threads`,
      icon: Mail,
      description: "Track conversations"
    },
  ]

  // Determine current step for visual indicator
  const currentTabIndex = tabs.findIndex(tab => location.pathname.startsWith(tab.to))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Outreach
            </h1>
            <p className="text-muted-foreground mt-1">
              Create templates, add leads, and send personalised emails
            </p>
          </div>
        </div>
      </div>

      {/* Workflow Steps Navigation */}
      <div className="border rounded-lg bg-card p-1">
        <nav className="flex items-center" aria-label="Outreach workflow tabs">
          {tabs.map((tab, index) => {
            const isActive = location.pathname.startsWith(tab.to)
            const isPast = index < currentTabIndex
            const Icon = tab.icon

            return (
              <div key={tab.to} className="flex items-center flex-1">
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md transition-all flex-1",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isPast
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )
                  }
                >
                  <div className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold shrink-0",
                    isActive 
                      ? "bg-primary-foreground/20 text-primary-foreground" 
                      : isPast 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{tab.name}</div>
                    <div className={cn(
                      "text-xs truncate",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {tab.description}
                    </div>
                  </div>
                </NavLink>
                
                {/* Arrow connector between steps */}
                {index < tabs.length - 1 && (
                  <ArrowRight className={cn(
                    "h-4 w-4 mx-1 shrink-0",
                    index < currentTabIndex ? "text-primary" : "text-muted-foreground/30"
                  )} />
                )}
              </div>
            )
          })}
        </nav>
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
