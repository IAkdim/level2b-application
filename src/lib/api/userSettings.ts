import { supabase } from "@/lib/supabaseClient"

export interface UserSettings {
  id?: string
  user_id?: string

  // Company/Business settings
  company_name?: string
  company_description?: string
  product_service?: string
  unique_selling_points?: string[]
  target_audience?: string
  industry?: string

  // Calendly settings
  calendly_access_token?: string
  calendly_refresh_token?: string
  calendly_event_type_uri?: string
  calendly_scheduling_url?: string
  calendly_event_type_name?: string

  // Profile settings
  full_name?: string
  timezone?: string

  // Email settings
  email_signature?: string
  default_from_name?: string
  reply_to_email?: string
  track_opens?: boolean
  track_clicks?: boolean

  // Notification settings
  notif_email_replies?: boolean
  notif_meeting_bookings?: boolean
  notif_campaign_updates?: boolean
  notif_weekly_reports?: boolean
  notif_daily_digest?: boolean

  // Campaign settings
  campaign_daily_send_limit?: number
  campaign_followup_delay?: number
  campaign_max_followups?: number
  campaign_sending_time_start?: string
  campaign_sending_time_end?: string
  campaign_exclude_weekends?: boolean

  created_at?: string
  updated_at?: string
}

/**
 * Get user settings for current user
 */
export async function getUserSettings(): Promise<UserSettings | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings found, return defaults
      return null
    }
    console.error('Error fetching user settings:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Create or update user settings
 * Uses a check-then-insert/update pattern for compatibility with databases
 * that may not have the unique constraint on user_id
 */
export async function upsertUserSettings(
  settings: Partial<UserSettings>
): Promise<UserSettings> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // First check if settings already exist for this user
  const { data: existing } = await supabase
    .from('user_settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const settingsData = {
    user_id: user.id,
    ...settings
  }

  let data: UserSettings | null = null
  let error: { message: string } | null = null

  if (existing?.id) {
    // Update existing record
    const result = await supabase
      .from('user_settings')
      .update(settingsData)
      .eq('id', existing.id)
      .select()
      .single()
    data = result.data
    error = result.error
  } else {
    // Insert new record
    const result = await supabase
      .from('user_settings')
      .insert(settingsData)
      .select()
      .single()
    data = result.data
    error = result.error
  }

  if (error) {
    console.error('Error upserting user settings:', error)
    throw new Error(error.message)
  }

  return data as UserSettings
}

/**
 * Update user settings (alias for upsertUserSettings for compatibility)
 */
export const updateUserSettings = upsertUserSettings

/**
 * Get default settings (when no settings exist yet)
 */
export function getDefaultSettings(): Partial<UserSettings> {
  return {
    timezone: 'Europe/Amsterdam',
    email_signature: 'Best regards,\n{{sender_name}}\n{{company}}\n{{phone}}',
    track_opens: true,
    track_clicks: true,
    notif_email_replies: true,
    notif_meeting_bookings: true,
    notif_campaign_updates: false,
    notif_weekly_reports: true,
    notif_daily_digest: false,
    campaign_daily_send_limit: 50,
    campaign_followup_delay: 3,
    campaign_max_followups: 3,
    campaign_sending_time_start: '09:00',
    campaign_sending_time_end: '17:00',
    campaign_exclude_weekends: true
  }
}
