// src/components/CompanySettingsForm.tsx
// Form for company information with Calendly OAuth integration

import { useState, useEffect } from 'react'
import {
  initiateCalendlyOAuth,
  getCalendlyEventTypes,
  disconnectCalendly,
  type CalendlyEventType,
} from '@/lib/api/calendly'
import {
  getUserSettings,
  updateUserSettings,
  type UserSettings,
} from '@/lib/api/userSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, Plus, X, Building2, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { eventBus } from '@/lib/eventBus'

interface CompanySettingsFormProps {
  showOnlyCalendly?: boolean
}

export function CompanySettingsForm({ showOnlyCalendly = false }: CompanySettingsFormProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<Partial<UserSettings>>({
    company_name: '',
    company_description: '',
    product_service: '',
    unique_selling_points: [],
    target_audience: '',
    industry: '',
  })
  const [newUsp, setNewUsp] = useState('')

  // Calendly state
  const [isCalendlyConnected, setIsCalendlyConnected] = useState(false)
  const [isConnectingCalendly, setIsConnectingCalendly] = useState(false)
  const [eventTypes, setEventTypes] = useState<CalendlyEventType[]>([])
  const [selectedEventTypeUri, setSelectedEventTypeUri] = useState<string>('')

  const loadEventTypes = async () => {
    try {
      const types = await getCalendlyEventTypes()
      setEventTypes(types)
    } catch (error) {
      console.error('Error loading event types:', error)
      toast.error('Error loading Calendly event types')
    }
  }

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await getUserSettings()
      
      // Always set settings, even if data is null
      setSettings({
        company_name: data?.company_name || '',
        company_description: data?.company_description || '',
        product_service: data?.product_service || '',
        unique_selling_points: data?.unique_selling_points || [],
        target_audience: data?.target_audience || '',
        industry: data?.industry || '',
      })

      // Check if Calendly is connected
      const connected = !!(data?.calendly_access_token)
      setIsCalendlyConnected(connected)

      // If connected, load event types
      if (connected && data) {
        await loadEventTypes()
        setSelectedEventTypeUri(data.calendly_event_type_uri || '')
      }
    } catch (error) {
      console.error('[CompanySettingsForm] Error loading settings:', error)
      toast.error('Error loading settings')
      // Set empty settings on error
      setSettings({
        company_name: '',
        company_description: '',
        product_service: '',
        unique_selling_points: [],
        target_audience: '',
        industry: '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // Listen for settings updates from other components (e.g., TemplateSelector)
  useEffect(() => {
    const handleSettingsUpdate = () => {
      loadSettings()
    }

    eventBus.on('companySettingsUpdated', handleSettingsUpdate)
    return () => eventBus.off('companySettingsUpdated', handleSettingsUpdate)
  }, [])

  // Check for Calendly OAuth callback - only once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const calendlyConnected = params.get('calendly_connected')
    const calendlyError = params.get('calendly_error')

    if (calendlyConnected === 'true') {
      toast.success('Calendly successfully connected!')
      // Clean up URL and trigger reload through selectedOrganization change
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (calendlyError) {
      toast.error(`Calendly connection failed: ${calendlyError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleSaveSettings = async () => {
    console.log('[CompanySettingsForm] handleSaveSettings called')
    console.log('[CompanySettingsForm] settings:', settings)
    console.log('[CompanySettingsForm] settings.company_name:', settings.company_name)
    console.log('[CompanySettingsForm] settings.company_name?.trim():', settings.company_name?.trim())
    console.log('[CompanySettingsForm] selectedEventTypeUri:', selectedEventTypeUri)

    try {
      console.log('[CompanySettingsForm] Checking company_name...')
      if (!settings.company_name?.trim()) {
        console.log('[CompanySettingsForm] No company name, returning. Value:', settings.company_name)
        toast.error('Company name is required')
        return
      }

      console.log('[CompanySettingsForm] Validation passed, setting isSaving to true')
      setIsSaving(true)

      // If Calendly event type selected, add scheduling URL
      let calendlyUpdates = {}
      if (selectedEventTypeUri) {
        console.log('[CompanySettingsForm] Finding selected event type...')
        const selectedEventType = eventTypes.find(et => et.uri === selectedEventTypeUri)
        console.log('[CompanySettingsForm] Selected event type:', selectedEventType)
        if (selectedEventType) {
          calendlyUpdates = {
            calendly_event_type_uri: selectedEventType.uri,
            calendly_scheduling_url: selectedEventType.scheduling_url,
            calendly_event_type_name: selectedEventType.name,
          }
        }
      }

      console.log('[CompanySettingsForm] Saving settings with updates:', { ...settings, ...calendlyUpdates })
      await updateUserSettings({
        ...settings,
        ...calendlyUpdates,
      })
      
      console.log('[CompanySettingsForm] Settings saved successfully')
      toast.success('Settings saved!')
      
      // Notify other components (like TemplateSelector) that settings were updated
      eventBus.emit('companySettingsUpdated')
    } catch (error) {
      console.error('[CompanySettingsForm] CAUGHT ERROR:', error)
      toast.error('Error saving settings')
    } finally {
      console.log('[CompanySettingsForm] Finally block, setting isSaving to false')
      setIsSaving(false)
    }
  }

  const handleConnectCalendly = async () => {
    console.log('[CompanySettingsForm] handleConnectCalendly called')

    setIsConnectingCalendly(true)
    try {
      console.log('[CompanySettingsForm] Calling initiateCalendlyOAuth...')
      const authUrl = await initiateCalendlyOAuth()
      console.log('[CompanySettingsForm] Got authUrl:', authUrl)
      // Open OAuth in popup or redirect
      window.location.href = authUrl
    } catch (error) {
      console.error('[CompanySettingsForm] Error connecting Calendly:', error)
      toast.error('Error connecting to Calendly')
      setIsConnectingCalendly(false)
    }
  }

  const handleDisconnectCalendly = async () => {
    try {
      await disconnectCalendly()
      setIsCalendlyConnected(false)
      setEventTypes([])
      setSelectedEventTypeUri('')
      toast.success('Calendly connection removed')
    } catch (error) {
      console.error('Error disconnecting Calendly:', error)
      toast.error('Error removing Calendly connection')
    }
  }

  const handleAddUsp = () => {
    if (!newUsp.trim()) return

    setSettings({
      ...settings,
      unique_selling_points: [...(settings.unique_selling_points || []), newUsp.trim()],
    })
    setNewUsp('')
  }

  const handleRemoveUsp = (index: number) => {
    setSettings({
      ...settings,
      unique_selling_points: settings.unique_selling_points?.filter((_, i) => i !== index),
    })
  }

  if (isLoading) {
    return (
      <div className="py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  // If only showing Calendly section
  if (showOnlyCalendly) {
    return (
      <div className="space-y-4">
        {/* Calendly Connection Status */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {isCalendlyConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Calendly connected</p>
                  <p className="text-sm text-muted-foreground">Your account is successfully linked</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Calendly not connected</p>
                  <p className="text-sm text-muted-foreground">Connect your Calendly account to synchronise meetings</p>
                </div>
              </>
            )}
          </div>
          {isCalendlyConnected ? (
            <Button
              onClick={handleDisconnectCalendly}
              variant="outline"
              size="sm"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={handleConnectCalendly}
              disabled={isConnectingCalendly}
              size="sm"
              className="gap-2"
            >
              {isConnectingCalendly ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Connect Calendly
                </>
              )}
            </Button>
          )}
        </div>

        {/* Event Type Selector */}
        {isCalendlyConnected && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event_type">Select meeting type</Label>
              <Select
                value={selectedEventTypeUri}
                onValueChange={setSelectedEventTypeUri}
              >
                <SelectTrigger id="event_type">
                  <SelectValue placeholder="Choose a meeting type..." />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((eventType) => (
                    <SelectItem key={eventType.uri} value={eventType.uri}>
                      {eventType.name} ({eventType.duration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This meeting type will be used in your outreach emails
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="button" onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full company settings view
  return (
    <div className="space-y-6">
      {/* Company Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            This information is used to generate AI cold email templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Required fields */}
          <div className="space-y-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-sm text-blue-900">Required fields for template generation</h3>
            
            <div className="space-y-2">
              <Label htmlFor="company_name">
                Company name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="E.g. Level2B Solutions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_service">
                Product/Service <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="product_service"
                value={settings.product_service}
                onChange={(e) => setSettings({ ...settings, product_service: e.target.value })}
                placeholder="Brief overview of what you offer"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_audience">
                Target audience <span className="text-red-500">*</span>
              </Label>
              <Input
                id="target_audience"
                value={settings.target_audience}
                onChange={(e) => setSettings({ ...settings, target_audience: e.target.value })}
                placeholder="E.g. B2B SaaS companies with 10-50 employees"
              />
            </div>
          </div>

          {/* Optional fields */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Additional information (optional but recommended)</h3>

            <div className="space-y-2">
              <Label htmlFor="company_description">Company description</Label>
              <Textarea
                id="company_description"
                value={settings.company_description}
                onChange={(e) => setSettings({ ...settings, company_description: e.target.value })}
                placeholder="Description of your company and mission"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={settings.industry}
                onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                placeholder="E.g. SaaS, Consulting, Marketing"
              />
            </div>

            {/* USPs */}
            <div className="space-y-2">
              <Label>Unique Selling Points (USPs)</Label>
              <div className="flex gap-2">
                <Input
                  value={newUsp}
                  onChange={(e) => setNewUsp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddUsp()
                    }
                  }}
                  placeholder="Add a USP"
                />
                <Button type="button" onClick={handleAddUsp} variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {settings.unique_selling_points && settings.unique_selling_points.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {settings.unique_selling_points.map((usp, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{usp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUsp(index)}
                        className="text-gray-500 dark:text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button type="button" onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
