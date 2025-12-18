import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, FileText, Loader2, AlertCircle, Plus, X, Clock } from 'lucide-react'
import { 
  getEmailTemplates, 
  generateColdEmailTemplate,
  saveEmailTemplate,
  incrementTemplateUsage,
  type GeneratedTemplate 
} from '@/lib/api/templates'
import { 
  getOrganizationSettings,
  updateOrganizationSettings,
  type OrganizationSettings
} from '@/lib/api/calendly'
import {
  checkUsageLimit,
  incrementUsage,
  formatUsageLimitError,
  getTimeUntilReset,
} from '@/lib/api/usageLimits'
import { useOrganization } from '@/contexts/OrganizationContext'
import { eventBus } from '@/lib/eventBus'
import type { EmailTemplate } from '@/types/crm'
import { toast } from 'sonner'

interface TemplateSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTemplateSelected: (subject: string, body: string) => void
}

export function TemplateSelector({ open, onOpenChange, onTemplateSelected }: TemplateSelectorProps) {
  const { selectedOrg } = useOrganization()
  const [activeTab, setActiveTab] = useState<'select' | 'generate'>('select')
  
  // Saved templates state
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null)
  const [additionalContext, setAdditionalContext] = useState('')
  const [generationError, setGenerationError] = useState<string | null>(null)
  
  // Settings state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [quickSettings, setQuickSettings] = useState<Partial<OrganizationSettings>>({
    company_name: '',
    product_service: '',
    target_audience: '',
    unique_selling_points: [],
  })
  const [newUsp, setNewUsp] = useState('')

  // Load saved templates and settings
  useEffect(() => {
    if (open && selectedOrg?.id) {
      loadTemplates()
      loadSettings()
    }
  }, [open, selectedOrg?.id])

  // Listen for settings updates from Configuration page
  useEffect(() => {
    const handleSettingsUpdate = () => {
      if (selectedOrg?.id) {
        console.log('[TemplateSelector] Settings updated, reloading...')
        loadSettings()
      }
    }

    eventBus.on('companySettingsUpdated', handleSettingsUpdate)
    return () => eventBus.off('companySettingsUpdated', handleSettingsUpdate)
  }, [selectedOrg?.id])

  const loadTemplates = async () => {
    if (!selectedOrg?.id) return
    
    setIsLoadingTemplates(true)
    try {
      const templates = await getEmailTemplates(selectedOrg.id)
      setSavedTemplates(templates)
    } catch (error) {
      console.error('Error loading templates:', error)
      toast.error('Kon templates niet laden')
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const loadSettings = async () => {
    if (!selectedOrg?.id) return
    
    try {
      console.log('[TemplateSelector] Loading settings for org:', selectedOrg.id)
      const settings = await getOrganizationSettings(selectedOrg.id)
      console.log('[TemplateSelector] Settings loaded:', settings)
      if (settings) {
        setQuickSettings({
          company_name: settings.company_name || '',
          company_description: settings.company_description || '',
          product_service: settings.product_service || '',
          target_audience: settings.target_audience || '',
          unique_selling_points: settings.unique_selling_points || [],
          industry: settings.industry || '',
          calendly_link: settings.calendly_event_type_uri || '',
        })
        console.log('[TemplateSelector] QuickSettings updated')
      } else {
        console.log('[TemplateSelector] No settings found, using empty values')
      }
    } catch (error) {
      console.error('[TemplateSelector] Error loading settings:', error)
    }
  }

  const handleGenerateClick = async () => {
    if (!selectedOrg?.id) {
      toast.error('No organisation selected')
      return
    }

    console.log('[TemplateSelector] Generate clicked, current quickSettings:', quickSettings)
    
    // Check if required fields are filled in current quickSettings
    const isValid = quickSettings.company_name && quickSettings.product_service && quickSettings.target_audience
    
    if (isValid) {
      console.log('[TemplateSelector] Settings valid, generating template')
      await generateTemplate()
    } else {
      console.log('[TemplateSelector] Settings incomplete, showing dialog')
      setShowSettingsDialog(true)
    }
  }

  const handleQuickSettingsSave = async () => {
    if (!selectedOrg?.id) {
      toast.error('No organisation selected')
      return
    }

    // Validate required fields
    if (!quickSettings.company_name?.trim()) {
      toast.error('Company name is required')
      return
    }
    if (!quickSettings.product_service?.trim()) {
      toast.error('Product/Service is required')
      return
    }
    if (!quickSettings.target_audience?.trim()) {
      toast.error('Target audience is required')
      return
    }

    // Save settings to database
    try {
      await updateOrganizationSettings(selectedOrg.id, {
        company_name: quickSettings.company_name,
        company_description: quickSettings.company_description,
        product_service: quickSettings.product_service,
        target_audience: quickSettings.target_audience,
        unique_selling_points: quickSettings.unique_selling_points,
        industry: quickSettings.industry,
      })
      toast.success('Settings saved')
      // Notify other components that settings were updated
      eventBus.emit('companySettingsUpdated')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
      return
    }
    
    // Generate template
    const success = await generateTemplate()
    
    if (success) {
      setShowSettingsDialog(false)
    }
  }

  const generateTemplate = async (): Promise<boolean> => {
    setIsGenerating(true)
    setGenerationError(null)
    
    if (!selectedOrg?.id) {
      setGenerationError('No organisation selected')
      setIsGenerating(false)
      return false
    }

    try {
      // Check usage limit
      const limitCheck = await checkUsageLimit(selectedOrg.id, 'template')
      
      if (!limitCheck.allowed) {
        const errorMsg = formatUsageLimitError(limitCheck.error!)
        const resetTime = getTimeUntilReset()
        setGenerationError(`${errorMsg}\nResets in ${resetTime}`)
        setIsGenerating(false)
        toast.error(`Daily template limit reached. Resets in ${resetTime}`)
        return false
      }

      const result = await generateColdEmailTemplate({
        companyName: quickSettings.company_name!,
        companyDescription: quickSettings.company_description,
        productService: quickSettings.product_service!,
        uniqueSellingPoints: quickSettings.unique_selling_points,
        targetAudience: quickSettings.target_audience!,
        industry: quickSettings.industry,
        calendlyLink: quickSettings.calendly_link,
        additionalContext: additionalContext.trim() || undefined,
      })

      // Increment usage counter
      try {
        await incrementUsage(selectedOrg.id, 'template')
      } catch (error) {
        console.error('Error incrementing usage:', error)
      }

      setGeneratedTemplate(result)
      setAdditionalContext('')
      toast.success('Template generated!')
      return true
    } catch (error) {
      console.error('Error generating template:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during generation'
      setGenerationError(errorMessage)
      toast.error('Template generation failed', { description: errorMessage })
      return false
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUseTemplate = async (template: EmailTemplate | GeneratedTemplate) => {
    // If it's a saved template with an ID, increment usage count
    if ('id' in template && template.id) {
      try {
        await incrementTemplateUsage(template.id)
      } catch (error) {
        console.error('Error incrementing template usage:', error)
        // Don't block template usage if tracking fails
      }
    }

    onTemplateSelected(template.subject, template.body)
    onOpenChange(false)
    resetState()
  }

  const handleSaveAndUse = async () => {
    if (!generatedTemplate || !selectedOrg?.id) return

    try {
      await saveEmailTemplate(selectedOrg.id, {
        name: generatedTemplate.templateName,
        subject: generatedTemplate.subject,
        body: generatedTemplate.body,
      })
      
      toast.success('Template saved!')
      eventBus.emit('templateSaved') // Notify Templates page to refresh
      await loadTemplates()
      handleUseTemplate(generatedTemplate)
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Could not save template')
    }
  }

  const resetState = () => {
    setGeneratedTemplate(null)
    setAdditionalContext('')
    setGenerationError(null)
    setActiveTab('select')
  }

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" key={selectedOrg?.id}>
          <DialogHeader>
            <DialogTitle>Select or Generate Email Template</DialogTitle>
            <DialogDescription>
              Choose from saved templates or generate a new one with AI
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'select' | 'generate')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Saved Templates
              </TabsTrigger>
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Generate New
              </TabsTrigger>
            </TabsList>

            {/* Saved Templates Tab */}
            <TabsContent value="select" className="space-y-4">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : savedTemplates.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No saved templates yet</p>
                    <Button onClick={() => setActiveTab('generate')} variant="outline">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Your First Template
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {savedTemplates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:border-primary transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <CardDescription className="mt-1">
                              <strong>Subject:</strong> {template.subject}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {template.times_used || 0} times used
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground line-clamp-3">
                            {template.body}
                          </div>
                          <Button onClick={() => handleUseTemplate(template)} className="w-full">
                            Use This Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Generate New Template Tab */}
            <TabsContent value="generate" className="space-y-4">
              {!generatedTemplate ? (
                <div className="space-y-4">
                  {generationError && (
                    <Card className="border-destructive bg-destructive/5">
                      <CardContent className="pt-6">
                        <div className="flex gap-3">
                          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-destructive">Generation Failed</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{generationError}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="context">Additional Context (optional)</Label>
                    <Textarea
                      id="context"
                      placeholder="e.g., Focus on cost savings, mention our new feature, target CTOs..."
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      rows={4}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide specific instructions for this template generation
                    </p>
                  </div>

                  <Button 
                    onClick={handleGenerateClick} 
                    disabled={isGenerating}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Template...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate Template with AI
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{generatedTemplate.templateName}</CardTitle>
                      <CardDescription>
                        <Badge variant="outline">{generatedTemplate.tone}</Badge>
                        {' • '}
                        <Badge variant="outline">{generatedTemplate.targetSegment}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <div className="p-3 bg-muted rounded-md text-sm">
                          {generatedTemplate.subject}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Body</Label>
                        <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {generatedTemplate.body}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => handleUseTemplate(generatedTemplate)} className="flex-1">
                          Use Template
                        </Button>
                        <Button onClick={handleSaveAndUse} variant="outline" className="flex-1">
                          Save & Use
                        </Button>
                      </div>
                      
                      <Button 
                        onClick={() => setGeneratedTemplate(null)} 
                        variant="ghost" 
                        className="w-full"
                      >
                        Generate Another
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Quick Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl" key={selectedOrg?.id}>
          <DialogHeader>
            <DialogTitle>Complete Company Information</DialogTitle>
            <DialogDescription>
              Fill in your company details to generate better templates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company_name"
                value={quickSettings.company_name || ''}
                onChange={(e) => setQuickSettings({ ...quickSettings, company_name: e.target.value })}
                placeholder="Your company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_service">
                Product/Service <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="product_service"
                value={quickSettings.product_service || ''}
                onChange={(e) => setQuickSettings({ ...quickSettings, product_service: e.target.value })}
                placeholder="What does your company offer?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_audience">
                Target Audience <span className="text-destructive">*</span>
              </Label>
              <Input
                id="target_audience"
                value={quickSettings.target_audience || ''}
                onChange={(e) => setQuickSettings({ ...quickSettings, target_audience: e.target.value })}
                placeholder="e.g., CEOs of tech companies"
              />
            </div>

            <div className="space-y-2">
              <Label>Unique Selling Points</Label>
              <div className="flex gap-2">
                <Input
                  value={newUsp}
                  onChange={(e) => setNewUsp(e.target.value)}
                  placeholder="Add a selling point"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newUsp.trim()) {
                      setQuickSettings({
                        ...quickSettings,
                        unique_selling_points: [...(quickSettings.unique_selling_points || []), newUsp.trim()]
                      })
                      setNewUsp('')
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (newUsp.trim()) {
                      setQuickSettings({
                        ...quickSettings,
                        unique_selling_points: [...(quickSettings.unique_selling_points || []), newUsp.trim()]
                      })
                      setNewUsp('')
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {quickSettings.unique_selling_points && quickSettings.unique_selling_points.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {quickSettings.unique_selling_points.map((usp, index) => (
                    <Badge key={index} variant="secondary">
                      {usp}
                      <button
                        onClick={() => {
                          setQuickSettings({
                            ...quickSettings,
                            unique_selling_points: quickSettings.unique_selling_points?.filter((_, i) => i !== index)
                          })
                        }}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickSettingsSave}>
              Save & Generate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
