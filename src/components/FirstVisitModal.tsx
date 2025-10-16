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
            <CardTitle>Welkom bij Level2B</CardTitle>
            <CardDescription>Zo werkt de flow in een paar stappen</CardDescription>
          </div>
          <button aria-label="Sluiten" onClick={close} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="grid gap-4 sm:grid-cols-2">
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <Users className="mt-1 h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium">1. Importeer of beheer Leads</p>
                <p className="text-sm text-gray-500">Ga naar Outreach → Leads om prospects toe te voegen of te filteren.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <FileText className="mt-1 h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium">2. Maak een Template</p>
                <p className="text-sm text-gray-500">Gebruik Outreach → Templates om met Claude AI een template te genereren.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <Mail className="mt-1 h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium">3. Start Outreach</p>
                <p className="text-sm text-gray-500">Verstuur de template naar geselecteerde leads en volg de resultaten.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <Calendar className="mt-1 h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium">4. Plan Meetings</p>
                <p className="text-sm text-gray-500">Bekijk ingeplande afspraken onder Meetings en synchroniseer met Calendly.</p>
              </div>
            </li>
          </ol>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close}>Later bekijken</Button>
            <Button onClick={close}>Aan de slag</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
