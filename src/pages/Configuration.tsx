import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Bell, Mail, Shield, Save, User } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"

interface ConfigSection {
  id: string
  title: string
  description: string
  icon: any
}

const configSections: ConfigSection[] = [
  {
    id: "profile",
    title: "Profile Settings",
    description: "Personal information and preferences",
    icon: User
  },
  {
    id: "email",
    title: "Email Settings", 
    description: "Email signature and sending preferences",
    icon: Mail
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Alert preferences and timing",
    icon: Bell
  },
  {
    id: "campaigns",
    title: "Campaign Settings",
    description: "Default campaign behavior and limits",
    icon: Settings
  }
]

export function Configuration() {
  const [selectedSection, setSelectedSection] = useState("profile")
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState({
    profile: {
      name: "John Doe",
      email: "john@company.com",
      company: "Your Company",
      timezone: "Europe/Amsterdam"
    },
    email: {
      signature: "Best regards,\n{{sender_name}}\n{{company}}\n{{phone}}",
      defaultFromName: "John Doe",
      replyToEmail: "john@company.com",
      trackOpens: true,
      trackClicks: true
    },
    notifications: {
      emailReplies: true,
      meetingBookings: true,
      campaignUpdates: false,
      weeklyReports: true,
      dailyDigest: false
    },
    campaigns: {
      dailySendLimit: 50,
      followUpDelay: 3,
      maxFollowUps: 3,
      sendingTimeStart: "09:00",
      sendingTimeEnd: "17:00",
      excludeWeekends: true
    }
  })

  const handleSaveSettings = () => {
    // Here you would save to your backend
    alert("Settings saved successfully!")
  }

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Full Name</Label>
          <Input
            id="profile-name"
            type="text"
            value={settings.profile.name}
            onChange={(e) => setSettings({
              ...settings,
              profile: { ...settings.profile, name: e.target.value }
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email Address</Label>
          <Input
            id="profile-email"
            type="email"
            value={settings.profile.email}
            onChange={(e) => setSettings({
              ...settings,
              profile: { ...settings.profile, email: e.target.value }
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-company">Company</Label>
          <Input
            id="profile-company"
            type="text"
            value={settings.profile.company}
            onChange={(e) => setSettings({
              ...settings,
              profile: { ...settings.profile, company: e.target.value }
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-timezone">Timezone</Label>
          <Select
            value={settings.profile.timezone}
            onValueChange={(value) => setSettings({
              ...settings,
              profile: { ...settings.profile, timezone: value }
            })}
          >
            <SelectTrigger id="profile-timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Europe/Amsterdam">Europe/Amsterdam</SelectItem>
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
    </div>
  )

  const renderEmailSettings = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email-signature">Email Signature</Label>
        <textarea
          id="email-signature"
          value={settings.email.signature}
          onChange={(e) => setSettings({
            ...settings,
            email: { ...settings.email, signature: e.target.value }
          })}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Use {{sender_name}}, {{company}}, {{phone}} for dynamic values"
        />
        <p className="text-xs text-muted-foreground">
          Variables: sender_name, company, phone (gebruik dubbele accolades)
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email-from-name">Default From Name</Label>
          <Input
            id="email-from-name"
            type="text"
            value={settings.email.defaultFromName}
            onChange={(e) => setSettings({
              ...settings,
              email: { ...settings.email, defaultFromName: e.target.value }
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-reply-to">Reply-To Email</Label>
          <Input
            id="email-reply-to"
            type="email"
            value={settings.email.replyToEmail}
            onChange={(e) => setSettings({
              ...settings,
              email: { ...settings.email, replyToEmail: e.target.value }
            })}
          />
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="font-medium">Tracking Settings</h4>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="track-opens"
            checked={settings.email.trackOpens}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              email: { ...settings.email, trackOpens: checked as boolean }
            })}
          />
          <Label htmlFor="track-opens" className="text-sm font-normal cursor-pointer">
            Track email opens
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="track-clicks"
            checked={settings.email.trackClicks}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              email: { ...settings.email, trackClicks: checked as boolean }
            })}
          />
          <Label htmlFor="track-clicks" className="text-sm font-normal cursor-pointer">
            Track link clicks
          </Label>
        </div>
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
            checked={settings.notifications.emailReplies}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, emailReplies: checked as boolean }
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
            checked={settings.notifications.meetingBookings}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, meetingBookings: checked as boolean }
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
            checked={settings.notifications.campaignUpdates}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, campaignUpdates: checked as boolean }
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
            checked={settings.notifications.weeklyReports}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, weeklyReports: checked as boolean }
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
            checked={settings.notifications.dailyDigest}
            onCheckedChange={(checked) => setSettings({
              ...settings,
              notifications: { ...settings.notifications, dailyDigest: checked as boolean }
            })}
          />
        </div>
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
            value={settings.campaigns.dailySendLimit}
            onChange={(e) => setSettings({
              ...settings,
              campaigns: { ...settings.campaigns, dailySendLimit: parseInt(e.target.value) }
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
            value={settings.campaigns.followUpDelay}
            onChange={(e) => setSettings({
              ...settings,
              campaigns: { ...settings.campaigns, followUpDelay: parseInt(e.target.value) }
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
            value={settings.campaigns.maxFollowUps}
            onChange={(e) => setSettings({
              ...settings,
              campaigns: { ...settings.campaigns, maxFollowUps: parseInt(e.target.value) }
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
              value={settings.campaigns.sendingTimeStart}
              onChange={(e) => setSettings({
                ...settings,
                campaigns: { ...settings.campaigns, sendingTimeStart: e.target.value }
              })}
              className="flex-1"
            />
            <span className="self-center text-muted-foreground">to</span>
            <Input
              id="campaign-time-end"
              type="time"
              value={settings.campaigns.sendingTimeEnd}
              onChange={(e) => setSettings({
                ...settings,
                campaigns: { ...settings.campaigns, sendingTimeEnd: e.target.value }
              })}
              className="flex-1"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="campaign-exclude-weekends"
          checked={settings.campaigns.excludeWeekends}
          onCheckedChange={(checked) => setSettings({
            ...settings,
            campaigns: { ...settings.campaigns, excludeWeekends: checked as boolean }
          })}
        />
        <Label htmlFor="campaign-exclude-weekends" className="text-sm font-normal cursor-pointer">
          Exclude weekends from sending
        </Label>
      </div>
    </div>
  )

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Beheer je account instellingen en voorkeuren
          </p>
        </div>
        <Button onClick={handleSaveSettings} size="sm">
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <Tabs value={selectedSection} onValueChange={setSelectedSection} className="grid grid-cols-1 lg:grid-cols-4 gap-8">
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
                    <div className="flex items-center space-x-3">
                      <section.icon className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium text-sm">{section.title}</div>
                        <div className="text-xs text-muted-foreground">
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
                API keys en gevoelige instellingen worden veilig beheerd op server-side.
                Klanten hebben geen toegang tot deze configuraties.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content - Remove cards, use sections */}
        <div className="lg:col-span-3">
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
    </div>
  )
}
