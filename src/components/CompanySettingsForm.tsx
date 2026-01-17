// src/components/CompanySettingsForm.tsx
// Form for personal company information (used for template generation)

import { useState, useEffect } from 'react'
import {
  getCompanySettings,
  saveCompanySettings,
  type CompanySettings,
} from '@/lib/api/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Plus, X, Building2 } from 'lucide-react'
import { toast } from 'sonner'

export function CompanySettingsForm() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settings, setSettings] = useState<Partial<CompanySettings>>({
    company_name: '',
    company_description: '',
    product_service: '',
    unique_selling_points: [],
    target_audience: '',
    industry: '',
  })
  const [newUsp, setNewUsp] = useState('')

  useEffect(() => {
    // Load settings from local storage
    setIsLoading(true)
    const data = getCompanySettings()
    if (data) {
      setSettings({
        company_name: data.company_name || '',
        company_description: data.company_description || '',
        product_service: data.product_service || '',
        unique_selling_points: data.unique_selling_points || [],
        target_audience: data.target_audience || '',
        industry: data.industry || '',
      })
    }
    setIsLoading(false)
  }, [])

  const handleSaveSettings = () => {
    try {
      if (!settings.company_name?.trim()) {
        toast.error('Company name is required')
        return
      }

      setIsSaving(true)

      saveCompanySettings(settings as CompanySettings)

      toast.success('Settings saved!')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Error saving settings')
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

  if (isLoading) {
    return (
      <div className="py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
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
  )
}
