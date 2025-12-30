import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { useDealsGroupedByStage, useUpdateDealStage } from '@/hooks/useDeals'
import { PipelineColumn } from '@/components/PipelineColumn'
import { DealCard } from '@/components/DealCard'
import { AddDealDialog } from '@/components/AddDealDialog'
import { EditDealDialog } from '@/components/EditDealDialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { DealStage, DealWithTaskCount } from '@/types/crm'
import { toast } from 'sonner'

export function PipelineView() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealWithTaskCount | null>(null)
  const [activeDeal, setActiveDeal] = useState<DealWithTaskCount | null>(null)
  const [overStage, setOverStage] = useState<DealStage | null>(null)

  const { data: dealsByStage, isLoading } = useDealsGroupedByStage()
  const updateDealStage = useUpdateDealStage()

  // Configure drag sensors with distance threshold to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    })
  )

  const stages: DealStage[] = [
    'lead',
    'qualified',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost',
  ]

  const stageLabels: Record<DealStage, string> = {
    lead: 'Lead',
    qualified: 'Qualified',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  }

  const handleDragStart = (event: DragStartEvent) => {
    const dealId = event.active.id as string
    // Find the deal across all stages
    const deal = Object.values(dealsByStage || {})
      .flat()
      .find((d) => d.id === dealId)
    setActiveDeal(deal || null)
  }

  const handleDragOver = (event: any) => {
    const { over } = event
    if (!over) {
      setOverStage(null)
      return
    }

    // Determine which stage is being hovered
    if (stages.includes(over.id as DealStage)) {
      // Hovering over a column
      setOverStage(over.id as DealStage)
    } else {
      // Hovering over a card - find its stage
      const targetDeal = Object.values(dealsByStage || {})
        .flat()
        .find((d) => d.id === over.id)
      setOverStage(targetDeal?.stage || null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDeal(null)
    setOverStage(null)

    if (!over) return

    const dealId = active.id as string

    // Find the deal to check its current stage
    const deal = Object.values(dealsByStage || {})
      .flat()
      .find((d) => d.id === dealId)

    if (!deal) return

    // Determine the target stage
    // over.id could be either a stage name (if dropped on column) or a deal UUID (if dropped on a card)
    let newStage: DealStage

    if (stages.includes(over.id as DealStage)) {
      // Dropped on a column
      newStage = over.id as DealStage
    } else {
      // Dropped on another card - find that card's stage
      const targetDeal = Object.values(dealsByStage || {})
        .flat()
        .find((d) => d.id === over.id)

      if (!targetDeal) return
      newStage = targetDeal.stage
    }

    // Don't update if it's the same stage
    if (deal.stage === newStage) return

    // Validation: Can't move to closed_won without value
    if (newStage === 'closed_won') {
      if (!deal.value || deal.value <= 0) {
        toast.error('Cannot close deal without a value')
        return
      }
    }

    updateDealStage.mutate({ dealId, stage: newStage })
  }

  const handleEditDeal = (deal: DealWithTaskCount) => {
    setEditingDeal(deal)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Sales Pipeline</h1>
              <p className="text-muted-foreground">
                Manage deals across stages with drag and drop
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Deal
              </Button>
            </div>
          </div>
        </div>

        {/* Pipeline Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex gap-4 h-full min-w-min">
            {stages.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                title={stageLabels[stage]}
                deals={dealsByStage?.[stage] || []}
                isLoading={isLoading}
                activeDealId={activeDeal?.id}
                isOver={overStage === stage}
                onEditDeal={handleEditDeal}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}</DragOverlay>

      {/* Add Deal Dialog */}
      <AddDealDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

      {/* Edit Deal Dialog */}
      <EditDealDialog
        open={!!editingDeal}
        onOpenChange={(open) => !open && setEditingDeal(null)}
        deal={editingDeal}
      />
    </DndContext>
  )
}
