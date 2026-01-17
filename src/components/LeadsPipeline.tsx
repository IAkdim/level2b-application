import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { 
  User, 
  Mail, 
  Building2, 
  MoreVertical,
  ChevronRight
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Lead, LeadStatus } from "@/types/crm"

interface PipelineColumn {
  id: LeadStatus
  title: string
  color: string
  bgColor: string
  description: string
}

const pipelineColumns: PipelineColumn[] = [
  { 
    id: 'new', 
    title: 'New', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    description: 'Newly added leads'
  },
  { 
    id: 'contacted', 
    title: 'Contacted', 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    description: 'Initial outreach sent'
  },
  { 
    id: 'replied', 
    title: 'Replied', 
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    description: 'Received a response'
  },
  { 
    id: 'meeting_scheduled', 
    title: 'Meeting', 
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    description: 'Meeting scheduled'
  },
  { 
    id: 'closed', 
    title: 'Closed', 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    description: 'Deal closed'
  },
  { 
    id: 'lost', 
    title: 'Lost', 
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    description: 'Did not convert'
  },
]

interface LeadsPipelineProps {
  leads: Lead[]
  onLeadClick?: (lead: Lead) => void
  onStatusChange?: (leadId: string, newStatus: LeadStatus) => void
  onEdit?: (lead: Lead) => void
  onDelete?: (lead: Lead) => void
}

export function LeadsPipeline({ 
  leads, 
  onLeadClick, 
  onStatusChange,
  onEdit,
  onDelete 
}: LeadsPipelineProps) {

  // Group leads by status
  const groupedLeads = pipelineColumns.reduce((acc, column) => {
    acc[column.id] = leads.filter(lead => lead.status === column.id)
    return acc
  }, {} as Record<LeadStatus, Lead[]>)

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {pipelineColumns.map((column) => {
          const columnLeads = groupedLeads[column.id] || []
          
          return (
            <div 
              key={column.id}
              className="flex-shrink-0 w-72"
            >
              {/* Column Header */}
              <div className={cn(
                "rounded-t-lg px-3 py-2 border border-b-0",
                column.bgColor
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className={cn("font-semibold text-sm", column.color)}>
                      {column.title}
                    </h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {columnLeads.length}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {column.description}
                </p>
              </div>

              {/* Column Content */}
              <div className="bg-muted/30 border rounded-b-lg min-h-[400px] p-2 space-y-2">
                {columnLeads.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                    No leads
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard 
                      key={lead.id}
                      lead={lead}
                      onClick={() => onLeadClick?.(lead)}
                      onEdit={() => onEdit?.(lead)}
                      onDelete={() => onDelete?.(lead)}
                      onStatusChange={onStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

interface LeadCardProps {
  lead: Lead
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onStatusChange?: (leadId: string, newStatus: LeadStatus) => void
}

function LeadCard({ lead, onClick, onEdit, onDelete, onStatusChange }: LeadCardProps) {
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50'
      case 'negative': return 'text-red-600 bg-red-50'
      case 'neutral': return 'text-gray-600 bg-gray-50'
      default: return 'text-muted-foreground bg-muted'
    }
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{lead.name}</p>
                {lead.company && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {lead.company}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick?.() }}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.() }}>
                Edit Lead
              </DropdownMenuItem>
              {onStatusChange && (
                <>
                  <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                    Move to:
                  </DropdownMenuItem>
                  {pipelineColumns
                    .filter(col => col.id !== lead.status)
                    .map(col => (
                      <DropdownMenuItem 
                        key={col.id}
                        onClick={(e) => { 
                          e.stopPropagation()
                          onStatusChange(lead.id, col.id)
                        }}
                      >
                        <ChevronRight className="h-3 w-3 mr-2" />
                        {col.title}
                      </DropdownMenuItem>
                    ))
                  }
                </>
              )}
              <DropdownMenuItem 
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete?.() }}
              >
                Delete Lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        </div>

        {lead.sentiment && (
          <div className="mt-2">
            <Badge 
              variant="outline" 
              className={cn("text-xs capitalize", getSentimentColor(lead.sentiment))}
            >
              {lead.sentiment}
            </Badge>
          </div>
        )}

        {lead.source && (
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              {lead.source}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
