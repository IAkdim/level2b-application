import { useState } from "react"
import { Sparkles, MapPin, Loader2, CheckCircle2, Mail, Building2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { generateLeads, GenerateLeadsParams, GenerateLeadsResult } from "@/lib/api/leadGenerator"
import { LeadGeneratorProgress } from "./LeadGeneratorProgress"
import { ScrollArea } from "@/components/ui/scroll-area"

interface GenerateLeadsDialogProps {
  organizationId?: string // Kept for backwards compatibility, not used
  onLeadsGenerated: () => void
}

interface GenerationSummary {
  leads: Array<{
    company: string
    email: string
    phone?: string
  }>
  totalFound: number
  duplicatesFiltered: number
  durationMs: number
}

export function GenerateLeadsDialog({ onLeadsGenerated }: GenerateLeadsDialogProps) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary] = useState<GenerationSummary | null>(null)
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [maxLeads, setMaxLeads] = useState(10)
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    status: '',
  })

  const handleGenerate = async () => {
    if (!niche.trim()) {
      toast.error('Please enter a niche')
      return
    }

    if (!location.trim()) {
      toast.error('Please enter a location')
      return
    }

    if (maxLeads < 1 || maxLeads > 50) {
      toast.error('Number of leads must be between 1 and 50')
      return
    }

    setGenerating(true)
    setProgress({
      current: 0,
      total: maxLeads,
      status: 'Starting lead generation...',
    })

    try {
      const params: GenerateLeadsParams = {
        niche,
        location,
        maxLeads,
      }

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev.current >= prev.total) return prev
          
          const newCurrent = prev.current + 1
          const statuses = [
            'Searching Google Maps...',
            'Finding businesses...',
            'Extracting contact information...',
            'Validating leads...',
            'Saving to database...',
          ]
          
          return {
            current: newCurrent,
            total: prev.total,
            status: statuses[Math.floor((newCurrent / prev.total) * statuses.length)] || statuses[0],
          }
        })
      }, 2000)

      const result = await generateLeads(params)

      clearInterval(progressInterval)

      setProgress({
        current: result.leadsGenerated,
        total: maxLeads,
        status: 'Complete!',
      })

      // Show summary instead of closing immediately
      setSummary({
        leads: result.leads.map((lead: any) => ({
          company: lead.company || lead.name,
          email: lead.email,
          phone: lead.phone,
        })),
        totalFound: result.meta?.totalFound || result.leadsGenerated,
        duplicatesFiltered: result.meta?.duplicatesFiltered || 0,
        durationMs: result.meta?.durationMs || 0,
      })
      
      setGenerating(false)
      setShowSummary(true)
      onLeadsGenerated()

    } catch (error) {
      setGenerating(false)
      console.error('Error generating leads:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate leads')
    }
  }

  const handleClose = () => {
    setOpen(false)
    setShowSummary(false)
    setSummary(null)
    setNiche('')
    setLocation('')
    setMaxLeads(10)
    setProgress({ current: 0, total: 0, status: '' })
  }

  const handleNewSearch = () => {
    setShowSummary(false)
    setSummary(null)
    setProgress({ current: 0, total: 0, status: '' })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
        else setOpen(true)
      }}>
        <DialogTrigger asChild>
          <Button className="gap-2" data-walkthrough="generate-lead-btn">
            <Sparkles className="h-4 w-4" />
            Generate Leads
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          {showSummary && summary ? (
            // Summary View
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Lead Generation Complete!
                </DialogTitle>
                <DialogDescription>
                  Found {summary.leads.length} leads with email addresses
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">{summary.leads.length}</div>
                    <div className="text-xs text-muted-foreground">Leads Saved</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-2xl font-bold">{summary.totalFound}</div>
                    <div className="text-xs text-muted-foreground">Places Found</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-2xl font-bold text-muted-foreground">{summary.duplicatesFiltered}</div>
                    <div className="text-xs text-muted-foreground">Duplicates</div>
                  </div>
                </div>

                {/* Time taken */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Completed in {(summary.durationMs / 1000).toFixed(1)} seconds
                </div>

                {/* Leads List */}
                {summary.leads.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="bg-muted px-3 py-2 border-b">
                      <h4 className="font-medium text-sm">Emails Found</h4>
                    </div>
                    <ScrollArea className="h-[200px]">
                      <div className="divide-y">
                        {summary.leads.map((lead, index) => (
                          <div key={index} className="px-3 py-2 hover:bg-muted/50">
                            <div className="flex items-start gap-2">
                              <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">{lead.company}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{lead.email}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {summary.leads.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No emails could be found from the businesses' websites.</p>
                    <p className="text-sm">Try a different niche or location.</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={handleNewSearch}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate More
                  </Button>
                  <Button className="flex-1" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </div>
            </>
          ) : (
            // Form View
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Generate Leads from Google Maps
                </DialogTitle>
                <DialogDescription>
                  Find businesses in a specific location and extract contact info from their websites
                </DialogDescription>
              </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Niche Input */}
            <div className="space-y-2">
              <Label htmlFor="niche">Niche / Industry</Label>
              <Input
                id="niche"
                placeholder="e.g. Software Development, Marketing Agency, Real Estate"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>

            {/* Location Input */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Amsterdam, Netherlands"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Max Leads */}
            <div className="space-y-2">
              <Label htmlFor="maxLeads">Number of Leads (max 50)</Label>
              <Input
                id="maxLeads"
                type="number"
                min="1"
                max="50"
                value={maxLeads}
                onChange={(e) => setMaxLeads(Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
              />
              <p className="text-xs text-muted-foreground">
                Higher numbers take longer but support pagination for more results
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate {maxLeads} Leads
                </>
              )}
            </Button>
          </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Progress Modal */}
      <LeadGeneratorProgress
        open={generating}
        current={progress.current}
        total={progress.total}
        status={progress.status}
        method="google_maps"
      />
    </>
  )
}
