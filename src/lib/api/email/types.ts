/**
 * Shared types for email provider abstraction
 */

import type { SentimentAnalysis } from "../claude-secure"

/**
 * Email object returned by providers (on-demand fetched, not stored)
 */
export interface Email {
  id: string           // Provider's message ID
  threadId: string     // Provider's thread/conversation ID
  from: string
  to: string
  subject: string
  snippet: string
  body: string
  date: Date
  labelIds: string[]
  sentiment?: SentimentAnalysis
}

/**
 * Request to send an email
 */
export interface SendEmailRequest {
  to: string
  subject: string
  body: string
  isHtml?: boolean
  label?: string       // Gmail label or Outlook category for tracking
  leadId?: string      // Optional: associate with a lead
}

/**
 * Result after sending an email
 */
export interface SendEmailResult {
  messageId: string
  threadId: string
  sentAt: Date
}

/**
 * Email thread (conversation) with minimal metadata
 */
export interface EmailThread {
  threadId: string
  subject: string
  snippet: string
  participants: string[]
  lastMessageDate: Date
  messageCount: number
  isRead: boolean
  labels: string[]
}

/**
 * Email label/category
 */
export interface Label {
  id: string
  name: string
  type?: 'system' | 'user'
}

/**
 * Email tracking metadata record (stored in Supabase)
 */
export interface EmailTrackingMetadata {
  id: string
  user_id: string
  lead_id?: string
  thread_id: string
  message_id: string
  provider: 'gmail' | 'outlook'
  sent_at: string      // ISO timestamp
  label?: string
  created_at: string
}
