// src/lib/api/feedback.ts
// Feedback API

import { supabase } from '@/lib/supabaseClient'
import type { Feedback, CreateFeedbackInput } from '@/types/crm'

/**
 * Submit feedback
 */
export async function submitFeedback(input: CreateFeedbackInput): Promise<Feedback> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
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

/**
 * Get all feedback (admin only)
 */
export async function getAllFeedback(): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching feedback:', error)
    throw new Error(error.message)
  }

  return data || []
}
