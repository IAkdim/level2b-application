import { NavLink, Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"

export default function OutreachLayout() {
  const base = "/outreach"

  const tabs = [
    { name: "Leads", to: `${base}/leads` },
    { name: "Email Threads", to: `${base}/email-threads` },
    { name: "Templates", to: `${base}/templates` },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight inline-block">
              Outreach
            </h1>
            <div className="h-1 w-24 bg-brand-600 rounded mt-2" />
            <p className="text-muted-foreground mt-2">
              Manage leads, threads and templates in one place
            </p>
          </div>
          <span className="rounded-full bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 hidden sm:inline">
            Level2B
          </span>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium",
                  isActive
                    ? "border-brand-600 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-gray-300 dark:hover:border-gray-600 hover:text-foreground"
                )
              }
            >
              {tab.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
