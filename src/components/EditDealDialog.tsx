import { useState, useEffect } from 'react'
import { useUpdateDeal } from '@/hooks/useDeals'
import { useOrgUsers } from '@/hooks/useOrgUsers'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { DealWithTaskCount, DealStage } from '@/types/crm'
import { format } from 'date-fns'

interface EditDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal: DealWithTaskCount | null
}

export function EditDealDialog({ open, onOpenChange, deal }: EditDealDialogProps) {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [stage, setStage] = useState<DealStage>('lead')
  const [assignedTo, setAssignedTo] = useState('')
  const [probability, setProbability] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lostReason, setLostReason] = useState('')

  const updateDeal = useUpdateDeal()
  const { data: orgUsers } = useOrgUsers()

  // Populate form when deal changes
  useEffect(() => {
    if (deal) {
      setTitle(deal.title)
      setValue(deal.value?.toString() || '')
      setCurrency(deal.currency || 'USD')
      setStage(deal.stage)
      setAssignedTo(deal.assigned_to || 'unassigned')
      setProbability(deal.probability?.toString() || '')
      setExpectedCloseDate(
        deal.expected_close_date
          ? format(new Date(deal.expected_close_date), 'yyyy-MM-dd')
          : ''
      )
      setNotes(deal.notes || '')
      setLostReason(deal.lost_reason || '')
    }
  }, [deal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!deal || !title.trim()) {
      return
    }

    try {
      await updateDeal.mutateAsync({
        dealId: deal.id,
        input: {
          title: title.trim(),
          value: value ? parseFloat(value) : undefined,
          currency,
          stage,
          assigned_to: assignedTo === 'unassigned' ? undefined : assignedTo,
          probability: probability ? parseInt(probability) : undefined,
          expected_close_date: expectedCloseDate || undefined,
          notes: notes.trim() || undefined,
          lost_reason: stage === 'closed_lost' && lostReason ? lostReason.trim() : undefined,
        },
      })

      onOpenChange(false)
    } catch (error: any) {
      // Error handled by mutation hook
    }
  }

  if (!deal) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
          <DialogDescription>
            Update the deal details. Title is required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead Info (Read-only) */}
          <div className="space-y-2">
            <Label>Lead</Label>
            <div className="p-2 bg-muted rounded-md text-sm">
              {deal.lead?.name} - {deal.lead?.email}
              {deal.lead?.company && ` (${deal.lead.company})`}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Deal Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Value & Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="value">Deal Value</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stage & Assigned To */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as DealStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed_won">Closed Won</SelectItem>
                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {orgUsers?.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email || 'Unknown User'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Probability */}
          <div className="space-y-2">
            <Label htmlFor="probability">Probability (%)</Label>
            <Input
              id="probability"
              type="number"
              min="0"
              max="100"
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
            />
          </div>

          {/* Expected Close Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
            <Input
              id="expectedCloseDate"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>

          {/* Actual Close Date (Read-only if set) */}
          {deal.actual_close_date && (
            <div className="space-y-2">
              <Label>Actual Close Date</Label>
              <div className="p-2 bg-muted rounded-md text-sm">
                {format(new Date(deal.actual_close_date), 'MMM d, yyyy')}
              </div>
            </div>
          )}

          {/* Lost Reason (only for closed_lost) */}
          {stage === 'closed_lost' && (
            <div className="space-y-2">
              <Label htmlFor="lostReason">Lost Reason</Label>
              <Textarea
                id="lostReason"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                rows={2}
                placeholder="Why was this deal lost?"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional details about this deal..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateDeal.isPending}>
              {updateDeal.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Deal'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
