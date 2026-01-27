// Email tracking utilities for generating tracking pixels and tokens
// Used when sending emails to embed tracking capabilities

import { supabase } from '../supabaseClient'

// Get Supabase project URL from environment or client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const EMAIL_TRACKING_SECRET = import.meta.env.VITE_EMAIL_TRACKING_SECRET || 'your-tracking-secret-change-in-production'

/**
 * Generate a simple hash signature for tracking token verification
 * Note: This must match the signature generation in the Edge Function
 */
function generateSignature(messageId: string, recipientHash: string, timestamp: number): string {
  const data = `${messageId}:${recipientHash}:${timestamp}`
  
  // Simple hash (matches the Edge Function implementation)
  const combined = EMAIL_TRACKING_SECRET + data
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Hash an email address for privacy
 * We don't store the actual email in tracking tokens
 */
function hashEmail(email: string): string {
  const normalized = email.toLowerCase().trim()
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * Generate a tracking token for an email
 * @param trackingId - The email's tracking_id UUID (from email_messages.tracking_id)
 * @param recipientEmail - The recipient's email address
 * @returns Base64URL encoded tracking token
 */
export function generateTrackingToken(trackingId: string, recipientEmail: string): string {
  const recipientHash = hashEmail(recipientEmail)
  const timestamp = Date.now()
  const signature = generateSignature(trackingId, recipientHash, timestamp)
  
  const payload = {
    mid: trackingId, // tracking_id is used for lookup in Edge Function
    rh: recipientHash,
    ts: timestamp,
    sig: signature
  }
  
  // Base64URL encode (URL-safe base64)
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  
  return encoded
}

/**
 * Generate the tracking pixel HTML to embed in emails
 * @param trackingId - The email's tracking_id UUID (from email_messages.tracking_id)
 * @param recipientEmail - The recipient's email address
 * @returns HTML string containing the tracking pixel
 */
export function generateTrackingPixelHtml(trackingId: string, recipientEmail: string): string {
  const token = generateTrackingToken(trackingId, recipientEmail)
  const trackingUrl = `${SUPABASE_URL}/functions/v1/track-email-open?t=${token}`
  
  // Invisible 1x1 pixel with multiple fallback hiding techniques
  return `<img src="${trackingUrl}" width="1" height="1" style="display:none;visibility:hidden;width:1px;height:1px;opacity:0;border:0;margin:0;padding:0;" alt="" />`
}

/**
 * Inject tracking pixel into HTML email body
 * @param htmlBody - The original HTML email body
 * @param messageId - The email message UUID
 * @param recipientEmail - The recipient's email address
 * @returns Modified HTML with tracking pixel injected
 */
export function injectTrackingPixel(
  htmlBody: string,
  messageId: string,
  recipientEmail: string
): string {
  const trackingPixel = generateTrackingPixelHtml(messageId, recipientEmail)
  
  // Try to inject before closing </body> tag for valid HTML
  if (htmlBody.toLowerCase().includes('</body>')) {
    return htmlBody.replace(
      /<\/body>/i,
      `${trackingPixel}</body>`
    )
  }
  
  // Try to inject before closing </html> tag
  if (htmlBody.toLowerCase().includes('</html>')) {
    return htmlBody.replace(
      /<\/html>/i,
      `${trackingPixel}</html>`
    )
  }
  
  // Fallback: append to the end
  return htmlBody + trackingPixel
}

/**
 * Convert plain text email to minimal HTML with tracking
 * @param textBody - Plain text email body
 * @param messageId - The email message UUID
 * @param recipientEmail - The recipient's email address
 * @returns HTML version with tracking pixel
 */
export function convertToHtmlWithTracking(
  textBody: string,
  messageId: string,
  recipientEmail: string
): string {
  const trackingPixel = generateTrackingPixelHtml(messageId, recipientEmail)
  
  // Convert plain text to basic HTML
  // Preserve line breaks and basic formatting
  const escapedBody = textBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>\n')
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
${escapedBody}
${trackingPixel}
</body>
</html>`
}

/**
 * Check if an email body is HTML
 */
export function isHtmlEmail(body: string): boolean {
  const trimmed = body.trim().toLowerCase()
  return trimmed.startsWith('<!doctype') || 
         trimmed.startsWith('<html') ||
         /<[a-z][\s\S]*>/i.test(body)
}

/**
 * Generate a unique message ID for email tracking
 * This should be called before sending and stored with the email
 */
export function generateMessageTrackingId(): string {
  // Use crypto.randomUUID if available, otherwise generate a v4-like UUID
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Prepare email for sending with tracking
 * Returns the modified body and tracking ID
 */
export interface PreparedEmail {
  body: string
  trackingId: string
  hasTracking: boolean
  isHtml: boolean
}

export function prepareEmailWithTracking(
  body: string,
  recipientEmail: string,
  enableTracking: boolean = true
): PreparedEmail {
  const trackingId = generateMessageTrackingId()
  const isHtml = isHtmlEmail(body)
  
  if (!enableTracking) {
    return {
      body,
      trackingId,
      hasTracking: false,
      isHtml
    }
  }
  
  let processedBody: string
  
  if (isHtml) {
    // Inject tracking pixel into existing HTML
    processedBody = injectTrackingPixel(body, trackingId, recipientEmail)
  } else {
    // Convert to HTML with tracking
    processedBody = convertToHtmlWithTracking(body, trackingId, recipientEmail)
  }
  
  return {
    body: processedBody,
    trackingId,
    hasTracking: true,
    isHtml: true // Always HTML after processing
  }
}

/**
 * Store tracking ID after email is sent
 * This should be called after successful email send
 */
export async function storeEmailTracking(
  internalMessageId: string,
  trackingId: string,
  hasTracking: boolean
): Promise<void> {
  const { error } = await supabase
    .from('email_messages')
    .update({
      tracking_id: trackingId,
      has_tracking: hasTracking,
      updated_at: new Date().toISOString()
    })
    .eq('id', internalMessageId)
  
  if (error) {
    console.error('Failed to store email tracking ID:', error)
  }
}

/**
 * Get open status for an email
 */
export interface EmailOpenStatus {
  isOpened: boolean
  firstOpenedAt: string | null
  openCount: number
  hasTracking: boolean
}

export async function getEmailOpenStatus(messageId: string): Promise<EmailOpenStatus | null> {
  const { data, error } = await supabase
    .from('email_messages')
    .select('is_opened, first_opened_at, open_count, has_tracking')
    .eq('id', messageId)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return {
    isOpened: data.is_opened || false,
    firstOpenedAt: data.first_opened_at,
    openCount: data.open_count || 0,
    hasTracking: data.has_tracking || false
  }
}

/**
 * Get open stats for multiple Gmail message IDs
 * Maps gmail_message_id to open tracking data
 */
export interface BulkEmailOpenStatus {
  gmailMessageId: string
  isOpened: boolean
  firstOpenedAt: Date | null
  openCount: number
  hasTracking: boolean
}

export async function getEmailOpenStatsBulk(gmailMessageIds: string[]): Promise<BulkEmailOpenStatus[]> {
  if (gmailMessageIds.length === 0) return []
  
  try {
    // Try the new simple email_tracking table first
    const { data: trackingData, error: trackingError } = await supabase
      .from('email_tracking')
      .select('gmail_message_id, is_opened, first_opened_at, open_count')
      .in('gmail_message_id', gmailMessageIds)
    
    if (!trackingError && trackingData && trackingData.length > 0) {
      console.log('Found tracking data in email_tracking table:', trackingData.length, 'records')
      return trackingData.map((row: any) => ({
        gmailMessageId: row.gmail_message_id,
        isOpened: row.is_opened || false,
        firstOpenedAt: row.first_opened_at ? new Date(row.first_opened_at) : null,
        openCount: row.open_count || 0,
        hasTracking: true
      }))
    }
    
    // Fallback: Query the legacy email_messages table
    // Note: email_messages uses 'message_id' (not 'gmail_message_id')
    const { data: messagesData, error: messagesError } = await supabase
      .from('email_messages')
      .select('message_id, is_opened, first_opened_at, open_count, has_tracking, tracking_id')
      .in('message_id', gmailMessageIds)
    
    if (messagesError) {
      console.warn('Could not fetch from email_messages table:', messagesError.message)
      return []
    }
    
    console.log('Found tracking data in email_messages table:', messagesData?.length || 0, 'records')
    return (messagesData || []).map((row: any) => ({
      gmailMessageId: row.message_id,
      isOpened: row.is_opened || false,
      firstOpenedAt: row.first_opened_at ? new Date(row.first_opened_at) : null,
      openCount: row.open_count || 0,
      hasTracking: row.has_tracking || !!row.tracking_id
    }))
  } catch (err) {
    console.warn('Could not fetch email open stats:', err)
    return []
  }
}

/**
 * Get open statistics for a campaign (by label)
 */
export interface CampaignOpenStats {
  campaign: string
  totalSent: number
  totalWithTracking: number
  uniqueOpens: number
  openRate: number
}

export async function getCampaignOpenStats(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<CampaignOpenStats[]> {
  const { data, error } = await supabase.rpc('get_campaign_open_rates', {
    p_user_id: userId,
    p_start_date: startDate || null,
    p_end_date: endDate || null
  })
  
  if (error) {
    console.error('Failed to get campaign open stats:', error)
    return []
  }
  
  return (data || []).map((row: any) => ({
    campaign: row.campaign_name,
    totalSent: row.total_sent,
    totalWithTracking: row.total_sent, // All tracked in this version
    uniqueOpens: row.total_opened,
    openRate: row.open_rate
  }))
}
