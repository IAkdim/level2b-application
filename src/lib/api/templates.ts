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
      
      return {
        templateName: '',
        subject: '',
        body: '',
        tone: '',
        targetSegment: '',
        error: `Edge Function fout: ${error.message}. Status: ${error.context?.status || 'unknown'}. Check Supabase logs voor details.`,
      }
    }

    if (!data) {
      console.error('No data returned from Edge Function')
      return {
        templateName: '',
        subject: '',
        body: '',
        tone: '',
        targetSegment: '',
        error: 'Edge Function returned no data. Is the function deployed?',
      }
    }

    console.log('Generated template:', data)
    return data as GeneratedTemplate
  } catch (error) {
    console.error('Error generating template:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      templateName: '',
      subject: '',
      body: '',
      tone: '',
      targetSegment: '',
      error: errorMessage,
    }
  }
}
