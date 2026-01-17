import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Bell, Mail, Shield, User, Building2, Link2, Loader2 } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { CompanySettingsForm } from "@/components/CompanySettingsForm"
import { useOrganization } from "@/contexts/OrganizationContext"
import { getUserSettings, upsertUserSettings, getDefaultSettings, type UserSettings } from "@/lib/api/userSettings"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"

interface ConfigSection {
  id: string
  title: string
  description: string
  icon: any
}

const configSections: ConfigSection[] = [
  {
    id: "company",
    title: "Company",
    description: "Company info",
    icon: Building2
  },
  {
    id: "connections",
    title: "Connections",
    description: "External integrations",
    icon: Link2
  },
  {
    id: "profile",
    title: "Profile",
    description: "Personal info",
    icon: User
  },
  {
    id: "email",
    title: "Email", 
    description: "Signature settings",
    icon: Mail
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Alert settings",
    icon: Bell
  },
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Campaign limits",
    icon: Settings
  }
]

export function Configuration() {
  const [selectedSection, setSelectedSection] = useState("company")
  const { theme, setTheme } = useTheme()
  const { selectedOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [settings, setSettings] = useState<UserSettings>(() => getDefaultSettings() as UserSettings)

  // Load user data and settings
  useEffect(() => {
    async function loadData() {
      if (!selectedOrg?.id) return
      
      setIsLoading(true)
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          setUserEmail(user.email)
        }

        // Load user settings
        const userSettings = await getUserSettings(selectedOrg.id)
        if (userSettings) {
          setSettings(userSettings)
        } else {
          // Use defaults for new users
          const defaults = getDefaultSettings()
          setSettings({
            organization_id: selectedOrg.id,
            ...defaults
          } as UserSettings)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        toast.error('Failed to load settings')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [selectedOrg?.id])

  // Save settings to database
  const handleSaveSettings = async () => {
    if (!selectedOrg?.id) return
    
    setIsSaving(true)
    try {
      await upsertUserSettings(selectedOrg.id, settings)
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Full Name</Label>
          <Input
            id="profile-name"
            type="text"
            value={settings.full_name || ''}
            onChange={(e) => setSettings({
              ...settings,
              full_name: e.target.value
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email Address</Label>
          <Input
            id="profile-email"
            type="email"
            value={userEmail}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-timezone">Timezone</Label>
          <Select
            value={settings.timezone || 'Europe/Amsterdam'}
            onValueChange={(value) => setSettings({
              ...settings,
              timezone: value
            })}
          >
            <SelectTrigger id="profile-timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Europe/Amsterdam">Europe/Amsterdam</SelectItem>
              <SelectItem value="Europe/London">Europe/London</SelectItem>
              <SelectItem value="America/New_York">America/New_York</SelectItem>
              <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
              <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
              <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-4 border-t">
        <h4 className="font-medium mb-3">Appearance</h4>
        <div className="space-y-2">
          <Label htmlFor="theme-select">Theme</Label>
          <Select value={theme} onValueChange={(value: "light" | "dark" | "system") => setTheme(value)}>
            <SelectTrigger id="theme-select" className="w-full md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System (Auto)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose your preferred theme. System will match your device settings.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )

  const renderEmailSettings = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email-signature">Email Signature</Label>
        <textarea
          id="email-signature"
          value={settings.email_signature || ''}
          onChange={(e) => setSettings({
            ...settings,
            email_signature: e.target.value
          })}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Use {{sender_name}}, {{company}}, {{phone}} for dynamic values"
        />
        <p className="text-xs text-muted-foreground">
          Variables: sender_name, company, phone (use double braces)
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email-from-name">Default From Name</Label>
          <Input
            id="email-from-name"
            type="text"
            value={settings.default_from_name || ''}
            onChange={(e) => setSettings({
              ...settings,
              default_from_name: e.target.value
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-reply-to">Reply-To Email</Label>
          <Input
            id="email-reply-to"
            type="email"
            value={settings.reply_to_email || ''}
            onChange={(e) => setSettings({
              ...settings,
              reply_to_email: e.target.value
            })}
          />
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="font-medium">Tracking Settings</h4>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="track-opens"
            checked={settings.track_opens ?? true}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              track_opens: checked as boolean
            })}
          />
          <Label htmlFor="track-opens" className="text-sm font-normal cursor-pointer">
            Track email opens
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="track-clicks"
            checked={settings.track_clicks ?? true}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              track_clicks: checked as boolean
            })}
          />
          <Label htmlFor="track-clicks" className="text-sm font-normal cursor-pointer">
            Track link clicks
          </Label>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium">Email Notifications</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-email-replies" className="text-sm font-medium cursor-pointer">
              Email Replies
            </Label>
            <p className="text-xs text-muted-foreground">Get notified when prospects reply</p>
          </div>
          <Checkbox
            id="notif-email-replies"
            checked={settings.notif_email_replies ?? true}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notif_email_replies: checked as boolean
            })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-meeting-bookings" className="text-sm font-medium cursor-pointer">
              Meeting Bookings
            </Label>
            <p className="text-xs text-muted-foreground">Get notified when meetings are scheduled</p>
          </div>
          <Checkbox
            id="notif-meeting-bookings"
            checked={settings.notif_meeting_bookings ?? true}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notif_meeting_bookings: checked as boolean
            })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-campaign-updates" className="text-sm font-medium cursor-pointer">
              Campaign Updates
            </Label>
            <p className="text-xs text-muted-foreground">Get notified about campaign progress</p>
          </div>
          <Checkbox
            id="notif-campaign-updates"
            checked={settings.notif_campaign_updates ?? false}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notif_campaign_updates: checked as boolean
            })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-weekly-reports" className="text-sm font-medium cursor-pointer">
              Weekly Reports
            </Label>
            <p className="text-xs text-muted-foreground">Receive weekly performance summaries</p>
          </div>
          <Checkbox
            id="notif-weekly-reports"
            checked={settings.notif_weekly_reports ?? true}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notif_weekly_reports: checked as boolean
            })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-daily-digest" className="text-sm font-medium cursor-pointer">
              Daily Digest
            </Label>
            <p className="text-xs text-muted-foreground">Daily summary of activities</p>
          </div>
          <Checkbox
            id="notif-daily-digest"
            checked={settings.notif_daily_digest ?? false}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notif_daily_digest: checked as boolean
            })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )

  const renderCampaignSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="campaign-send-limit">Daily Send Limit</Label>
          <Input
            id="campaign-send-limit"
            type="number"
            value={settings.campaign_daily_send_limit ?? 50}
            onChange={(e) => setSettings({
              ...settings,
              campaign_daily_send_limit: parseInt(e.target.value) || 50
            })}
            min="1"
            max="200"
          />
          <p className="text-xs text-muted-foreground">Maximum emails per day</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-followup-delay">Follow-up Delay (days)</Label>
          <Input
            id="campaign-followup-delay"
            type="number"
            value={settings.campaign_followup_delay ?? 3}
            onChange={(e) => setSettings({
              ...settings,
              campaign_followup_delay: parseInt(e.target.value) || 3
            })}
            min="1"
            max="30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-max-followups">Max Follow-ups</Label>
          <Input
            id="campaign-max-followups"
            type="number"
            value={settings.campaign_max_followups ?? 3}
            onChange={(e) => setSettings({
              ...settings,
              campaign_max_followups: parseInt(e.target.value) || 3
            })}
            min="1"
            max="10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-time-start">Sending Time Range</Label>
          <div className="flex space-x-2">
            <Input
              id="campaign-time-start"
              type="time"
              value={settings.campaign_sending_time_start || '09:00'}
              onChange={(e) => setSettings({
                ...settings,
                campaign_sending_time_start: e.target.value
              })}
              className="flex-1"
            />
            <span className="self-center text-muted-foreground">to</span>
            <Input
              id="campaign-time-end"
              type="time"
              value={settings.campaign_sending_time_end || '17:00'}
              onChange={(e) => setSettings({
                ...settings,
                campaign_sending_time_end: e.target.value
              })}
              className="flex-1"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="campaign-exclude-weekends"
          checked={settings.campaign_exclude_weekends ?? true}
          onCheckedChange={(checked) => setSettings({
            ...settings,
            campaign_exclude_weekends: checked as boolean
          })}
        />
        <Label htmlFor="campaign-exclude-weekends" className="text-sm font-normal cursor-pointer">
          Exclude weekends from sending
        </Label>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={selectedSection} onValueChange={setSelectedSection} className="grid grid-cols-1 lg:grid-cols-4 gap-8">{/*... rest stays same ...*/}
        {/* Settings Navigation - Keep card for navigation */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TabsList className="flex flex-col h-auto w-full bg-transparent">
                {configSections.map((section) => (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="w-full justify-start px-4 py-3 data-[state=active]:bg-muted rounded-none first:rounded-t-md last:rounded-b-md"
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <section.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{section.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {section.description}
                        </div>
                      </div>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardContent>
          </Card>

          {/* Security Notice - Keep card for important info */}
          <Card className="border-border/30 bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                API keys and sensitive settings are securely managed server-side.
                Customers do not have access to these configurations.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content - Remove cards, use sections */}
        <div className="lg:col-span-3">
          <TabsContent value="company" className="mt-0">
            <div className="space-y-6">
              <CompanySettingsForm />
            </div>
          </TabsContent>

          <TabsContent value="connections" className="mt-0">
            <div className="space-y-6">
              {/* Calendly Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Calendly Integration</CardTitle>
                </CardHeader>
                <CardContent>
                  <CompanySettingsForm />
                </CardContent>
              </Card>

              {/* Google Integration - Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Google Integration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your Google account for Gmail integration and Google Calendar synchronisation.
                  </p>
                  <Button variant="outline" disabled>
                    <Mail className="mr-2 h-4 w-4" />
                    Available soon
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <div className="space-y-6 bg-muted/30 rounded-lg p-8 border border-border/30">
              <div>
                <h2 className="text-base font-semibold">Profile Settings</h2>
                <p className="text-sm text-muted-foreground">Personal information and preferences</p>
              </div>
              {renderProfileSettings()}
            </div>
          </TabsContent>

          <TabsContent value="email" className="mt-0">
            <div className="space-y-6 bg-muted/30 rounded-lg p-8 border border-border/30">
              <div>
                <h2 className="text-base font-semibold">Email Settings</h2>
                <p className="text-sm text-muted-foreground">Email signature and sending preferences</p>
              </div>
              {renderEmailSettings()}
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <div className="space-y-6 bg-muted/30 rounded-lg p-8 border border-border/30">
              <div>
                <h2 className="text-base font-semibold">Notifications</h2>
                <p className="text-sm text-muted-foreground">Alert preferences and timing</p>
              </div>
              {renderNotificationSettings()}
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-0">
            <div className="space-y-6 bg-muted/30 rounded-lg p-8 border border-border/30">
              <div>
                <h2 className="text-base font-semibold">Campaign Settings</h2>
                <p className="text-sm text-muted-foreground">Default campaign behavior and limits</p>
              </div>
              {renderCampaignSettings()}
            </div>
          </TabsContent>
        </div>
      </Tabs>
      )}
    </div>
  )
}
