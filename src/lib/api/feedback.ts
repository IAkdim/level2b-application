// src/lib/api/feedback.ts
// Feedback API

import { supabase } from '@/lib/supabaseClient'
import type { Feedback, CreateFeedbackInput } from '@/types/crm'

/**
 * Submit feedback (USER-CENTRIC)
 * org_id is now optional
 */
export async function submitFeedback(
  input: CreateFeedbackInput & { orgId?: string }
): Promise<Feedback> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { orgId, ...feedbackInput } = input

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      org_id: orgId || null,
      ...feedbackInput,
      user_agent: navigator.userAgent,
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting feedback:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Get all feedback for current organization (admin only)
 */
export async function getFeedback(orgId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching feedback:', error)
    throw new Error(error.message)
  }

  return data || []
}
