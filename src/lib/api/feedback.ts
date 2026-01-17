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
