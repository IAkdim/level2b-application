// src/pages/Templates.tsx
// Cold email template generator (geen database opslag)

import { useState, useEffect } from 'react'
import { 
  generateColdEmailTemplate,
  type GeneratedTemplate
} from '@/lib/api/templates'
import {
  getCompanySettings,
  saveCompanySettings,
  validateSettingsForTemplateGeneration,
  getFieldLabel,
  type CompanySettings
} from '@/lib/api/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Sparkles, 
  Copy, 
  Mail,
  AlertCircle,
  Settings,
  Plus,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'


export default function Templates() {
  const navigate = useNavigate()
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [validation, setValidation] = useState({ isValid: false, missingFields: [] as string[] })
  
  // Form state for editing generated template
  const [templateName, setTemplateName] = useState('')
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')

  // Quick settings form state
  const [quickSettings, setQuickSettings] = useState<CompanySettings>({
    company_name: '',
    product_service: '',
    target_audience: '',
    unique_selling_points: [],
  })
  const [newUsp, setNewUsp] = useState('')

  // Check validation on mount and update
  useEffect(() => {
    const checkValidation = () => {
      const settings = getCompanySettings()
      const result = validateSettingsForTemplateGeneration(settings)
      setValidation(result)
    }
    checkValidation()
    
    // Re-check when window gets focus (after coming back from config)
    window.addEventListener('focus', checkValidation)
    return () => window.removeEventListener('focus', checkValidation)
  }, [])

  const handleGenerateTemplate = async () => {
    // Check settings real-time
    const settings = getCompanySettings()
    const validationCheck = validateSettingsForTemplateGeneration(settings)
    
    if (!settings || !validationCheck.isValid) {
      // Show quick settings dialog instead of redirecting
      const existing = getCompanySettings()
      if (existing) {
        setQuickSettings(existing)
      }
      setShowSettingsDialog(true)
      return
    }

    await generateTemplate(settings)
  }

  const handleQuickSettingsSave = async () => {
    // Validate required fields
    if (!quickSettings.company_name?.trim()) {
      toast.error('Bedrijfsnaam is verplicht')
      return
    }
    if (!quickSettings.product_service?.trim()) {
      toast.error('Product/Service is verplicht')
      return
    }
    if (!quickSettings.target_audience?.trim()) {
      toast.error('Doelgroep is verplicht')
      return
    }

    // Save settings
    saveCompanySettings(quickSettings)
    toast.success('Instellingen opgeslagen!')
    
    // Update validation
    const result = validateSettingsForTemplateGeneration(quickSettings)
    setValidation(result)
    
    // Close dialog and generate
    setShowSettingsDialog(false)
    await generateTemplate(quickSettings)
  }

  const generateTemplate = async (settings: CompanySettings) => {
    setIsGenerating(true)
    try {
      const result = await generateColdEmailTemplate({
        companyName: settings.company_name!,
        companyDescription: settings.company_description,
        productService: settings.product_service!,
        uniqueSellingPoints: settings.unique_selling_points,
        targetAudience: settings.target_audience!,
        industry: settings.industry,
        calendlyLink: settings.calendly_link,
      })

      if (result.error) {
        toast.error(`Fout bij genereren: ${result.error}`)
        return
      }

      setGeneratedTemplate(result)
      setTemplateName(result.templateName)
      setTemplateSubject(result.subject)
      setTemplateBody(result.body)
      setShowGenerateDialog(true)
      toast.success('Template gegenereerd!')
    } catch (error) {
      console.error('Error generating template:', error)
      toast.error('Fout bij genereren van template')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} gekopieerd!`)
  }

  const handlePreview = () => {
    setShowGenerateDialog(false)
    setShowPreviewDialog(true)
  }

  const handleAddUsp = () => {
    if (!newUsp.trim()) return
    setQuickSettings({
      ...quickSettings,
      unique_selling_points: [...(quickSettings.unique_selling_points || []), newUsp.trim()],
    })
    setNewUsp('')
  }

  const handleRemoveUsp = (index: number) => {
    setQuickSettings({
      ...quickSettings,
      unique_selling_points: quickSettings.unique_selling_points?.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cold Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Genereer overtuigende cold emails met AI
          </p>
        </div>
        <Button 
          onClick={handleGenerateTemplate}
          disabled={isGenerating}
          size="lg"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {isGenerating ? 'Genereren...' : 'Nieuwe Template Genereren'}
        </Button>
      </div>

      {/* Warning if settings incomplete - now with direct action */}
      {!validation.isValid && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Bedrijfsinformatie Ontbreekt
                </h3>
                <p className="text-sm text-blue-800 mt-1">
                  Klik op "Nieuwe Template Genereren" om je bedrijfsinformatie in te vullen en direct een template te genereren.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Template Display */}
      {generatedTemplate && validation.isValid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Laatst Gegenereerde Template
            </CardTitle>
            <CardDescription>
              {generatedTemplate.templateName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Onderwerp</Label>
              <p className="text-sm mt-1 p-3 bg-gray-50 rounded border">{generatedTemplate.subject}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">Email Body</Label>
              <p className="text-sm mt-1 p-3 bg-gray-50 rounded border whitespace-pre-wrap">
                {generatedTemplate.body}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{generatedTemplate.tone}</Badge>
              <Badge variant="outline">{generatedTemplate.targetSegment}</Badge>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  setShowPreviewDialog(true)
                }}
                variant="outline"
              >
                Bekijk
              </Button>
              <Button
                onClick={() => handleCopyToClipboard(
                  `${generatedTemplate.subject}\n\n${generatedTemplate.body}`,
                  'Template'
                )}
              >
                <Copy className="mr-2 h-4 w-4" />
                Kopieer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generatedTemplate && validation.isValid && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nog geen templates gegenereerd
            </h3>
            <p className="text-muted-foreground mb-4">
              Klik op "Nieuwe Template Genereren" om te beginnen
            </p>
          </CardContent>
        </Card>
      )}

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Gegenereerde Template</DialogTitle>
            <DialogDescription>
              Review en pas de template aan indien nodig
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Naam</Label>
              <Input
                id="name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Onderwerp</Label>
              <Input
                id="subject"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={() => setShowGenerateDialog(false)}
                variant="outline"
              >
                Sluiten
              </Button>
              <Button onClick={handlePreview}>
                Bekijk Preview
              </Button>
              <Button
                onClick={() => {
                  handleCopyToClipboard(
                    `${templateSubject}\n\n${templateBody}`,
                    'Template'
                  )
                  setShowGenerateDialog(false)
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Kopieer en Sluiten
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bedrijfsinformatie Invullen</DialogTitle>
            <DialogDescription>
              Vul de onderstaande velden in om een template te genereren
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick_company_name">
                Bedrijfsnaam <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick_company_name"
                value={quickSettings.company_name}
                onChange={(e) => setQuickSettings({ ...quickSettings, company_name: e.target.value })}
                placeholder="Bijv. Level2B Solutions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick_product_service">
                Product/Service <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="quick_product_service"
                value={quickSettings.product_service}
                onChange={(e) => setQuickSettings({ ...quickSettings, product_service: e.target.value })}
                placeholder="Kort overzicht van wat je aanbiedt"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick_target_audience">
                Doelgroep <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick_target_audience"
                value={quickSettings.target_audience}
                onChange={(e) => setQuickSettings({ ...quickSettings, target_audience: e.target.value })}
                placeholder="Bijv. B2B SaaS bedrijven met 10-50 medewerkers"
              />
            </div>

            <div className="space-y-2">
              <Label>Unique Selling Points (USPs) - Optioneel</Label>
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
              {quickSettings.unique_selling_points && quickSettings.unique_selling_points.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {quickSettings.unique_selling_points.map((usp, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm"
                    >
                      <span>{usp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUsp(index)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                onClick={() => setShowSettingsDialog(false)}
                variant="outline"
              >
                Annuleren
              </Button>
              <Button onClick={handleQuickSettingsSave} disabled={isGenerating}>
                <Sparkles className="mr-2 h-4 w-4" />
                {isGenerating ? 'Genereren...' : 'Opslaan & Genereren'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>Zo ziet de email eruit</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 border rounded-lg p-6 bg-gray-50">
            <div>
              <div className="text-xs text-muted-foreground mb-1">ONDERWERP</div>
              <div className="font-semibold">{templateSubject}</div>
            </div>
            
            <div className="border-t pt-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {templateBody}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowPreviewDialog(false)}
              variant="outline"
            >
              Sluiten
            </Button>
            <Button
              onClick={() => {
                handleCopyToClipboard(
                  `${templateSubject}\n\n${templateBody}`,
                  'Template'
                )
                setShowPreviewDialog(false)
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Kopieer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
