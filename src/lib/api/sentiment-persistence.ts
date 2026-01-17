// Sentiment persistence layer - Single source of truth for email sentiment
// TODO: [2026-01-09] Functions in this file are exported but not currently imported anywhere.
// These may be intended for future use or backend integration. Review and remove if confirmed unused.
import { supabase } from "@/lib/supabaseClient"
import { analyzeSentiment, type SentimentAnalysis } from "./claude-secure"

export interface EmailSentimentRecord {
  email_id: string // Gmail message ID
  sentiment: 'positive' | 'doubtful' | 'not_interested'
  confidence: number
  reasoning: string
  analyzed_at: string
}

/**
 * Store sentiment analysis result in Supabase
 * This is the ONLY function that should update sentiment in the database
 */
export async function storeSentiment(
  emailId: string,
  threadId: string,
  fromEmail: string,
  subject: string,
  body: string,
  organizationId: string
): Promise<SentimentAnalysis> {
  // Step 1: Analyze sentiment with AI (exactly once)
  console.log(`[SENTIMENT] Analyzing email ${emailId}...`)
  const sentiment = await analyzeSentiment(body, subject)
  
  if (sentiment.error) {
    console.error(`[SENTIMENT] Analysis failed for ${emailId}:`, sentiment.error)
    throw new Error(`Sentiment analysis failed: ${sentiment.error}`)
  }

  console.log(`[SENTIMENT] Analysis complete: ${sentiment.sentiment} (${sentiment.confidence})`)

  // Step 2: Check if email_messages record exists
  const { data: existingMessage, error: fetchError } = await supabase
    .from('email_messages')
    .select('id, message_id')
    .eq('message_id', emailId)
    .eq('org_id', organizationId)
    .maybeSingle()

  if (fetchError) {
    console.error('[SENTIMENT] Error checking existing message:', fetchError)
    throw new Error(`Database error: ${fetchError.message}`)
  }

  // Step 3: Update or insert sentiment
  if (existingMessage) {
    // Update existing record
    const { error: updateError } = await supabase
      .from('email_messages')
      .update({
        sentiment: sentiment.sentiment,
        sentiment_confidence: sentiment.confidence,
        sentiment_reasoning: sentiment.reasoning,
        sentiment_analyzed_at: new Date().toISOString(),
      })
      .eq('id', existingMessage.id)

    if (updateError) {
      console.error('[SENTIMENT] Error updating sentiment:', updateError)
      throw new Error(`Failed to update sentiment: ${updateError.message}`)
    }

    console.log(`[SENTIMENT] ✓ Sentiment stored for existing message ${emailId}`)
  } else {
    // Create new email_messages record
    // NOTE: This requires email_threads record to exist first
    // Get or create thread
    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .select('id')
      .eq('thread_id', threadId)
      .eq('org_id', organizationId)
      .maybeSingle()

    let threadUuid: string

    if (!thread) {
      // Create thread record (lead_id is nullable, omit if leads table doesn't exist)
      const threadData: any = {
        org_id: organizationId,
        thread_id: threadId,
        provider: 'gmail',
        subject: subject,
        snippet: body.substring(0, 200),
        participants: [fromEmail],
      }
      
      const { data: newThread, error: createThreadError } = await supabase
        .from('email_threads')
        .insert(threadData)
        .select('id')
        .single()

      if (createThreadError) {
        console.error('[SENTIMENT] Error creating thread:', createThreadError)
        
        // If error is about leads table not existing, provide helpful message
        if (createThreadError.message?.includes('leads')) {
          throw new Error('Database setup incomplete: email_threads table has foreign key to non-existent leads table. Please run migration: 20260108_fix_email_threads_leads_constraint.sql')
        }
        
        throw new Error(`Failed to create thread: ${createThreadError.message}`)
      }
      
      if (!newThread) {
        throw new Error('Failed to create thread: No data returned')
      }

      threadUuid = newThread.id
      console.log(`[SENTIMENT] Created new thread ${threadUuid}`)
    } else {
      threadUuid = thread.id
    }

    // Create message record with sentiment
    const { error: insertError } = await supabase
      .from('email_messages')
      .insert({
        org_id: organizationId,
        thread_id: threadUuid,
        message_id: emailId,
        from_email: fromEmail,
        to_emails: [], // Will be populated by full email sync
        subject: subject,
        body_text: body,
        body_html: body,
        is_from_me: false,
        sent_at: new Date().toISOString(),
        sentiment: sentiment.sentiment,
        sentiment_confidence: sentiment.confidence,
        sentiment_reasoning: sentiment.reasoning,
        sentiment_analyzed_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('[SENTIMENT] Error inserting message:', insertError)
      throw new Error(`Failed to insert message: ${insertError.message}`)
    }

    console.log(`[SENTIMENT] ✓ New message created with sentiment for ${emailId}`)
  }

  return sentiment
}

/**
 * Retrieve stored sentiment from database
 * This is the ONLY source of truth for sentiment data
 */
export async function getSentiment(
  emailId: string,
  organizationId: string
): Promise<SentimentAnalysis | null> {
  const { data, error } = await supabase
    .from('email_messages')
    .select('sentiment, sentiment_confidence, sentiment_reasoning, sentiment_analyzed_at')
    .eq('message_id', emailId)
    .eq('org_id', organizationId)
    .maybeSingle()

  if (error) {
    console.error('[SENTIMENT] Error fetching sentiment:', error)
    return null
  }

  if (!data || !data.sentiment) {
    console.log(`[SENTIMENT] No sentiment found for email ${emailId}`)
    return null
  }

  console.log(`[SENTIMENT] Retrieved sentiment for ${emailId}: ${data.sentiment}`)

  return {
    sentiment: data.sentiment as 'positive' | 'doubtful' | 'not_interested',
    confidence: data.sentiment_confidence || 0.5,
    reasoning: data.sentiment_reasoning || '',
  }
}

/**
 * Batch retrieve sentiments for multiple emails
 */
export async function getSentimentsBatch(
  emailIds: string[],
  organizationId: string
): Promise<Map<string, SentimentAnalysis>> {
  const { data, error } = await supabase
    .from('email_messages')
    .select('message_id, sentiment, sentiment_confidence, sentiment_reasoning')
    .eq('org_id', organizationId)
    .in('message_id', emailIds)

  if (error) {
    console.error('[SENTIMENT] Error fetching sentiments:', error)
    return new Map()
  }

  const sentimentMap = new Map<string, SentimentAnalysis>()

  for (const record of data || []) {
    if (record.sentiment) {
      sentimentMap.set(record.message_id, {
        sentiment: record.sentiment as 'positive' | 'doubtful' | 'not_interested',
        confidence: record.sentiment_confidence || 0.5,
        reasoning: record.sentiment_reasoning || '',
      })
    }
  }

  console.log(`[SENTIMENT] Retrieved ${sentimentMap.size} sentiments from ${emailIds.length} requested`)

  return sentimentMap
}
