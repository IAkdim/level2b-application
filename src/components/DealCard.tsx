import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Calendar, DollarSign, CheckSquare, Building2, Mail } from 'lucide-react'
import { format } from 'date-fns'
import type { DealWithTaskCount } from '@/types/crm'
import { cn } from '@/lib/utils'
import { useDeleteDeal } from '@/hooks/useDeals'
import { useOrgUsers } from '@/hooks/useOrgUsers'

interface DealCardProps {
  deal: DealWithTaskCount
  isDragging?: boolean
  isDropTarget?: boolean
  onEdit?: (deal: DealWithTaskCount) => void
}

export function DealCard({ deal, isDragging = false, isDropTarget = false, onEdit }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
    isOver,
  } = useSortable({ id: deal.id })

  const deleteDeal = useDeleteDeal()
  const { data: orgUsers } = useOrgUsers()

  // Find the assignee from org users
  const assignee = deal.assigned_to
    ? orgUsers?.find((u) => u.user_id === deal.assigned_to)
    : null

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this deal?')) {
      try {
        await deleteDeal.mutateAsync(deal.id)
      } catch (error) {
        // Error handled by mutation
      }
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-move hover:shadow-md transition-all',
        isDragging && 'shadow-lg rotate-2 ring-2 ring-primary',
        isDropTarget && isOver && 'ring-2 ring-primary ring-offset-2 bg-accent/50'
      )}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{deal.title}</h4>
            {assignee && (
              <div className="flex items-center gap-1 mt-1">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[8px] bg-primary/10">
                    {getInitials(assignee.full_name || assignee.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground truncate">
                  {assignee.full_name || assignee.email}
                </span>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(deal)}>Edit Deal</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-2">
        {/* Lead Info */}
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {getInitials(deal.lead?.name || 'Unknown')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{deal.lead?.name}</div>
            {deal.lead?.company && (
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {deal.lead.company}
              </div>
            )}
          </div>
        </div>

        {/* Deal Value */}
        {deal.value && (
          <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
            <DollarSign className="h-4 w-4" />
            {formatCurrency(deal.value, deal.currency || 'USD')}
          </div>
        )}

        {/* Expected Close Date */}
        {deal.expected_close_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(deal.expected_close_date), 'MMM d, yyyy')}
          </div>
        )}

        {/* Task Count */}
        {deal.task_count !== undefined && deal.task_count > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <CheckSquare className="h-3 w-3" />
            <span>
              {deal.pending_task_count || 0} / {deal.task_count} tasks
            </span>
          </div>
        )}

        {/* Email */}
        {deal.lead?.email && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{deal.lead.email}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
