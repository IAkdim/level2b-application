// src/pages/Templates.tsx
// Cold email template generator (geen database opslag)

import { useState, useEffect } from 'react'
import { 
  generateColdEmailTemplate,
  type GeneratedTemplate,
  getEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
  incrementTemplateUsage,
} from '@/lib/api/templates'
import type { EmailTemplate } from '@/types/crm'
import { useOrganization } from '@/contexts/OrganizationContext'
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
  X,
  Trash2,
  Save,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'


export default function Templates() {
  const navigate = useNavigate()
  const { selectedOrg } = useOrganization()
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null)
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [validation, setValidation] = useState({ isValid: false, missingFields: [] as string[] })
  
  // Form state for editing generated template
  const [templateName, setTemplateName] = useState('')
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')

  // Extra context for template generation
  const [additionalContext, setAdditionalContext] = useState('')

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

  // Load saved templates on mount
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    if (!selectedOrg?.id) return
    
    try {
      setIsLoadingTemplates(true)
      const templates = await getEmailTemplates(selectedOrg.id)
      setSavedTemplates(templates)
    } catch (error) {
      console.error('Error loading templates:', error)
      toast.error('Kon templates niet laden')
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const handleGenerateTemplate = async () => {
    // Always show quick settings dialog so user can add extra context
    const existing = getCompanySettings()
    if (existing) {
      setQuickSettings(existing)
    }
    setShowSettingsDialog(true)
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
    
    // Update validation
    const result = validateSettingsForTemplateGeneration(quickSettings)
    setValidation(result)
    
    // Close dialog FIRST before generating
    setShowSettingsDialog(false)
    
    // Then generate
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
        additionalContext: additionalContext.trim() || undefined,
      })

      setGeneratedTemplate(result)
      setTemplateName(result.templateName)
      setTemplateSubject(result.subject)
      setTemplateBody(result.body)
      
      setShowGenerateDialog(true)
      // Reset additional context after successful generation
      setAdditionalContext('')
      toast.success('Template gegenereerd!')
    } catch (error) {
      console.error('Error generating template:', error)
      const errorMessage = error instanceof Error ? error.message : 'Onbekende fout bij genereren'
      toast.error(errorMessage, {
        duration: 6000,
        description: 'Check de console voor meer details'
      })
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

  const handleSaveTemplate = async () => {
    console.log('handleSaveTemplate called')
    if (!generatedTemplate) {
      console.log('No generated template to save')
      return
    }

    if (!selectedOrg?.id) {
      toast.error('Geen organisatie geselecteerd')
      return
    }

    try {
      console.log('Saving template to database...')
      const settings = getCompanySettings()
      const result = await saveEmailTemplate(selectedOrg.id, {
        name: templateName,
        subject: templateSubject,
        body: templateBody,
        company_info: settings,
        additional_context: additionalContext || undefined,
      })
      console.log('Template saved successfully:', result)
      toast.success('Template opgeslagen!')
      await loadTemplates() // Reload templates
    } catch (error) {
      console.error('Error saving template:', error)
      const errorMsg = error instanceof Error ? error.message : 'Onbekende fout'
      toast.error(`Kon template niet opslaan: ${errorMsg}`)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze template wilt verwijderen?')) return

    try {
      await deleteEmailTemplate(id)
      toast.success('Template verwijderd')
      loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Kon template niet verwijderen')
    }
  }

  const handleUseTemplate = async (template: EmailTemplate) => {
    try {
      await incrementTemplateUsage(template.id)
      handleCopyToClipboard(
        `${template.subject}\n\n${template.body}`,
        'Template'
      )
      loadTemplates() // Reload to update usage count
    } catch (error) {
      console.error('Error using template:', error)
      // Still copy even if usage tracking fails
      handleCopyToClipboard(
        `${template.subject}\n\n${template.body}`,
        'Template'
      )
    }
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

      {/* Saved Templates */}
      {savedTemplates.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Opgeslagen Templates</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {savedTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{template.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardTitle>
                  <CardDescription className="truncate">
                    {template.subject}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {template.body}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(template.created_at).toLocaleDateString('nl-NL')}
                    </span>
                    {template.times_used > 0 && (
                      <span>Gebruikt: {template.times_used}x</span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleUseTemplate(template)}
                    className="w-full"
                    variant="outline"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Kopieer Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
              <Button 
                onClick={handleSaveTemplate}
                variant="default"
              >
                <Save className="mr-2 h-4 w-4" />
                Opslaan
              </Button>
              <Button onClick={handlePreview} variant="outline">
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
                variant="outline"
              >
                <Copy className="mr-2 h-4 w-4" />
                Kopieer
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

            <div className="space-y-2">
              <Label htmlFor="additional_context">
                Extra Context (Optioneel)
              </Label>
              <Textarea
                id="additional_context"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Bijvoorbeeld: specifieke use case, recente resultaten, doelgroep pijnpunten, of andere relevante info die de AI kan gebruiken om een betere template te maken"
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Vertel meer over je doelgroep, specifieke problemen die je oplost, of recente successen
              </p>
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
                {isGenerating ? 'Genereren...' : 'Genereer Template'}
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
