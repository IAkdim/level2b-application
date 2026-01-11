// API functions for Calendly integration
import { supabase } from '../supabaseClient'
import { rateLimiter } from './rateLimiter'

export interface CalendlyEventType {
  uri: string
  name: string
  scheduling_url: string
  duration: number
  active: boolean
  description_plain?: string
}

export interface OrganizationSettings {
  id: string
  org_id: string
  calendly_access_token?: string
  calendly_user_uri?: string
  calendly_scheduling_url?: string
  calendly_event_type_uri?: string
  calendly_event_type_name?: string
  company_name?: string
  company_description?: string
  product_service?: string
  target_audience?: string
  industry?: string
  unique_selling_points?: string[]
}

/**
 * Get organization settings including Calendly connection status
 */
export async function getOrganizationSettings(orgId: string): Promise<OrganizationSettings | null> {
  const { data, error } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching organization settings:', error)
    throw error
  }

  return data
}

/**
 * Update organization settings
 */
export async function updateOrganizationSettings(
  orgId: string,
  updates: Partial<OrganizationSettings>
): Promise<void> {
  // First, try to update existing row
  const { data: updateData, error: updateError } = await supabase
    .from('organization_settings')
    .update(updates)
    .eq('org_id', orgId)
    .select()

  // If update succeeded and returned data, we're done
  if (updateData && updateData.length > 0) {
    return
  }

  // If update failed with real error (not just no rows), throw it
  if (updateError) {
    console.error('[updateOrganizationSettings] Update error:', updateError)
    throw updateError
  }

  // If update succeeded but no rows affected, insert new row
  const { data: insertData, error: insertError } = await supabase
    .from('organization_settings')
    .insert({ org_id: orgId, ...updates })
    .select()

  if (insertError) {
    console.error('[updateOrganizationSettings] Insert error:', insertError)
    throw insertError
  }
}

/**
 * Initiate Calendly OAuth flow
 * Returns the authorization URL to redirect the user to
 */
export async function initiateCalendlyOAuth(orgId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('calendly-oauth-init', {
    body: { orgId },
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
export async function getCalendlyEventTypes(orgId: string): Promise<CalendlyEventType[]> {
  // Rate limit check
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const rateCheck = await rateLimiter.checkLimit('calendly', session.user.id)
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.message || 'Too many Calendly API requests. Please try again later.')
    }
  }

  const { data, error } = await supabase.functions.invoke('calendly-get-event-types', {
    body: { orgId },
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
export async function disconnectCalendly(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('organization_settings')
    .update({
      calendly_access_token: null,
      calendly_refresh_token: null,
      calendly_token_expires_at: null,
      calendly_user_uri: null,
      calendly_scheduling_url: null,
      calendly_event_type_uri: null,
      calendly_event_type_name: null,
    })
    .eq('org_id', orgId)

  if (error) {
    console.error('Error disconnecting Calendly:', error)
    throw error
  }
}

/**
 * Check if Calendly is connected for an organization
 */
export async function isCalendlyConnected(orgId: string): Promise<boolean> {
  const settings = await getOrganizationSettings(orgId)
  return !!(settings?.calendly_access_token)
}
