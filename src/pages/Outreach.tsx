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
            <p className="text-gray-500 mt-2">
              Beheer leads, threads en templates op één plek
            </p>
          </div>
          <span className="rounded-full bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 hidden sm:inline">
            Level2B
          </span>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium",
                  isActive
                    ? "border-brand-600 text-gray-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
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
