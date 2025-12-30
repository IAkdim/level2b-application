// src/lib/api/templates.ts
// Email template generation and storage API

import { supabase } from '@/lib/supabaseClient'
import type { EmailTemplate, CreateEmailTemplateInput, UpdateEmailTemplateInput, Language } from '@/types/crm'

export interface GeneratedTemplate {
  templateName: string
  subject: string
  body: string
  tone: string
  targetSegment: string
  error?: string
}

/**
 * Generate a cold email template using AI
 */
export async function generateColdEmailTemplate(companyInfo: {
  companyName: string
  companyDescription?: string
  productService: string
  uniqueSellingPoints?: string[]
  targetAudience: string
  industry?: string
  calendlyLink?: string
  additionalContext?: string
  language?: Language
}): Promise<GeneratedTemplate> {
  try {
    console.log('Generating cold email template via Edge Function:', companyInfo)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Not authenticated')
    }

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke(
      'generate-cold-email-template',
      {
        body: companyInfo,
      }
    )

    console.log('Edge Function response:', { data, error })

    // First check if data itself contains an error (Edge Function returned error in response body)
    if (data && data.error) {
      console.error('Edge Function returned error in data:', data.error)
      throw new Error(data.error)
    }

    if (error) {
      console.error('Edge Function Error Details:', {
        message: error.message,
        status: error.context?.status,
        statusText: error.context?.statusText,
        fullError: error
      })
      
      // Try to get error details from the Response body
      let errorMessage = error.message || 'Edge Function error'
      
      if (error.context instanceof Response) {
        try {
          const responseText = await error.context.text()
          console.log('Error response body:', responseText)
          
          try {
            const responseJson = JSON.parse(responseText)
            if (responseJson.error) {
              errorMessage = responseJson.error
            }
          } catch (jsonError) {
            // If not JSON, use the text directly
            if (responseText) {
              errorMessage = responseText
            }
          }
        } catch (readError) {
          console.error('Could not read error response:', readError)
        }
      }
      
      // Throw the extracted error message
      throw new Error(errorMessage)
    }

    if (!data) {
      console.error('No data returned from Edge Function')
      throw new Error('AI service gave no response. Is the Edge Function deployed correctly?')
    }

    // Validate required fields in response
    if (!data.templateName || !data.subject || !data.body) {
      throw new Error('Ongeldige AI response: template data ontbreekt')
    }

    console.log('Generated template:', data)
    return data as GeneratedTemplate
  } catch (error) {
    console.error('Error generating template:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Re-throw the error so the UI can show it properly
    throw new Error(errorMessage)
  }
}

/**
 * Save generated template to database
 */
export async function saveEmailTemplate(
  orgId: string,
  input: CreateEmailTemplateInput
): Promise<EmailTemplate> {
  console.log('saveEmailTemplate called with orgId:', orgId, 'input:', input)

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      org_id: orgId,
      ...input,
    })
    .select()
    .single()

  console.log('Insert result:', { data, error })

  if (error) {
    console.error('Error saving template:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Get all email templates for current organization
 */
export async function getEmailTemplates(orgId: string): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching templates:', error)
    throw new Error(error.message)
  }

  return data || []
}

/**
 * Get a single email template by ID
 */
export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching template:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Update an email template
 */
export async function updateEmailTemplate(
  id: string,
  input: UpdateEmailTemplateInput
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating template:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Delete an email template
 */
export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting template:', error)
    throw new Error(error.message)
  }
}

/**
 * Increment usage count for a template
 */
export async function incrementTemplateUsage(id: string): Promise<void> {
  // First, get the current value
  const { data: template, error: fetchError } = await supabase
    .from('email_templates')
    .select('times_used')
    .eq('id', id)
    .single()

  if (fetchError) {
    console.error('Error fetching template for usage increment:', fetchError)
    throw new Error(fetchError.message)
  }

  // Then update with incremented value
  const { error } = await supabase
    .from('email_templates')
    .update({
      times_used: (template.times_used || 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Error incrementing template usage:', error)
    throw new Error(error.message)
  }
}
