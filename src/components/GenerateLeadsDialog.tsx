import { useState } from "react"
import { Sparkles, MapPin, Share2, Loader2 } from "lucide-react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { generateLeads, GenerateLeadsParams } from "@/lib/api/leadGenerator"
import { LeadGeneratorProgress } from "./LeadGeneratorProgress"

interface GenerateLeadsDialogProps {
  userId: string
  onLeadsGenerated: () => void
}

export function GenerateLeadsDialog({ userId, onLeadsGenerated }: GenerateLeadsDialogProps) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [method, setMethod] = useState<'google_maps' | 'social_media'>('google_maps')
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [maxLeads, setMaxLeads] = useState(10)
  const [emailProvider, setEmailProvider] = useState('gmail.com')
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

    if (maxLeads < 1 || maxLeads > 10) {
      toast.error('Number of leads must be between 1 and 10')
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
        method,
        niche,
        location,
        maxLeads,
        emailProvider: method === 'social_media' ? emailProvider : undefined,
        userId,
      }

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev.current >= prev.total) return prev
          
          const newCurrent = prev.current + 1
          const statuses = [
            'Searching for businesses...',
            'Analyzing results...',
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

      // Wait a moment to show completion
      setTimeout(() => {
        setGenerating(false)
        setOpen(false)
        toast.success(`Successfully generated ${result.leadsGenerated} leads!`)
        onLeadsGenerated()
        
        // Reset form
        setNiche('')
        setLocation('')
        setMaxLeads(10)
        setProgress({ current: 0, total: 0, status: '' })
      }, 1500)

    } catch (error) {
      setGenerating(false)
      console.error('Error generating leads:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate leads')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Leads
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate Leads with AI</DialogTitle>
            <DialogDescription>
              Use AI to automatically find and collect leads from Google Maps or social media
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Method Selection */}
            <div className="space-y-3">
              <Label>Generation Method</Label>
              <RadioGroup value={method} onValueChange={(v: string) => setMethod(v as 'google_maps' | 'social_media')}>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="google_maps" id="google_maps" />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="google_maps" className="cursor-pointer flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Google Maps
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Find businesses in a specific location and extract contact info from their websites
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="social_media" id="social_media" />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="social_media" className="cursor-pointer flex items-center gap-2">
                      <Share2 className="h-4 w-4" />
                      Social Media
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Search LinkedIn and Twitter for professionals with email addresses
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

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

            {/* Email Provider (Social Media only) */}
            {method === 'social_media' && (
              <div className="space-y-2">
                <Label htmlFor="emailProvider">Email Provider</Label>
                <Input
                  id="emailProvider"
                  placeholder="e.g. gmail.com, outlook.com, yahoo.com"
                  value={emailProvider}
                  onChange={(e) => setEmailProvider(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  We'll search for emails with this domain (e.g. @gmail.com)
                </p>
              </div>
            )}

            {/* Max Leads */}
            <div className="space-y-2">
              <Label htmlFor="maxLeads">Number of Leads (max 10)</Label>
              <Input
                id="maxLeads"
                type="number"
                min="1"
                max="10"
                value={maxLeads}
                onChange={(e) => setMaxLeads(parseInt(e.target.value) || 10)}
              />
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
        </DialogContent>
      </Dialog>

      {/* Progress Modal */}
      <LeadGeneratorProgress
        open={generating}
        current={progress.current}
        total={progress.total}
        status={progress.status}
        method={method}
      />
    </>
  )
}
