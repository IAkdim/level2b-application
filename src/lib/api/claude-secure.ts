// src/lib/api/claude-secure.ts
// SECURE versie - gebruikt backend API in plaats van directe Claude calls

import { supabase } from '@/lib/supabaseClient'
import { rateLimiter } from './rateLimiter'

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
    // Get current session for authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.error('❌ No active session found')
      return {
        sentiment: 'doubtful',
        confidence: 0,
        reasoning: 'Authentication required',
        error: 'Not logged in. Please log in again to use sentiment analysis.',
      }
    }

    // Check rate limit
    const rateCheck = await rateLimiter.checkLimit('ai', session.user.id)
    if (!rateCheck.allowed) {
      console.error('❌ Rate limit exceeded for AI API')
      return {
        sentiment: 'doubtful',
        confidence: 0,
        reasoning: 'Rate limit exceeded',
        error: rateCheck.message || 'Too many requests. Please try again later.',
      }
    }

    // Call Supabase Edge Function (SECURE - API key on server)
    const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
      body: {
        emailBody,
        emailSubject,
      },
    })

    if (error) {
      console.error('❌ Error from sentiment API:', error)
      
      // Parse error details
      let userMessage = 'An error occurred while analyzing sentiment.'
      let technicalDetails = error.message || 'Unknown error'
      
      // Check for specific error types and extract backend error details
      if (error.message?.includes('FunctionsHttpError')) {
        userMessage = 'Sentiment analysis service is currently unavailable.'
        
        // Try to get more details from context
        if (error.context) {
          try {
            const errorContext = typeof error.context === 'string' 
              ? JSON.parse(error.context) 
              : error.context
            
            if (errorContext?.error) {
              technicalDetails = errorContext.error
              // Use the backend error as the main message if available
              userMessage = errorContext.error
            }
          } catch (e) {
            console.error('Failed to parse error context:', e)
          }
        }
      } else if (error.message?.includes('timeout')) {
        userMessage = 'Sentiment analysis is taking too long. Please try again later.'
      } else if (error.message?.includes('API key')) {
        userMessage = 'API configuration error. Please contact support.'
      }
      
      console.error('Technical details:', technicalDetails)
      
      return {
        sentiment: 'doubtful',
        confidence: 0,
        reasoning: 'Analysis unavailable',
        error: userMessage,
      }
    }

    if (!data) {
      console.error('❌ No data returned from Edge Function')
      return {
        sentiment: 'doubtful',
        confidence: 0,
        reasoning: 'No result',
        error: 'Sentiment analysis returned no result. Please try again.',
      }
    }

    return data as SentimentAnalysis
  } catch (error) {
    console.error('❌ Exception in analyzeSentiment:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    let userMessage = 'Unexpected error during sentiment analysis.'
    if (errorMessage.includes('network')) {
      userMessage = 'Network error. Please check your internet connection.'
    }
    
    return {
      sentiment: 'doubtful',
      confidence: 0,
      reasoning: 'Error occurred',
      error: userMessage,
    }
  }
}

export interface EmailReplyContext {
  recipientName: string
  recipientEmail: string
  originalSubject: string
  originalBody: string
  sentiment: 'positive' | 'neutral' | 'negative'
  userName?: string
  companyName?: string
  productService?: string
  calendlyLink?: string
  language?: string // en, nl, de, fr, es, it, pt
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
    
    // Handle case where response might be a string instead of parsed JSON
    let parsedData = data
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
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
        // Extract using regex - find the actual body content between quotes
        const bodyMatch = trimmedBody.match(/"body":\s*"((?:[^"\\]|\\.)*)"/s)
        const subjectMatch = trimmedBody.match(/"subject":\s*"([^"]*)"/)
        const toneMatch = trimmedBody.match(/"tone":\s*"((?:[^"\\]|\\.)*)"/)
        
        if (bodyMatch && bodyMatch[1]) {
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
        }
      }
      
      // Final cleanup: remove any remaining escape sequences from body
      if (parsedData.body && typeof parsedData.body === 'string') {
        if (parsedData.body.includes('\\n') || parsedData.body.includes('\\"')) {
          parsedData.body = parsedData.body
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\t/g, '\t')
        }
      }
    }

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
