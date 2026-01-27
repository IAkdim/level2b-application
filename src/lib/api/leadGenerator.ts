// API functions for lead generation
import { supabase } from '@/lib/supabaseClient'

export interface GenerateLeadsParams {
  niche: string
  location: string
  maxLeads: number
}

export interface GenerateLeadsMeta {
  totalFound: number
  duplicatesFiltered: number
  durationMs: number
}

export interface GenerateLeadsResult {
  success: boolean
  leadsGenerated: number
  leads: any[]
  meta?: GenerateLeadsMeta
}

/**
 * Generate leads using Google Places API
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Duplicate detection
 * - Quality filtering
 * - Rate limit enforcement
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
