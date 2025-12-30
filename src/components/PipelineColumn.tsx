import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { DealCard } from './DealCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Inbox } from 'lucide-react'
import type { DealWithTaskCount, DealStage } from '@/types/crm'
import { cn } from '@/lib/utils'

interface PipelineColumnProps {
  stage: DealStage
  title: string
  deals: DealWithTaskCount[]
  isLoading: boolean
  activeDealId?: string
  isOver?: boolean
  onEditDeal?: (deal: DealWithTaskCount) => void
}

export function PipelineColumn({ stage, title, deals, isLoading, activeDealId, isOver = false, onEditDeal }: PipelineColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({ id: stage })

  // Column should highlight if either the droppable detects hover OR parent says it's hovered
  const shouldHighlight = isOver || isDroppableOver

  // Calculate total value
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0)

  // Get color scheme based on stage
  const getStageColor = (stage: DealStage) => {
    const colors = {
      lead: 'bg-slate-100 border-slate-300',
      qualified: 'bg-blue-100 border-blue-300',
      proposal: 'bg-purple-100 border-purple-300',
      negotiation: 'bg-amber-100 border-amber-300',
      closed_won: 'bg-green-100 border-green-300',
      closed_lost: 'bg-red-100 border-red-300',
    }
    return colors[stage]
  }

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    } else {
      return `$${amount.toFixed(0)}`
    }
  }

  return (
    <div className="flex flex-col w-80 flex-shrink-0 h-full">
      {/* Column Header */}
      <div
        className={cn(
          'p-3 rounded-t-lg border-2 border-b-0',
          getStageColor(stage),
          shouldHighlight && 'ring-2 ring-primary'
        )}
      >
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {deals.length}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatCompactCurrency(totalValue)} total
        </div>
      </div>

      {/* Droppable Area */}
      <Card
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-t-none border-t-0 p-2 overflow-y-auto min-h-0',
          shouldHighlight && 'bg-accent/50'
        )}
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No deals in this stage</p>
            <p className="text-xs mt-1">Drag deals here</p>
          </div>
        ) : (
          <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onEdit={onEditDeal}
                  isDropTarget={!!activeDealId && activeDealId !== deal.id}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </Card>
    </div>
  )
}
