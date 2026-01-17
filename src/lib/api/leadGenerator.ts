// API functions for lead generation
import { supabase } from '@/lib/supabaseClient'

export interface GenerateLeadsParams {
  method: 'google_maps' | 'social_media'
  niche: string
  location: string
  maxLeads: number
  emailProvider?: string
  orgId: string
}

export interface GenerateLeadsResult {
  success: boolean
  leadsGenerated: number
  leads: any[]
}

/**
 * Generate leads using AI
 */
export async function generateLeads(params: GenerateLeadsParams): Promise<GenerateLeadsResult> {
  const { data, error } = await supabase.functions.invoke('generate-leads', {
    body: params,
  })

  if (error) {
    console.error('Error generating leads:', error)
    throw new Error(error.message || 'Failed to generate leads')
  }

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}
