/**
 * Email tracking metadata CRUD operations
 * Stores only IDs (thread_id, message_id) in Supabase, not email content
 */

import { supabase } from "@/lib/supabaseClient"
import type { EmailTrackingMetadata } from './types'

/**
 * Save email tracking metadata after sending an email
 * Returns the metadata record which can be linked to email_tracking table
 */
export async function saveEmailTracking(data: {
  threadId: string
  messageId: string
  provider: 'gmail' | 'outlook'
  campaignName?: string
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
        campaign_name: data.campaignName,
        lead_id: data.leadId,
        sent_at: data.sentAt?.toISOString() || new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving email tracking:', error)
      return null
    }

    console.log('Saved email_tracking_metadata:', result.id, 'for message:', data.messageId)
    return result
  } catch (error) {
    console.error('Exception in saveEmailTracking:', error)
    return null
  }
}

/**
 * Link email_tracking record to email_tracking_metadata
 * Call this after open tracking record is created in email_tracking table
 */
export async function linkOpenTrackingToMetadata(
  trackingId: string,
  metadataId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('email_tracking')
      .update({ tracking_metadata_id: metadataId })
      .eq('tracking_id', trackingId)

    if (error) {
      console.error('Error linking tracking to metadata:', error)
      return false
    }

    console.log('Linked email_tracking', trackingId, 'to metadata', metadataId)
    return true
  } catch (error) {
    console.error('Exception linking tracking:', error)
    return false
  }
}

/**
 * Get all tracked emails for the current user
 */
export async function getTrackedEmails(filters?: {
  leadId?: string
  campaignName?: string
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

    if (filters?.campaignName) {
      query = query.eq('campaign_name', filters.campaignName)
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

/**
 * Get lead associations for message IDs
 * Returns a map of message_id -> lead_id
 */
export async function getLeadAssociationsByMessageIds(
  messageIds: string[],
  provider: 'gmail' | 'outlook' = 'gmail'
): Promise<Map<string, string>> {
  try {
    if (messageIds.length === 0) return new Map()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Map()

    const { data, error } = await supabase
      .from('email_tracking_metadata')
      .select('message_id, lead_id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .in('message_id', messageIds)
      .not('lead_id', 'is', null)

    if (error) {
      console.error('Error fetching lead associations:', error)
      return new Map()
    }

    const map = new Map<string, string>()
    data?.forEach(row => {
      if (row.lead_id) {
        map.set(row.message_id, row.lead_id)
      }
    })

    console.log(`Found ${map.size} lead associations for ${messageIds.length} messages`)
    return map
  } catch (error) {
    console.error('Exception in getLeadAssociationsByMessageIds:', error)
    return new Map()
  }
}

/**
 * Get all unique campaign names for the current user
 * Used for campaign filter dropdown
 */
export async function getAllCampaignNames(): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('email_tracking_metadata')
      .select('campaign_name')
      .eq('user_id', user.id)
      .not('campaign_name', 'is', null)
      .order('campaign_name')

    if (error) {
      console.error('Error fetching campaign names:', error)
      return []
    }

    // Return unique campaign names
    const campaigns = [...new Set(data?.map(d => d.campaign_name).filter(Boolean) || [])]
    return campaigns as string[]
  } catch (error) {
    console.error('Exception in getAllCampaignNames:', error)
    return []
  }
}

/**
 * Get lead associations for thread IDs
 * Returns a map of thread_id -> lead_id[]
 */
export async function getLeadAssociationsByThreadIds(
  threadIds: string[],
  provider: 'gmail' | 'outlook' = 'gmail'
): Promise<Map<string, string[]>> {
  try {
    if (threadIds.length === 0) return new Map()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Map()

    const { data, error } = await supabase
      .from('email_tracking_metadata')
      .select('thread_id, lead_id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .in('thread_id', threadIds)
      .not('lead_id', 'is', null)

    if (error) {
      console.error('Error fetching lead associations by thread:', error)
      return new Map()
    }

    const map = new Map<string, string[]>()
    data?.forEach(row => {
      if (row.lead_id) {
        const existing = map.get(row.thread_id) || []
        existing.push(row.lead_id)
        map.set(row.thread_id, existing)
      }
    })

    console.log(`Found lead associations for ${map.size}/${threadIds.length} threads`)
    return map
  } catch (error) {
    console.error('Exception in getLeadAssociationsByThreadIds:', error)
    return new Map()
  }
}

/**
 * Get all tracked thread IDs for current user
 * Replaces label-based filtering with database-driven approach
 */
export async function getTrackedThreadIds(filters?: {
  leadId?: string
  provider?: 'gmail' | 'outlook'
  startDate?: Date
  endDate?: Date
  campaignName?: string
  limit?: number
  offset?: number
}): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
      .from('email_tracking_metadata')
      .select('thread_id')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })

    if (filters?.leadId) {
      query = query.eq('lead_id', filters.leadId)
    }

    if (filters?.provider) {
      query = query.eq('provider', filters.provider)
    }

    if (filters?.campaignName) {
      query = query.eq('campaign_name', filters.campaignName)
    }

    if (filters?.startDate) {
      query = query.gte('sent_at', filters.startDate.toISOString())
    }

    if (filters?.endDate) {
      query = query.lte('sent_at', filters.endDate.toISOString())
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching tracked thread IDs:', error)
      return []
    }

    // Return unique thread IDs
    const threadIds = [...new Set(data?.map(d => d.thread_id) || [])]
    console.log(`Found ${threadIds.length} unique tracked threads`)
    return threadIds
  } catch (error) {
    console.error('Exception in getTrackedThreadIds:', error)
    return []
  }
}
