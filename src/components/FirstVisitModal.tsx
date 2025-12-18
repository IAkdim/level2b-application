import { useEffect, useState } from "react"
import { X, Mail, Users, FileText, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { eventBus } from "@/lib/eventBus"

const STORAGE_KEY = "ai_emailer_first_visit_seen"

export function FirstVisitModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        setOpen(true)
      }
    } catch {
      // ignore storage errors (private mode, etc)
    }

    const unsub = eventBus.on("guide:open", () => setOpen(true))
    return () => unsub()
  }, [])

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {}
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Welcome to Level2B</CardTitle>
            <CardDescription>How the workflow works in a few steps</CardDescription>
          </div>
          <button aria-label="Close" onClick={close} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="grid gap-4 sm:grid-cols-2">
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Users className="mt-1 h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium">1. Import or manage Leads</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Go to Outreach → Leads to add or filter prospects.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <FileText className="mt-1 h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium">2. Create a Template</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Use Outreach → Templates to generate a template with Claude AI.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Mail className="mt-1 h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="font-medium">3. Start Outreach</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Send the template to selected leads and track the results.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Calendar className="mt-1 h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <h3 className="font-medium mb-1">Schedule Meetings</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">View scheduled appointments under Meetings and synchronise with Calendly.</p>
              </div>
            </li>
          </ol>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close}>View later</Button>
            <Button onClick={close}>Get started</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
