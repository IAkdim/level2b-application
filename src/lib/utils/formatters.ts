import { formatDistanceToNow } from "date-fns"
import type { LeadStatus } from "@/types/crm"

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * Returns "Never" if date is null/undefined or invalid
 */
export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return 'Never'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Never'
  }
}

/**
 * Get badge variant for lead status
 */
export function getStatusVariant(status: LeadStatus): 'default' | 'secondary' {
  const variants: Record<LeadStatus, 'default' | 'secondary'> = {
    new: 'default',
    contacted: 'secondary',
    replied: 'default',
    meeting_scheduled: 'default',
    closed: 'default',
    lost: 'secondary',
  }
  return variants[status]
}
