// API functions for meetings
import { supabase } from '../supabaseClient'

export interface Meeting {
  id: string
  user_id: string
  lead_id: string | null
  // Calendly Data
  calendly_event_id: string
  calendly_uri: string
  event_type_name: string
  event_type_uri: string
  // Meeting Details
  name: string
  email: string
  status: 'active' | 'canceled'
  start_time: string
  end_time: string
  location: string | null
  // Invitee Information
  invitee_name: string | null
  invitee_email: string | null
  invitee_timezone: string | null
  // Additional Data
  cancel_reason: string | null
  cancellation_reason: string | null
  rescheduled: boolean
  questions_and_answers: any[]
  tracking: Record<string, any>
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  // Joined data
  lead?: {
    id: string
    name: string
    email: string
    company: string | null
  }
}

/**
 * Get all meetings for user
 */
export async function getUserMeetings(userId: string): Promise<Meeting[]> {
  console.log('[getUserMeetings] Fetching meetings for userId:', userId)

  const { data, error } = await supabase
    .from('calendly_meetings')
    .select(`
      *,
      lead:leads (
        id,
        name,
        email,
        company
      )
    `)
    .eq('user_id', userId)
    .order('start_time', { ascending: false })

  console.log('[getUserMeetings] Query result:', { dataLength: data?.length, error })

  if (error) {
    console.error('[getUserMeetings] Error fetching meetings:', error)
    throw error
  }

  return data || []
}

/**
 * Get upcoming meetings for a user
 */
export async function getUpcomingMeetings(userId: string): Promise<Meeting[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('calendly_meetings')
    .select(`
      *,
      lead:leads (
        id,
        name,
        email,
        company
      )
    `)
    .eq('user_id', userId)
    .gte('start_time', now)
    .eq('status', 'active')
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Error fetching upcoming meetings:', error)
    throw error
  }

  return data || []
}

/**
 * Get meeting by ID
 */
export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from('calendly_meetings')
    .select(`
      *,
      lead:leads (
        id,
        name,
        email,
        company
      )
    `)
    .eq('id', meetingId)
    .single()

  if (error) {
    console.error('Error fetching meeting:', error)
    throw error
  }

  return data
}

/**
 * Update meeting status
 */
export async function updateMeetingStatus(
  meetingId: string,
  status: Meeting['status'],
  cancelReason?: string
): Promise<void> {
  const updates: any = { status }

  if (status === 'canceled') {
    updates.cancel_reason = cancelReason
  }

  const { error } = await supabase
    .from('calendly_meetings')
    .update(updates)
    .eq('id', meetingId)

  if (error) {
    console.error('Error updating meeting status:', error)
    throw error
  }
}

/**
 * Sync meetings from Calendly via API
 * Fetches scheduled events from Calendly and syncs to database
 */
export async function syncCalendlyMeetings(): Promise<{
  synced: number
  skipped: number
  total: number
}> {
  const { data, error } = await supabase.functions.invoke('calendly-sync-meetings')

  if (error) {
    console.error('Error syncing Calendly meetings:', error)
    throw error
  }

  if (data.error) {
    throw new Error(data.error)
  }

  return {
    synced: data.synced || 0,
    skipped: data.skipped || 0,
    total: data.total || 0,
  }
}
