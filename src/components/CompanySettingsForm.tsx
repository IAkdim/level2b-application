// src/components/CompanySettingsForm.tsx
// Form voor bedrijfsinformatie met localStorage

import { useState, useEffect } from 'react'
import {
  getCompanySettings,
  saveCompanySettings,
  type CompanySettings
} from '@/lib/api/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Plus, X, Building2 } from 'lucide-react'
import { toast } from 'sonner'

export function CompanySettingsForm() {
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<CompanySettings>({
    company_name: '',
    company_description: '',
    product_service: '',
    unique_selling_points: [],
    target_audience: '',
    industry: '',
    website_url: '',
    contact_email: '',
    contact_phone: '',
    calendly_link: '',
  })
  const [newUsp, setNewUsp] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = () => {
    const data = getCompanySettings()
    if (data) {
      setSettings(data)
    }
  }

  const handleSaveSettings = () => {
    if (!settings.company_name?.trim()) {
      toast.error('Bedrijfsnaam is verplicht')
      return
    }

    setIsSaving(true)
    try {
      saveCompanySettings(settings)
      toast.success('Instellingen opgeslagen!')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Fout bij opslaan van instellingen')
    } finally {
      setIsSaving(false)
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

  return (
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website_url">Website</Label>
              <Input
                id="website_url"
                type="url"
                value={settings.website_url}
                onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
                placeholder="https://www.bedrijf.nl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendly_link">Calendly Link</Label>
              <Input
                id="calendly_link"
                type="url"
                value={settings.calendly_link}
                onChange={(e) => setSettings({ ...settings, calendly_link: e.target.value })}
                placeholder="https://calendly.com/jouw-link"
              />
              <p className="text-xs text-gray-500">Voor meeting request emails</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={settings.contact_email}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                placeholder="contact@bedrijf.nl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefoonnummer</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={settings.contact_phone}
                onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                placeholder="+31 6 12345678"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
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
  )
}
