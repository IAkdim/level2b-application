// API functions for Calendly integration
import { supabase } from '../supabaseClient'
import { rateLimiter } from './rateLimiter'
import { getUserSettings, type UserSettings } from './userSettings'

export interface CalendlyEventType {
  uri: string
  name: string
  scheduling_url: string
  duration: number
  active: boolean
  description_plain?: string
}


/**
 * Initiate Calendly OAuth flow
 * Returns the authorization URL to redirect the user to
 */
export async function initiateCalendlyOAuth(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase.functions.invoke('calendly-oauth-init', {
    body: { userId: user.id },
  })

  if (error) {
    console.error('[calendly.ts] Error initiating Calendly OAuth:', error)
    throw error
  }

  if (data.error) {
    console.error('[calendly.ts] Data error:', data.error)
    throw new Error(data.error)
  }

  return data.authUrl
}

/**
 * Get available Calendly event types (scheduling links)
 */
export async function getCalendlyEventTypes(): Promise<CalendlyEventType[]> {
  // Rate limit check
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const rateCheck = await rateLimiter.checkLimit('calendly', session.user.id)
  if (!rateCheck.allowed) {
    throw new Error(rateCheck.message || 'Too many Calendly API requests. Please try again later.')
  }

  const { data, error } = await supabase.functions.invoke('calendly-get-event-types', {
    body: { userId: session.user.id },
  })

  if (error) {
    console.error('Error fetching Calendly event types:', error)
    throw error
  }

  if (data.error) {
    throw new Error(data.error)
  }

  return data.eventTypes || []
}

/**
 * Disconnect Calendly by removing tokens
 */
export async function disconnectCalendly(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('user_settings')
    .update({
      calendly_access_token: null,
      calendly_refresh_token: null,
      calendly_event_type_uri: null,
      calendly_scheduling_url: null,
      calendly_event_type_name: null,
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error disconnecting Calendly:', error)
    throw error
  }
}

/**
 * Check if Calendly is connected for current user
 */
export async function isCalendlyConnected(): Promise<boolean> {
  const settings = await getUserSettings()
  return !!(settings?.calendly_access_token)
}
