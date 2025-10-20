import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { X, Tag, ChevronDown } from "lucide-react"
import type { LeadStatus, Sentiment } from "@/types/crm"
import { useState, KeyboardEvent } from "react"
import { useUniqueSources } from "@/hooks/useLeads"

interface LeadsFilterSidebarProps {
  statusFilter: LeadStatus[]
  sentimentFilter: Sentiment[]
  sourceFilter: string[]
  onStatusChange: (statuses: LeadStatus[]) => void
  onSentimentChange: (sentiments: Sentiment[]) => void
  onSourceChange: (sources: string[]) => void
  onClearAll: () => void
}

const statuses: Array<{ value: LeadStatus; label: string; description: string }> = [
  { value: "new", label: "New", description: "Fresh leads" },
  { value: "contacted", label: "Contacted", description: "Reached out" },
  { value: "replied", label: "Replied", description: "They responded" },
  { value: "meeting_scheduled", label: "Meeting", description: "Call scheduled" },
  { value: "closed", label: "Closed", description: "Won the deal" },
  { value: "lost", label: "Lost", description: "Didn't work out" },
]

export function LeadsFilterSidebar({
  statusFilter,
  sentimentFilter,
  sourceFilter,
  onStatusChange,
  onSentimentChange,
  onSourceChange,
  onClearAll,
}: LeadsFilterSidebarProps) {
  const [sourceInput, setSourceInput] = useState("")
  const [isSourcePopoverOpen, setIsSourcePopoverOpen] = useState(false)
  const { data: availableSources } = useUniqueSources()

  const totalFilters = statusFilter.length + sentimentFilter.length + sourceFilter.length

  const toggleStatus = (status: LeadStatus) => {
    if (statusFilter.includes(status)) {
      onStatusChange(statusFilter.filter((s) => s !== status))
    } else {
      onStatusChange([...statusFilter, status])
    }
  }

  const toggleSentiment = (sentiment: Sentiment) => {
    if (sentimentFilter.includes(sentiment)) {
      onSentimentChange(sentimentFilter.filter((s) => s !== sentiment))
    } else {
      onSentimentChange([...sentimentFilter, sentiment])
    }
  }

  const addSource = (source?: string) => {
    const sourceToAdd = source || sourceInput.trim()
    if (sourceToAdd && !sourceFilter.includes(sourceToAdd)) {
      onSourceChange([...sourceFilter, sourceToAdd])
      setSourceInput("")
      setIsSourcePopoverOpen(false)
    }
  }

  const selectExistingSource = (source: string) => {
    if (!sourceFilter.includes(source)) {
      onSourceChange([...sourceFilter, source])
    }
    setIsSourcePopoverOpen(false)
  }

  const removeSource = (source: string) => {
    onSourceChange(sourceFilter.filter((s) => s !== source))
  }

  const handleSourceKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addSource()
    }
  }

  return (
    <div className="w-72 flex-shrink-0 border-r border-border/30 bg-muted/20 h-full overflow-y-auto overflow-x-hidden">
      <div className="px-6 py-8 space-y-6 max-w-full">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            {totalFilters > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalFilters}
              </Badge>
            )}
          </div>
          {totalFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-7 w-full text-xs"
            >
              Clear all filters
            </Button>
          )}
        </div>


        {/* Status Pills */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Status
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((status) => (
              <button
                key={status.value}
                onClick={() => toggleStatus(status.value)}
                className={`
                  px-2.5 py-1 rounded-full text-xs font-medium transition-all
                  ${
                    statusFilter.includes(status.value)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background border border-border hover:border-primary/50"
                  }
                `}
                title={status.description}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Sentiment Pills */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Sentiment
          </Label>
          <div className="flex gap-1.5">
            {(["positive", "neutral", "negative"] as Sentiment[]).map((sentiment) => (
              <button
                key={sentiment}
                onClick={() => toggleSentiment(sentiment)}
                className={`
                  flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all
                  flex items-center justify-center gap-1.5
                  ${
                    sentimentFilter.includes(sentiment)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background border border-border hover:border-primary/50"
                  }
                `}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    sentiment === "positive"
                      ? "bg-green-500"
                      : sentiment === "negative"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }`}
                />
                {sentiment}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Source Tags */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Sources
          </Label>

          <Popover open={isSourcePopoverOpen} onOpenChange={setIsSourcePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isSourcePopoverOpen}
                className="w-full justify-between h-9 text-sm font-normal"
              >
                <span className="text-muted-foreground flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5" />
                  Add source...
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="p-2 border-b">
                <Input
                  placeholder="Type to search or add new..."
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  onKeyDown={handleSourceKeyDown}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {sourceInput.trim() && !availableSources?.includes(sourceInput.trim()) && (
                  <button
                    onClick={() => addSource()}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span className="font-medium">Add "{sourceInput.trim()}"</span>
                  </button>
                )}
                {availableSources && availableSources.length > 0 ? (
                  <div className="py-1">
                    {availableSources
                      .filter(source =>
                        !sourceFilter.includes(source) &&
                        source.toLowerCase().includes(sourceInput.toLowerCase())
                      )
                      .map((source) => (
                        <button
                          key={source}
                          onClick={() => selectExistingSource(source)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                        >
                          {source}
                        </button>
                      ))}
                  </div>
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No sources yet. Type to add a new one.
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {sourceFilter.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sourceFilter.map((source) => (
                <Badge
                  key={source}
                  variant="secondary"
                  className="text-xs pl-2 pr-1 py-0.5 gap-1 max-w-full"
                >
                  <span className="truncate">{source}</span>
                  <button
                    onClick={() => removeSource(source)}
                    className="hover:bg-muted-foreground/20 rounded-full p-0.5 ml-0.5 flex-shrink-0"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
