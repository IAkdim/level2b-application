import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Mail, Tag, FileText, RefreshCw, CheckCircle2, Sparkles, Clock } from "lucide-react"
import { sendBatchEmails, checkGmailAuthentication } from "@/lib/api/gmail"
import { getUserEmailTemplates, incrementTemplateUsage } from "@/lib/api/templates"
import type { EmailTemplate } from "@/types/crm"
import { checkUsageLimit, incrementUsage, formatUsageLimitError, getTimeUntilReset } from "@/lib/api/usageLimits"
import { isAuthenticationError, reAuthenticateWithGoogle } from "@/lib/api/reauth"
import type { Lead } from "@/types/crm"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { getUserSettings, getDefaultSettings, type UserSettings } from "@/lib/api/userSettings"
import { supabase } from "@/lib/supabaseClient"

interface BulkEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLeads: Lead[]
  onEmailsSent?: () => void
}

export function BulkEmailDialog({ open, onOpenChange, selectedLeads, onEmailsSent }: BulkEmailDialogProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [labelName, setLabelName] = useState("")
  const [isHtml, setIsHtml] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: number; failed: number } | null>(null)
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  const [isComplete, setIsComplete] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)

  // Load user settings and templates when dialog opens
  useEffect(() => {
    async function loadUserSettings() {
      if (!open) return

      try {
        const settings = await getUserSettings()
        setUserSettings(settings || getDefaultSettings() as UserSettings)
      } catch (error) {
        console.error('Error loading user settings:', error)
        setUserSettings(getDefaultSettings() as UserSettings)
      }
    }

    loadUserSettings()
  }, [open])

  // Load saved templates when dialog opens
  useEffect(() => {
    const loadTemplates = async () => {
      if (!open || !user) return

      setIsLoadingTemplates(true)
      try {
        const templates = await getUserEmailTemplates(user.id)
        setSavedTemplates(templates)
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setIsLoadingTemplates(false)
      }
    }

    loadTemplates()
  }, [open, user])

  const handleUseTemplate = async (template: EmailTemplate) => {
    setSubject(template.subject)
    setBody(template.body)
    
    // Increment usage counter
    try {
      await incrementTemplateUsage(template.id)
    } catch (error) {
      console.error('Error incrementing template usage:', error)
    }
    
    toast.success('Template applied')
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      alert("Subject and message are required")
      return
    }

    if (selectedLeads.length === 0) {
      alert("No leads selected")
      return
    }

    setIsSending(true)
    setSendResult(null)
    setIsComplete(false)
    setSendingProgress({ current: 0, total: selectedLeads.length, success: 0, failed: 0 })

    try {
      // Check daily email limit (user-centric)
      const limitCheck = await checkUsageLimit('email')
      
      if (!limitCheck.allowed) {
        const errorMsg = formatUsageLimitError(limitCheck.error!)
        const resetTime = getTimeUntilReset()
        const dailyLimit = limitCheck.usage?.emailLimit || 50
        toast.error(`Daily email limit reached (${dailyLimit}). Resets in ${resetTime}`, {
          description: errorMsg,
          duration: 5000
        })
        setIsSending(false)
        return
      }

      // Check if we can send the requested number of emails
      const emailsRemaining = limitCheck.usage?.emailsRemaining || 0
      const dailyLimit = limitCheck.usage?.emailLimit || 50
      if (selectedLeads.length > emailsRemaining) {
        toast.error(`Cannot send ${selectedLeads.length} emails`, {
          description: `Only ${emailsRemaining} emails remaining today (limit: ${dailyLimit}). Resets in ${getTimeUntilReset()}`,
          duration: 5000
        })
        setIsSending(false)
        return
      }

      console.log("Starting to send emails to", selectedLeads.length, "leads");
      
      // Get user info for signature
      const { data: { user } } = await supabase.auth.getUser()
      
      // Personalise emails with lead data
      const emails = selectedLeads.map((lead) => {
        // Replace placeholders in subject and body
        let personalizedSubject = subject
          .replace(/\{name\}/g, lead.name)
          .replace(/\{company\}/g, lead.company || "your company")
          .replace(/\{title\}/g, lead.title || "")

        let personalizedBody = body
          .replace(/\{name\}/g, lead.name)
          .replace(/\{company\}/g, lead.company || "your company")
          .replace(/\{title\}/g, lead.title || "")
        
        // Add email signature if configured
        if (userSettings?.email_signature) {
          const signature = userSettings.email_signature
            .replace(/\{\{sender_name\}\}/g, userSettings.full_name || user?.email || '')
            .replace(/\{\{company\}\}/g, userSettings.company_name || '')
            .replace(/\{\{phone\}\}/g, '') // Add phone to user settings if needed

          personalizedBody += `\n\n${signature}`
        }

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

      // Increment email usage counter for successful sends (user-centric)
      if (messageIds.length > 0) {
        try {
          await incrementUsage('email', messageIds.length)
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
        toast.info("Reconnecting Gmail...", {
          description: "You will be redirected to Google to sign in again.",
          duration: 3000
        })
        
        // Automatically redirect to Google re-authentication
        try {
          await reAuthenticateWithGoogle()
        } catch (reAuthError) {
          console.error("Re-authentication failed:", reAuthError)
          toast.error("Re-authentication failed", {
            description: "Please try again later or contact support.",
            duration: 5000
          })
        }
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
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Bulk Email
            </DialogTitle>
            <DialogDescription>
              Send a personalised email to {selectedLeads.length}{" "}
              {selectedLeads.length === 1 ? "lead" : "leads"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
          {/* Saved Templates Section */}
          {savedTemplates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Saved Templates</Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    navigate('/outreach/templates')
                  }}
                  disabled={isSending}
                >
                  <Sparkles className="mr-2 h-3 w-3" />
                  Create new template
                </Button>
              </div>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {savedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleUseTemplate(template)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{template.name}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{template.subject}</div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {template.times_used || 0}x
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No templates - show link to create */}
          {savedTemplates.length === 0 && !isLoadingTemplates && (
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  navigate('/outreach/templates')
                }}
                disabled={isSending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Create new template
              </Button>
            </div>
          )}

          {/* Selected Leads Preview */}
          <div className="space-y-2">
            <Label>Recipients ({selectedLeads.length})</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md max-h-32 overflow-y-auto">
              {selectedLeads.slice(0, 10).map((lead) => (
                <Badge key={lead.id} variant="secondary" className="text-xs">
                  {lead.name}
                </Badge>
              ))}
              {selectedLeads.length > 10 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedLeads.length - 10} more
                </Badge>
              )}
            </div>
          </div>

          {/* Label Name */}
          <div className="space-y-2">
            <Label htmlFor="labelName" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Gmail Label (optional)
            </Label>
            <Input
              id="labelName"
              placeholder="e.g. Outreach_2025"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              disabled={isSending}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Label to add to sent emails for tracking replies
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="Introduction meeting"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              autoComplete="off"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="body"
              placeholder="Dear {name},&#10;&#10;I noticed you work at {company}..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={isSending}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Use placeholders: <code className="bg-muted px-1 py-0.5 rounded">
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
              Email contains HTML
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
                ✓ {sendResult.success} email{sendResult.success !== 1 ? "s" : ""} sent
              </p>
              {sendResult.failed > 0 && (
                <p className="text-sm mt-1">
                  ✗ {sendResult.failed} email{sendResult.failed !== 1 ? "s" : ""} failed
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
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send {selectedLeads.length} Email{selectedLeads.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Progress Dialog - Appears on top when sending */}
    <Dialog open={isSending} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Sending complete!
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Sending emails...
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isComplete 
              ? `${sendingProgress.success} email${sendingProgress.success !== 1 ? 's' : ''} sent successfully`
              : `Sending to ${selectedLeads.length} ${selectedLeads.length === 1 ? 'lead' : 'leads'}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {sendingProgress.current} / {sendingProgress.total}
            </span>
          </div>

          <Progress 
            value={(sendingProgress.current / sendingProgress.total) * 100} 
            className="h-3"
          />

          <div className="flex justify-between text-sm pt-2">
            <span className="text-green-600 dark:text-green-400 font-medium">
              ✓ {sendingProgress.success} succeeded
            </span>
            {sendingProgress.failed > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                ✗ {sendingProgress.failed} failed
              </span>
            )}
          </div>
        </div>

        {isComplete && (
          <DialogFooter>
            <Button onClick={() => {
              setIsSending(false)
              setIsComplete(false)
              if (sendingProgress.success > 0) {
                onOpenChange(false)
                resetForm()
              }
            }}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
