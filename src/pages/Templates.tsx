// src/pages/Templates.tsx
// Cold email template generator (no database storage)

import { useState, useEffect, useCallback } from 'react'
import { 
  generateColdEmailTemplate,
  type GeneratedTemplate,
  getEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
  incrementTemplateUsage,
} from '@/lib/api/templates'
import { 
  getDailyUsage,
  checkUsageLimit,
  incrementUsage,
  formatUsageLimitError,
  getTimeUntilReset,
  type DailyUsage
} from '@/lib/api/usageLimits'
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
  Zap,
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
  const [generationError, setGenerationError] = useState<string | null>(null)
  
  // Usage limits state
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  
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

  const loadDailyUsage = useCallback(async () => {
    if (!selectedOrg?.id) return
    
    try {
      setIsLoadingUsage(true)
      const usage = await getDailyUsage(selectedOrg.id)
      setDailyUsage(usage)
    } catch (error) {
      console.error('Error loading daily usage:', error)
      // Don't show error toast - usage limits may not be set up yet
      // Just set loading to false and continue without usage limits
      setDailyUsage(null)
    } finally {
      setIsLoadingUsage(false)
    }
  }, [selectedOrg?.id])

  // Load daily usage on mount and when org changes
  useEffect(() => {
    if (selectedOrg?.id) {
      loadDailyUsage()
    }
  }, [selectedOrg?.id, loadDailyUsage])

  // Check validation on mount and update
  useEffect(() => {
    const checkValidation = () => {
      const settings = getCompanySettings()
      const result = validateSettingsForTemplateGeneration(settings)
      setValidation(result)
    }
    checkValidation()
    
    // Re-check when window gets focus (after coming back from config)
    const handleFocus = () => checkValidation()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const loadTemplates = useCallback(async () => {
    if (!selectedOrg?.id) return
    
    try {
      setIsLoadingTemplates(true)
      const templates = await getEmailTemplates(selectedOrg.id)
      setSavedTemplates(templates)
    } catch (error) {
      console.error('Error loading templates:', error)
      toast.error('Could not load templates')
    } finally {
      setIsLoadingTemplates(false)
    }
  }, [selectedOrg?.id])

  // Load saved templates on mount
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleGenerateTemplate = async () => {
    // Always show quick settings dialog so user can add extra context
    const existing = getCompanySettings()
    if (existing) {
      setQuickSettings(existing)
    }
    setGenerationError(null) // Clear any previous errors
    setShowSettingsDialog(true)
  }

  const handleQuickSettingsSave = async () => {
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

    // Save settings
    saveCompanySettings(quickSettings)
    
    // Update validation
    const result = validateSettingsForTemplateGeneration(quickSettings)
    setValidation(result)
    
    // Generate template - only close dialog if successful
    const success = await generateTemplate(quickSettings)
    
    // Only close dialog if generation was successful
    if (success) {
      setShowSettingsDialog(false)
    }
  }

  const generateTemplate = async (settings: CompanySettings): Promise<boolean> => {
    setIsGenerating(true)
    setGenerationError(null) // Clear previous errors
    
    if (!selectedOrg?.id) {
      setGenerationError('No organisation selected')
      setIsGenerating(false)
      return false
    }

    try {
      // Check usage limit before generating (only if usage limits are set up)
      if (dailyUsage) {
        const limitCheck = await checkUsageLimit(selectedOrg.id, 'template')
        
        if (!limitCheck.allowed) {
          const errorMsg = formatUsageLimitError(limitCheck.error!)
          const resetTime = getTimeUntilReset()
          setGenerationError(`${errorMsg}\nResets in ${resetTime}`)
          setIsGenerating(false)
          toast.error(`Daily template limit reached. Resets in ${resetTime}`)
          return false
        }
      }

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

      // Increment usage counter after successful generation (only if usage limits are set up)
      if (dailyUsage) {
        try {
          const incrementResult = await incrementUsage(selectedOrg.id, 'template')
          if (incrementResult.success) {
            // Reload usage to update UI
            await loadDailyUsage()
          }
        } catch (error) {
          console.error('Error incrementing usage:', error)
          // Don't fail the generation if usage tracking fails
        }
      }

      setGeneratedTemplate(result)
      setTemplateName(result.templateName)
      setTemplateSubject(result.subject)
      setTemplateBody(result.body)
      
      setShowGenerateDialog(true)
      // Reset additional context after successful generation
      setAdditionalContext('')
      toast.success('Template generated!')
      return true // Success
    } catch (error) {
      console.error('Error generating template:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during generation'
      
      // Store error in state to show in dialog
      setGenerationError(errorMessage)
      
      // Also show toast
      toast.error('Template generation failed', {
        duration: 10000,
        description: errorMessage,
      })
      return false // Failed
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
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
      toast.error('No organisation selected')
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
      toast.success('Template saved!')
      await loadTemplates() // Reload templates
    } catch (error) {
      console.error('Error saving template:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Could not save template: ${errorMsg}`)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      await deleteEmailTemplate(id)
      toast.success('Template deleted')
      loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Could not delete template')
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
            Generate persuasive cold emails with AI
          </p>
        </div>
        <Button 
          onClick={handleGenerateTemplate}
          disabled={isGenerating || (dailyUsage && dailyUsage.templatesRemaining === 0)}
          size="lg"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {isGenerating ? 'Generating...' : 'Generate New Template'}
        </Button>
      </div>

      {/* Daily Usage Card */}
      {!isLoadingUsage && dailyUsage && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-orange-900">
                    Daily Template Generation
                  </h3>
                  <p className="text-sm text-orange-800 mt-0.5">
                    {dailyUsage.templatesRemaining} of {dailyUsage.templateLimit} templates remaining today
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600">
                  {dailyUsage.templatesRemaining}/{dailyUsage.templateLimit}
                </div>
                <p className="text-xs text-orange-700 mt-1">
                  Resets in {getTimeUntilReset()}
                </p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full bg-orange-200 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, Math.max(0, (dailyUsage.templatesGenerated / dailyUsage.templateLimit) * 100))}%` 
                  }}
                />
              </div>
            </div>

            {/* Warning when close to limit */}
            {dailyUsage.templatesRemaining <= 2 && dailyUsage.templatesRemaining > 0 && (
              <p className="text-xs text-orange-700 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Only {dailyUsage.templatesRemaining} generation{dailyUsage.templatesRemaining === 1 ? '' : 's'} left today
              </p>
            )}

            {/* Limit reached */}
            {dailyUsage.templatesRemaining === 0 && (
              <p className="text-sm text-orange-900 mt-3 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Daily limit reached. Template generation will reset in {getTimeUntilReset()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warning if settings incomplete - now with direct action */}
      {!validation.isValid && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Company Information Missing
                </h3>
                <p className="text-sm text-blue-800 mt-1">
                  Click on "Generate New Template" to fill in your company information and generate a template directly.
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
              Last Generated Template
            </CardTitle>
            <CardDescription>
              {generatedTemplate.templateName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Subject</Label>
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
                View
              </Button>
              <Button
                onClick={() => handleCopyToClipboard(
                  `${generatedTemplate.subject}\n\n${generatedTemplate.body}`,
                  'Template'
                )}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
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
              No templates generated yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Click on "Generate New Template" to get started
            </p>
          </CardContent>
        </Card>
      )}

      {/* Saved Templates */}
      {savedTemplates.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Saved Templates</h2>
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
                      <span>Used: {template.times_used}x</span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleUseTemplate(template)}
                    className="w-full"
                    variant="outline"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Template
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
            <DialogTitle>AI Generated Template</DialogTitle>
            <DialogDescription>
              Review and adjust the template if needed
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
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
                Close
              </Button>
              <Button 
                onClick={handleSaveTemplate}
                variant="default"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button onClick={handlePreview} variant="outline">
                View Preview
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
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fill in Company Information</DialogTitle>
            <DialogDescription>
              Fill in the fields below to generate a template
            </DialogDescription>
          </DialogHeader>
          
          {/* Error message display */}
          {generationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 text-sm mb-1">
                    Template Generation Failed
                  </h4>
                  <p className="text-sm text-red-800 whitespace-pre-wrap">
                    {generationError}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick_company_name">
                Company name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick_company_name"
                value={quickSettings.company_name}
                onChange={(e) => setQuickSettings({ ...quickSettings, company_name: e.target.value })}
                placeholder="e.g. Level2B Solutions"
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
                placeholder="Brief overview of what you offer"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick_target_audience">
                Target audience <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick_target_audience"
                value={quickSettings.target_audience}
                onChange={(e) => setQuickSettings({ ...quickSettings, target_audience: e.target.value })}
                placeholder="e.g. B2B SaaS companies with 10-50 employees"
              />
            </div>

            <div className="space-y-2">
              <Label>Unique Selling Points (USPs) - Optional</Label>
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
                Extra Context (Optional)
              </Label>
              <Textarea
                id="additional_context"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="For example: specific use case, recent results, target audience pain points, or other relevant information that the AI can use to create a better template"
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Tell us more about your target audience, specific problems you solve, or recent successes
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                onClick={() => setShowSettingsDialog(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={handleQuickSettingsSave} disabled={isGenerating}>
                <Sparkles className="mr-2 h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate Template'}
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
            <DialogDescription>This is what the email looks like</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 border rounded-lg p-6 bg-gray-50">
            <div>
              <div className="text-xs text-muted-foreground mb-1">SUBJECT</div>
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
              Close
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
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
