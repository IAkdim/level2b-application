import { useEffect, useState } from "react"
import { Loader2, MapPin, Share2, CheckCircle2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LeadGeneratorProgressProps {
  open: boolean
  current: number
  total: number
  status: string
  method: 'google_maps' | 'social_media'
}

export function LeadGeneratorProgress({
  open,
  current,
  total,
  status,
  method,
}: LeadGeneratorProgressProps) {
  const [estimatedTime, setEstimatedTime] = useState('Calculating...')
  const progress = total > 0 ? (current / total) * 100 : 0
  const isComplete = current >= total && total > 0

  useEffect(() => {
    if (total > 0 && current < total) {
      const remaining = total - current
      const avgTimePerLead = 3 // seconds
      const remainingSeconds = remaining * avgTimePerLead
      
      if (remainingSeconds < 60) {
        setEstimatedTime(`~${remainingSeconds}s remaining`)
      } else {
        const minutes = Math.ceil(remainingSeconds / 60)
        setEstimatedTime(`~${minutes}m remaining`)
      }
    } else if (isComplete) {
      setEstimatedTime('Complete!')
    }
  }, [current, total, isComplete])

  const MethodIcon = method === 'google_maps' ? MapPin : Share2

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Lead Generation Complete!
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Leads...
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Method Badge */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <MethodIcon className="h-4 w-4" />
            <span>
              {method === 'google_maps' ? 'Google Maps Method' : 'Social Media Method'}
            </span>
          </div>

          {/* Progress Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Leads Generated</span>
              <span className="font-bold text-lg">
                {current} / {total}
              </span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}%</span>
              <span>{estimatedTime}</span>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {isComplete ? 'Generation Complete' : 'Current Status'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {status || 'Processing...'}
                </p>
              </div>
            </div>
          </div>

          {/* Steps Indicator */}
          {!isComplete && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Pipeline</p>
              <div className="grid grid-cols-5 gap-2">
                {['Search', 'Extract', 'Validate', 'Save', 'Done'].map((step, idx) => {
                  const stepProgress = (current / total) * 5
                  const isActive = idx < stepProgress
                  const isCurrent = idx === Math.floor(stepProgress)
                  
                  return (
                    <div
                      key={step}
                      className={`text-xs text-center py-2 rounded ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCurrent
                          ? 'bg-primary/50 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Success Message */}
          {isComplete && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Successfully generated {current} leads!
              </p>
              <p className="text-xs text-muted-foreground">
                They will appear in your leads list momentarily...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
