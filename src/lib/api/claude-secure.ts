// src/lib/api/claude-secure.ts
// SECURE versie - gebruikt backend API in plaats van directe Claude calls

import { supabase } from '@/lib/supabaseClient'

export type EmailSentiment = 'not_interested' | 'doubtful' | 'positive'

export interface SentimentAnalysis {
  sentiment: EmailSentiment
  confidence: number
  reasoning: string
  error?: string
}

/**
 * Analyseer de sentiment van een email reactie via SECURE backend
 */
export async function analyzeSentiment(
  emailBody: string,
  emailSubject: string
): Promise<SentimentAnalysis> {
  try {
    console.log('Analyzing sentiment via secure backend:', {
      subject: emailSubject,
      bodyLength: emailBody.length,
    })

    // Get current session for authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Not authenticated')
    }

    console.log('Calling Edge Function with auth token...')

    // Call Supabase Edge Function (SECURE - API key on server)
    const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
      body: {
        emailBody,
        emailSubject,
      },
    })

    console.log('Edge Function response:', { data, error })

    if (error) {
      console.error('Error from sentiment API:', error)
      const errorMessage = `${error.message || 'Unknown error'}`
      return {
        sentiment: 'doubtful',
        confidence: 0,
        reasoning: 'Edge Function Error',
        error: errorMessage,
      }
    }

    console.log('Sentiment analysis result:', data)
    return data as SentimentAnalysis
  } catch (error) {
    console.error('Error analyzing sentiment:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      sentiment: 'doubtful',
      confidence: 0,
      reasoning: 'Exception Error',
      error: errorMessage,
    }
  }
}

/**
 * Batch sentiment analyse voor meerdere emails
 */
export async function analyzeSentimentBatch(
  emails: Array<{ body: string; subject: string; id: string }>
): Promise<Map<string, SentimentAnalysis>> {
  const results = new Map<string, SentimentAnalysis>()

  for (const email of emails) {
    try {
      const analysis = await analyzeSentiment(email.body, email.subject)
      results.set(email.id, analysis)

      // Kleine delay tussen requests om rate limiting te voorkomen
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Failed to analyze sentiment for email ${email.id}:`, error)
    }
  }

  return results
}
