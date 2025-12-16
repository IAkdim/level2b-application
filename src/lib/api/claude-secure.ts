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

export interface EmailReplyContext {
  recipientName: string
  recipientEmail: string
  originalSubject: string
  originalBody: string
  sentiment: EmailSentiment
  companyName?: string
  productService?: string
}

export interface GeneratedReply {
  subject: string
  body: string
  tone: string
  error?: string
}

/**
 * Genereer een AI sales reply op basis van sentiment en context
 */
export async function generateSalesReply(
  context: EmailReplyContext
): Promise<GeneratedReply> {
  try {
    console.log('Generating sales reply via secure backend:', {
      sentiment: context.sentiment,
      recipientEmail: context.recipientEmail,
    })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Not authenticated')
    }

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('generate-reply', {
      body: context,
    })

    if (error) {
      console.error('Error from reply generation API:', error)
      return {
        subject: '',
        body: '',
        tone: '',
        error: error.message || 'Unknown error',
      }
    }

    console.log('Raw Edge Function response:', data)
    console.log('Response type:', typeof data)
    
    // Handle case where response might be a string instead of parsed JSON
    let parsedData = data
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
        console.log('Parsed string response to JSON:', parsedData)
      } catch (parseError) {
        console.error('Failed to parse response string:', parseError)
        return {
          subject: '',
          body: '',
          tone: '',
          error: 'Invalid response format from API',
        }
      }
    }

    // CRITICAL FIX: Check if body field contains nested JSON (Edge Function bug)
    if (parsedData && typeof parsedData.body === 'string') {
      const trimmedBody = parsedData.body.trim()
      if (trimmedBody.startsWith('{') && trimmedBody.includes('"body"')) {
        console.log('⚠️ Detected nested JSON structure in body field, extracting manually...')
        
        // Extract using regex - find the actual body content between quotes
        const bodyMatch = trimmedBody.match(/"body":\s*"((?:[^"\\]|\\.)*)"/s)
        const subjectMatch = trimmedBody.match(/"subject":\s*"([^"]*)"/)
        const toneMatch = trimmedBody.match(/"tone":\s*"((?:[^"\\]|\\.)*)"/)
        
        if (bodyMatch && bodyMatch[1]) {
          console.log('✓ Successfully extracted fields using regex')
          
          // Unescape the body content
          let extractedBody = bodyMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
          
          parsedData = {
            subject: subjectMatch ? subjectMatch[1] : parsedData.subject,
            body: extractedBody,
            tone: toneMatch ? toneMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : parsedData.tone,
          }
        } else {
          console.log('Could not extract body using regex, keeping original')
        }
      }
      
      // Final cleanup: remove any remaining escape sequences from body
      if (parsedData.body && typeof parsedData.body === 'string') {
        if (parsedData.body.includes('\\n') || parsedData.body.includes('\\"')) {
          console.log('Cleaning remaining escape sequences from body...')
          parsedData.body = parsedData.body
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\t/g, '\t')
        }
      }
    }

    console.log('Final parsed reply:', parsedData)
    console.log('Body preview:', parsedData.body?.substring(0, 150))
    return parsedData as GeneratedReply
  } catch (error) {
    console.error('Error generating reply:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      subject: '',
      body: '',
      tone: '',
      error: errorMessage,
    }
  }
}
