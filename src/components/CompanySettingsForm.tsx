// src/components/CompanySettingsForm.tsx
// Form voor bedrijfsinformatie met Calendly OAuth integratie

import { useState, useEffect } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import {
  getOrganizationSettings,
  updateOrganizationSettings,
  initiateCalendlyOAuth,
  getCalendlyEventTypes,
  disconnectCalendly,
  type CalendlyEventType,
  type OrganizationSettings,
} from '@/lib/api/calendly'
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

interface CompanySettingsFormProps {
  showOnlyCalendly?: boolean
}

export function CompanySettingsForm({ showOnlyCalendly = false }: CompanySettingsFormProps) {
  const { selectedOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<Partial<OrganizationSettings>>({
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

  const loadEventTypes = async (organizationId: string) => {
    try {
      const types = await getCalendlyEventTypes(organizationId)
      setEventTypes(types)
    } catch (error) {
      console.error('Error loading event types:', error)
      toast.error('Fout bij laden van Calendly event types')
    }
  }

  const loadSettings = async (organizationId: string) => {
    console.log('[CompanySettingsForm] Loading settings for org:', organizationId)
    try {
      setIsLoading(true)
      const data = await getOrganizationSettings(organizationId)
      console.log('[CompanySettingsForm] Settings loaded:', data)
      
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
        console.log('[CompanySettingsForm] Loading event types...')
        await loadEventTypes(organizationId)
        setSelectedEventTypeUri(data.calendly_event_type_uri || '')
      }
      console.log('[CompanySettingsForm] Settings load complete')
    } catch (error) {
      console.error('[CompanySettingsForm] Error loading settings:', error)
      toast.error('Fout bij laden van instellingen')
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
      console.log('[CompanySettingsForm] Setting isLoading to false')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedOrg?.id) {
      loadSettings(selectedOrg.id)
    } else {
      setIsLoading(false)
    }
  }, [selectedOrg?.id])

  // Check for Calendly OAuth callback - only once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const calendlyConnected = params.get('calendly_connected')
    const calendlyError = params.get('calendly_error')

    if (calendlyConnected === 'true') {
      toast.success('Calendly succesvol verbonden!')
      // Clean up URL and trigger reload through selectedOrganization change
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (calendlyError) {
      toast.error(`Calendly verbinding mislukt: ${calendlyError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleSaveSettings = async () => {
    console.log('[CompanySettingsForm] handleSaveSettings called')
    console.log('[CompanySettingsForm] selectedOrg:', selectedOrg)
    console.log('[CompanySettingsForm] settings:', settings)
    console.log('[CompanySettingsForm] settings.company_name:', settings.company_name)
    console.log('[CompanySettingsForm] settings.company_name?.trim():', settings.company_name?.trim())
    console.log('[CompanySettingsForm] selectedEventTypeUri:', selectedEventTypeUri)
    
    try {
      if (!selectedOrg) {
        console.log('[CompanySettingsForm] No selectedOrg, returning')
        toast.error('Geen organisatie geselecteerd')
        return
      }

      console.log('[CompanySettingsForm] Checking company_name...')
      if (!settings.company_name?.trim()) {
        console.log('[CompanySettingsForm] No company name, returning. Value:', settings.company_name)
        toast.error('Bedrijfsnaam is verplicht')
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
      await updateOrganizationSettings(selectedOrg.id, {
        ...settings,
        ...calendlyUpdates,
      })
      
      console.log('[CompanySettingsForm] Settings saved successfully')
      toast.success('Instellingen opgeslagen!')
    } catch (error) {
      console.error('[CompanySettingsForm] CAUGHT ERROR:', error)
      toast.error('Fout bij opslaan van instellingen')
    } finally {
      console.log('[CompanySettingsForm] Finally block, setting isSaving to false')
      setIsSaving(false)
    }
  }

  const handleConnectCalendly = async () => {
    console.log('[CompanySettingsForm] handleConnectCalendly called')
    console.log('[CompanySettingsForm] selectedOrg:', selectedOrg)
    
    if (!selectedOrg) {
      toast.error('Geen organisatie geselecteerd')
      return
    }

    setIsConnectingCalendly(true)
    try {
      console.log('[CompanySettingsForm] Calling initiateCalendlyOAuth...')
      const authUrl = await initiateCalendlyOAuth(selectedOrg.id)
      console.log('[CompanySettingsForm] Got authUrl:', authUrl)
      // Open OAuth in popup or redirect
      window.location.href = authUrl
    } catch (error) {
      console.error('[CompanySettingsForm] Error connecting Calendly:', error)
      toast.error('Fout bij verbinden met Calendly')
      setIsConnectingCalendly(false)
    }
  }

  const handleDisconnectCalendly = async () => {
    if (!selectedOrg) return

    try {
      await disconnectCalendly(selectedOrg.id)
      setIsCalendlyConnected(false)
      setEventTypes([])
      setSelectedEventTypeUri('')
      toast.success('Calendly verbinding verwijderd')
    } catch (error) {
      console.error('Error disconnecting Calendly:', error)
      toast.error('Fout bij verwijderen Calendly verbinding')
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
                  <p className="font-medium">Calendly verbonden</p>
                  <p className="text-sm text-muted-foreground">Je account is succesvol gekoppeld</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Calendly niet verbonden</p>
                  <p className="text-sm text-muted-foreground">Verbind je Calendly account om meetings te synchroniseren</p>
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
              Verbreek verbinding
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
                  Verbinden...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Verbind Calendly
                </>
              )}
            </Button>
          )}
        </div>

        {/* Event Type Selector */}
        {isCalendlyConnected && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event_type">Selecteer meeting type</Label>
              <Select
                value={selectedEventTypeUri}
                onValueChange={setSelectedEventTypeUri}
              >
                <SelectTrigger id="event_type">
                  <SelectValue placeholder="Kies een meeting type..." />
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
                Dit meeting type wordt gebruikt in je outreach emails
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="button" onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Opslaan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Opslaan
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
            Bedrijfsinformatie
          </CardTitle>
          <CardDescription>
            Deze informatie wordt gebruikt om AI cold email templates te genereren
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Verplichte velden */}
          <div className="space-y-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-sm text-blue-900">Verplichte velden voor template generatie</h3>
            
            <div className="space-y-2">
              <Label htmlFor="company_name">
                Bedrijfsnaam <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="Bijv. Level2B Solutions"
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
                placeholder="Kort overzicht van wat je aanbiedt"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_audience">
                Doelgroep <span className="text-red-500">*</span>
              </Label>
              <Input
                id="target_audience"
                value={settings.target_audience}
                onChange={(e) => setSettings({ ...settings, target_audience: e.target.value })}
                placeholder="Bijv. B2B SaaS bedrijven met 10-50 medewerkers"
              />
            </div>
          </div>

          {/* Optionele velden */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Aanvullende informatie (optioneel maar aanbevolen)</h3>

            <div className="space-y-2">
              <Label htmlFor="company_description">Bedrijfsomschrijving</Label>
              <Textarea
                id="company_description"
                value={settings.company_description}
                onChange={(e) => setSettings({ ...settings, company_description: e.target.value })}
                placeholder="Beschrijving van je bedrijf en missie"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industrie</Label>
              <Input
                id="industry"
                value={settings.industry}
                onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                placeholder="Bijv. SaaS, Consulting, Marketing"
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
                  placeholder="Voeg een USP toe"
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
                      className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{usp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUsp(index)}
                        className="text-gray-500 hover:text-red-500"
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
                  Opslaan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Instellingen Opslaan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
