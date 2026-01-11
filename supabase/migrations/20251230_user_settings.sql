-- User settings table for profile, email, notifications, and campaign preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Profile settings
  full_name TEXT,
  timezone TEXT DEFAULT 'Europe/Amsterdam',
  
  -- Email settings
  email_signature TEXT,
  default_from_name TEXT,
  reply_to_email TEXT,
  track_opens BOOLEAN DEFAULT true,
  track_clicks BOOLEAN DEFAULT true,
  
  -- Notification settings
  notif_email_replies BOOLEAN DEFAULT true,
  notif_meeting_bookings BOOLEAN DEFAULT true,
  notif_campaign_updates BOOLEAN DEFAULT false,
  notif_weekly_reports BOOLEAN DEFAULT true,
  notif_daily_digest BOOLEAN DEFAULT false,
  
  -- Campaign settings
  campaign_daily_send_limit INTEGER DEFAULT 50,
  campaign_followup_delay INTEGER DEFAULT 3,
  campaign_max_followups INTEGER DEFAULT 3,
  campaign_sending_time_start TIME DEFAULT '09:00',
  campaign_sending_time_end TIME DEFAULT '17:00',
  campaign_exclude_weekends BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_settings_timestamp
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Index for faster lookups
CREATE INDEX idx_user_settings_user_org ON user_settings(user_id, organization_id);
