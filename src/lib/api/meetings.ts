// API functions for meetings
import { supabase } from '../supabaseClient'

export interface Meeting {
  id: string
  org_id: string
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
 * Get all meetings for an organization
 */
export async function getMeetings(orgId: string): Promise<Meeting[]> {
  console.log('[getMeetings] Fetching meetings for orgId:', orgId)
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
    .eq('org_id', orgId)
    .order('start_time', { ascending: false })

  console.log('[getMeetings] Query result:', { dataLength: data?.length, error })

  if (error) {
    console.error('[getMeetings] Error fetching meetings:', error)
    throw error
  }

  return data || []
}

/**
 * Get upcoming meetings for an organization
 */
export async function getUpcomingMeetings(orgId: string): Promise<Meeting[]> {
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
    .eq('org_id', orgId)
    .gte('scheduled_at', now)
    .in('status', ['scheduled', 'confirmed'])
    .order('scheduled_at', { ascending: true })

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
    .from('meetings')
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
 * Create a new meeting manually
 */
export async function createMeeting(
  orgId: string,
  meeting: {
    lead_id?: string
    title: string
    description?: string
    scheduled_at: string
    duration_minutes: number
    location?: string
    meeting_url?: string
    attendee_name?: string
    attendee_email?: string
  }
): Promise<Meeting> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      org_id: orgId,
      ...meeting,
      status: 'scheduled',
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating meeting:', error)
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
  const { data: { user } } = await supabase.auth.getUser()

  const updates: any = { status }

  if (status === 'canceled') {
    updates.canceled_at = new Date().toISOString()
    updates.canceled_by = user?.id
    updates.cancel_reason = cancelReason
  }

  const { error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', meetingId)

  if (error) {
    console.error('Error updating meeting status:', error)
    throw error
  }
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(meetingId: string): Promise<void> {
  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', meetingId)

  if (error) {
    console.error('Error deleting meeting:', error)
    throw error
  }
}

/**
 * Sync meetings from Calendly via API
 * Fetches scheduled events from Calendly and syncs to database
 */
export async function syncCalendlyMeetings(orgId: string): Promise<{
  synced: number
  skipped: number
  total: number
}> {
  const { data, error } = await supabase.functions.invoke('calendly-sync-meetings', {
    body: { orgId },
  })

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
