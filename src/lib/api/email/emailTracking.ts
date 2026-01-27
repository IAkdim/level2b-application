/**
 * Email tracking metadata CRUD operations
 * Stores only IDs (thread_id, message_id) in Supabase, not email content
 */

import { supabase } from "@/lib/supabaseClient"
import type { EmailTrackingMetadata } from './types'

/**
 * Save email tracking metadata after sending an email
 */
export async function saveEmailTracking(data: {
  threadId: string
  messageId: string
  provider: 'gmail' | 'outlook'
  label?: string
  leadId?: string
  sentAt?: Date
}): Promise<EmailTrackingMetadata | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('No authenticated user')
      return null
    }

    const { data: result, error } = await supabase
      .from('email_tracking_metadata')
      .insert({
        user_id: user.id,
        thread_id: data.threadId,
        message_id: data.messageId,
        provider: data.provider,
        label: data.label,
        lead_id: data.leadId,
        sent_at: data.sentAt?.toISOString() || new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving email tracking:', error)
      return null
    }

    return result
  } catch (error) {
    console.error('Exception in saveEmailTracking:', error)
    return null
  }
}

/**
 * Get all tracked emails for the current user
 */
export async function getTrackedEmails(filters?: {
  leadId?: string
  label?: string
  provider?: 'gmail' | 'outlook'
}): Promise<EmailTrackingMetadata[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return []
    }

    let query = supabase
      .from('email_tracking_metadata')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })

    if (filters?.leadId) {
      query = query.eq('lead_id', filters.leadId)
    }

    if (filters?.label) {
      query = query.eq('label', filters.label)
    }

    if (filters?.provider) {
      query = query.eq('provider', filters.provider)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching tracked emails:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception in getTrackedEmails:', error)
    return []
  }
}

/**
 * Get tracked email by message ID
 */
export async function getTrackedEmailByMessageId(
  messageId: string,
  provider: 'gmail' | 'outlook' = 'gmail'
): Promise<EmailTrackingMetadata | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    const { data, error } = await supabase
      .from('email_tracking_metadata')
      .select('*')
      .eq('user_id', user.id)
      .eq('message_id', messageId)
      .eq('provider', provider)
      .single()

    if (error) {
      console.error('Error fetching tracked email:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Exception in getTrackedEmailByMessageId:', error)
    return null
  }
}

/**
 * Get all tracked emails for a specific thread
 */
export async function getTrackedEmailsByThreadId(
  threadId: string,
  provider: 'gmail' | 'outlook' = 'gmail'
): Promise<EmailTrackingMetadata[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return []
    }

    const { data, error } = await supabase
      .from('email_tracking_metadata')
      .select('*')
      .eq('user_id', user.id)
      .eq('thread_id', threadId)
      .eq('provider', provider)
      .order('sent_at', { ascending: true })

    if (error) {
      console.error('Error fetching tracked emails by thread:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception in getTrackedEmailsByThreadId:', error)
    return []
  }
}

/**
 * Delete email tracking metadata
 */
export async function deleteEmailTracking(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('email_tracking_metadata')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting email tracking:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Exception in deleteEmailTracking:', error)
    return false
  }
}
