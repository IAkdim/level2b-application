// src/lib/api/feedback.ts
// Feedback API

import { supabase } from '@/lib/supabaseClient'
import type { Feedback, CreateFeedbackInput } from '@/types/crm'

/**
 * Submit feedback
 */
export async function submitFeedback(
  orgId: string,
  input: CreateFeedbackInput
): Promise<Feedback> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      org_id: orgId,
      user_id: user?.id,
      ...input,
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
