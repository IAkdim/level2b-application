import { supabase } from "@/lib/supabaseClient"

export interface UserSettings {
  id?: string
  user_id?: string
  organization_id: string
  
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
 * Get user settings for current user and organization
 */
export async function getUserSettings(organizationId: string): Promise<UserSettings | null> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
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
 */
export async function upsertUserSettings(
  organizationId: string,
  settings: Partial<UserSettings>
): Promise<UserSettings> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Not authenticated')
  }

  const settingsData = {
    user_id: user.id,
    organization_id: organizationId,
    ...settings
  }

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(settingsData, {
      onConflict: 'user_id,organization_id'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting user settings:', error)
    throw new Error(error.message)
  }

  return data
}

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
