import { useState, useEffect } from "react"
import { useUpdateLead } from "@/hooks/useLeads"
import { useSourceTags } from "@/hooks/useSourceTags"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, X, Tag } from "lucide-react"
import type { Lead, LeadStatus, Sentiment } from "@/types/crm"

interface EditLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: Lead | null
}

export function EditLeadDialog({ open, onOpenChange, lead }: EditLeadDialogProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<LeadStatus>("new")
  const [sentiment, setSentiment] = useState<Sentiment | "">("")
  const [notes, setNotes] = useState("")

  const updateLead = useUpdateLead()
  const {
    sources,
    sourceInput,
    setSourceInput,
    removeSource,
    handleSourceKeyDown,
    resetSources,
  } = useSourceTags()

  // Populate form when lead changes
  useEffect(() => {
    if (lead) {
      setName(lead.name)
      setEmail(lead.email)
      setPhone(lead.phone || "")
      setCompany(lead.company || "")
      setTitle(lead.title || "")
      setStatus(lead.status)
      setSentiment(lead.sentiment || "")
      resetSources(lead.source || [])
      setNotes(lead.notes || "")
    }
  }, [lead, resetSources])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!lead || !name.trim() || !email.trim()) {
      alert("Name and email are required")
      return
    }

    try {
      await updateLead.mutateAsync({
        leadId: lead.id,
        input: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          title: title.trim() || undefined,
          status,
          sentiment: sentiment || undefined,
          source: sources.length > 0 ? sources : undefined,
          notes: notes.trim() || undefined,
        },
      })

      onOpenChange(false)
    } catch (error: any) {
      console.error("Failed to update lead:", error)
      alert(error.message || "Failed to update lead")
    }
  }

  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>
            Update lead information. Name and email are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="edit-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="john@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Company & Title */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                placeholder="Acme Inc"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Job Title</Label>
              <Input
                id="edit-title"
                placeholder="CEO"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          {/* Status & Sentiment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sentiment">Sentiment</Label>
              <Select value={sentiment || "none"} onValueChange={(v) => setSentiment(v === "none" ? "" : v as Sentiment)}>
                <SelectTrigger id="edit-sentiment">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sources - Tag Input */}
          <div className="space-y-2">
            <Label htmlFor="edit-source">Sources</Label>
            <div className="relative">
              <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="edit-source"
                placeholder="Add source (press Enter)"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                onKeyDown={handleSourceKeyDown}
                className="pl-9"
              />
            </div>
            {sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sources.map((source) => (
                  <Badge
                    key={source}
                    variant="secondary"
                    className="text-xs pl-2 pr-1 py-0.5 gap-1"
                  >
                    {source}
                    <button
                      type="button"
                      onClick={() => removeSource(source)}
                      className="hover:bg-muted-foreground/20 rounded-full p-0.5 ml-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              placeholder="Additional information about this lead..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateLead.isPending}>
              {updateLead.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Lead"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
