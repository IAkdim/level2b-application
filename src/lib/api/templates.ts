// src/lib/api/templates.ts
// Email template generation API (no database storage)

import { supabase } from '@/lib/supabaseClient'

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

    if (error) {
      console.error('Edge Function Error Details:', {
        message: error.message,
        status: error.context?.status,
        statusText: error.context?.statusText,
        body: error.context?.body,
        fullError: error
      })
      
      throw new Error(`${error.message || 'Edge Function fout'}`)
    }

    if (!data) {
      console.error('No data returned from Edge Function')
      throw new Error('AI service gaf geen response. Is de Edge Function correct gedeployed?')
    }

    // Check if the response contains an error
    if (data.error) {
      throw new Error(data.error)
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
