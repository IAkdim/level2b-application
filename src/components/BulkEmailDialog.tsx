import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Mail, Tag, FileText, RefreshCw, CheckCircle2, Sparkles } from "lucide-react"
import { sendBatchEmails } from "@/lib/api/gmail"
import { checkUsageLimit, incrementUsage, formatUsageLimitError, getTimeUntilReset } from "@/lib/api/usageLimits"
import { useOrganization } from "@/contexts/OrganizationContext"
import { isAuthenticationError, reAuthenticateWithGoogle } from "@/lib/api/reauth"
import type { Lead } from "@/types/crm"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"

interface BulkEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLeads: Lead[]
  onEmailsSent?: () => void
}

export function BulkEmailDialog({ open, onOpenChange, selectedLeads, onEmailsSent }: BulkEmailDialogProps) {
  const { selectedOrg } = useOrganization()
  const navigate = useNavigate()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [labelName, setLabelName] = useState("")
  const [isHtml, setIsHtml] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: number; failed: number } | null>(null)
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  const [isComplete, setIsComplete] = useState(false)

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      alert("Onderwerp en bericht zijn verplicht")
      return
    }

    if (selectedLeads.length === 0) {
      alert("No leads selected")
      return
    }

    if (!selectedOrg?.id) {
      alert("Geen organisatie geselecteerd")
      return
    }

    setIsSending(true)
    setSendResult(null)
    setIsComplete(false)
    setSendingProgress({ current: 0, total: selectedLeads.length, success: 0, failed: 0 })

    try {
      // Check daily email limit
      const limitCheck = await checkUsageLimit(selectedOrg.id, 'email')
      
      if (!limitCheck.allowed) {
        const errorMsg = formatUsageLimitError(limitCheck.error!)
        const resetTime = getTimeUntilReset()
        toast.error(`Dagelijkse email limiet bereikt. Reset over ${resetTime}`, {
          description: errorMsg,
          duration: 5000
        })
        setIsSending(false)
        return
      }

      // Check if we can send the requested number of emails
      const emailsRemaining = limitCheck.usage?.emailsRemaining || 0
      if (selectedLeads.length > emailsRemaining) {
        toast.error(`Kan niet ${selectedLeads.length} emails versturen`, {
          description: `Nog maar ${emailsRemaining} emails beschikbaar vandaag. Reset over ${getTimeUntilReset()}`,
          duration: 5000
        })
        setIsSending(false)
        return
      }

      console.log("Starting to send emails to", selectedLeads.length, "leads");
      
      // Personaliseer emails met lead data
      const emails = selectedLeads.map((lead) => {
        // Replace placeholders in subject and body
        let personalizedSubject = subject
          .replace(/\{name\}/g, lead.name)
          .replace(/\{company\}/g, lead.company || "uw bedrijf")
          .replace(/\{title\}/g, lead.title || "")

        let personalizedBody = body
          .replace(/\{name\}/g, lead.name)
          .replace(/\{company\}/g, lead.company || "uw bedrijf")
          .replace(/\{title\}/g, lead.title || "")

        console.log("Preparing email for:", lead.email, {
          subject: personalizedSubject,
          bodyLength: personalizedBody.length,
          isHtml,
          label: labelName
        });

        return {
          to: lead.email,
          subject: personalizedSubject,
          body: personalizedBody,
          isHtml,
        }
      })

      // Send emails
      console.log("Calling sendBatchEmails with label:", labelName || "none");
      const messageIds = await sendBatchEmails(
        emails, 
        labelName || undefined,
        (current, total, success, failed) => {
          setSendingProgress({ current, total, success, failed })
        }
      )
      console.log("Batch send completed. Message IDs:", messageIds);

      // Mark as complete with animation
      setIsComplete(true)

      // Increment email usage counter for successful sends
      if (messageIds.length > 0) {
        try {
          await incrementUsage(selectedOrg.id, 'email', messageIds.length)
        } catch (error) {
          console.error('Error incrementing email usage:', error)
          // Don't fail the send if usage tracking fails
        }
      }

      setSendResult({
        success: messageIds.length,
        failed: selectedLeads.length - messageIds.length,
      })

      // Call callback to refresh usage
      if (messageIds.length > 0 && onEmailsSent) {
        onEmailsSent()
      }

      if (messageIds.length === selectedLeads.length) {
        // All successful
        setTimeout(() => {
          onOpenChange(false)
          resetForm()
        }, 2000)
      }
    } catch (error) {
      console.error("Error sending emails:", error)
      
      // Check if it's an authentication error
      if (isAuthenticationError(error)) {
        toast.error("Google Re-authentication Required", {
          description: "Your Gmail connection has expired. Click 'Re-connect Gmail' to continue.",
          duration: 10000,
          action: {
            label: "Re-connect Gmail",
            onClick: async () => {
              try {
                await reAuthenticateWithGoogle()
              } catch (reAuthError) {
                console.error("Re-authentication failed:", reAuthError)
                toast.error("Re-authentication failed. Please try again.")
              }
            }
          }
        })
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast.error("Error sending emails", {
          description: errorMessage,
          duration: 5000
        })
      }
      
      setSendResult({
        success: 0,
        failed: selectedLeads.length,
      })
    } finally {
      setIsSending(false)
    }
  }

  const resetForm = () => {
    setSubject("")
    setBody("")
    setLabelName("")
    setIsHtml(false)
    setSendResult(null)
    setSendingProgress({ current: 0, total: 0, success: 0, failed: 0 })
    setIsComplete(false)
  }

  const handleClose = () => {
    if (!isSending) {
      onOpenChange(false)
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Bulk Email Versturen
          </DialogTitle>
          <DialogDescription>
            Verstuur een gepersonaliseerde email naar {selectedLeads.length}{" "}
            {selectedLeads.length === 1 ? "lead" : "leads"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Navigate to Templates Page */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                onOpenChange(false)
                navigate('/templates')
              }}
              disabled={isSending}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Ga naar Templates
            </Button>
          </div>

          {/* Sending Progress */}
          {isSending && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 animate-in zoom-in duration-300" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  )}
                  <span className="font-medium text-sm">
                    {isComplete ? "Verzenden voltooid!" : "Emails versturen..."}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {sendingProgress.current} / {sendingProgress.total}
                </span>
              </div>
              
              <Progress 
                value={(sendingProgress.current / sendingProgress.total) * 100} 
                className="h-2"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">✓ {sendingProgress.success} geslaagd</span>
                {sendingProgress.failed > 0 && (
                  <span className="text-red-600 dark:text-red-400">✗ {sendingProgress.failed} mislukt</span>
                )}
              </div>
            </div>
          )}

          {/* Selected Leads Preview */}
          <div className="space-y-2">
            <Label>Ontvangers ({selectedLeads.length})</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md max-h-32 overflow-y-auto">
              {selectedLeads.slice(0, 10).map((lead) => (
                <Badge key={lead.id} variant="secondary" className="text-xs">
                  {lead.name}
                </Badge>
              ))}
              {selectedLeads.length > 10 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedLeads.length - 10} meer
                </Badge>
              )}
            </div>
          </div>

          {/* Label Name */}
          <div className="space-y-2">
            <Label htmlFor="labelName" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Gmail Label (optioneel)
            </Label>
            <Input
              id="labelName"
              placeholder="bijv. Outreach_2025"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              disabled={isSending}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Label om aan verzonden emails toe te voegen voor tracking van reacties
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Onderwerp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="Kennismakingsgesprek"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              autoComplete="off"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              Bericht <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body"
              placeholder="Beste {name},&#10;&#10;Ik zag dat je werkt bij {company}..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={isSending}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Gebruik placeholders: <code className="bg-muted px-1 py-0.5 rounded">
                {"{name}"}
              </code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">{"{company}"}</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded">{"{title}"}</code>
            </p>
          </div>

          {/* HTML Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isHtml"
              checked={isHtml}
              onCheckedChange={(checked) => setIsHtml(checked as boolean)}
              disabled={isSending}
            />
            <Label
              htmlFor="isHtml"
              className="text-sm font-normal cursor-pointer"
            >
              Email bevat HTML
            </Label>
          </div>

          {/* Send Result */}
          {sendResult && (
            <div
              className={`p-4 rounded-md ${
                sendResult.failed === 0
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-yellow-50 border border-yellow-200 text-yellow-800"
              }`}
            >
              <p className="font-medium">
                ✓ {sendResult.success} email{sendResult.success !== 1 ? "s" : ""} verzonden
              </p>
              {sendResult.failed > 0 && (
                <p className="text-sm mt-1">
                  ✗ {sendResult.failed} email{sendResult.failed !== 1 ? "s" : ""} mislukt
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSending}
          >
            Annuleren
          </Button>
          <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Versturen...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Verstuur {selectedLeads.length} Email{selectedLeads.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
