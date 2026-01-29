import { supabase } from "@/lib/supabaseClient"
import { analyzeSentiment, type SentimentAnalysis } from "./claude-secure"
import { AuthenticationError } from "./reauth"
import { rateLimiter } from "./rateLimiter"
import { prepareEmailWithTracking, type PreparedEmail } from "./emailTracking"

/**
 * Hash an email address for privacy in tracking
 */
function hashEmailForTracking(email: string): string {
  const normalized = email.toLowerCase().trim()
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{
      name: string
      value: string
    }>
    body: {
      data?: string
    }
    parts?: Array<{
      mimeType: string
      body: {
        data?: string
      }
    }>
  }
  internalDate: string
}

export interface Email {
  id: string
  threadId: string
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
 * Get the Gmail access token for the current user
 */
async function getGmailAccessToken(): Promise<string | null> {
  try {
    console.log("Getting Gmail access token...");
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error("Error getting session:", error);
      return null;
    }
    
    if (!session) {
      console.error("No session found");
      return null;
    }
    
    console.log("Session found, checking for provider_token...");
    
    if (!session.provider_token) {
      console.error("No provider_token in session. User needs to re-authenticate with Google.");
      console.log("Session data:", { 
        user: session.user?.email,
        provider: session.user?.app_metadata?.provider 
      });
      return null
    }
    
    console.log("Provider token found successfully");
    return session.provider_token
  } catch (error) {
    console.error("Exception in getGmailAccessToken:", error);
    return null;
  }
}

/**
 * Check if Gmail authentication is valid before sending emails
 * @throws {AuthenticationError} if authentication is required
 */
export async function checkGmailAuthentication(): Promise<void> {
  const token = await getGmailAccessToken()
  if (!token) {
    throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
  }
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(str: string): string {
  try {
    // Replace base64url characters with base64
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    // Decode base64
    const decoded = atob(base64)
    // Decode URI component for special characters
    return decodeURIComponent(escape(decoded))
  } catch (error) {
    console.error("Error decoding base64:", error)
    return str
  }
}

/**
 * Extract email body from Gmail message payload
 */
function getEmailBody(payload: GmailMessage['payload']): string {
  // Try direct body first
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  
  // Search in parts for text/plain or text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    
    // If no text/plain, try text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
  }
  
  return ""
}

/**
 * Get a header value from the email
 */
function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ""
}

/**
 * Fetch emails with a specific label
 * @param labelName - The name of the Gmail label (e.g., "INBOX", "SENT", or a custom label)
 * @param maxResults - Maximum number of emails to fetch (default 10)
 * @returns Array of email objects
 */
export async function getEmailsByLabel(
  labelName: string,
  maxResults: number = 10
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    console.log("Fetching emails with label:", labelName);
    
    // Calculate date from 24 hours ago
    const afterDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
    
    // Step 1: Find the label ID based on the name
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!labelsResponse.ok) {
      const error = await labelsResponse.json()
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const labelsData = await labelsResponse.json()
    const matchingLabel = labelsData.labels.find(
      (label: { name: string; id: string }) => 
        label.name.toLowerCase() === labelName.toLowerCase()
    )
    
    if (!matchingLabel) {
      console.log(`Label "${labelName}" not found in Gmail labels.`);
      return []
    }
    
    console.log(`Found label "${labelName}" with ID:`, matchingLabel.id);
    
    // Step 2: Get message IDs with the label (last 24 hours)
    const query = encodeURIComponent(`after:${afterTimestamp}`)
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${matchingLabel.id}&q=${query}&maxResults=${maxResults}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!listResponse.ok) {
      const error = await listResponse.json()
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const listData = await listResponse.json()
    console.log("Gmail API found messages:", listData.messages?.length || 0);
    
    if (!listData.messages || listData.messages.length === 0) {
      return []
    }
    
    // Step 3: Get details for each message
    const emailPromises = listData.messages.map(async (msg: { id: string }) => {
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )
      
      if (!detailResponse.ok) {
        console.error(`Failed to fetch message ${msg.id}`)
        return null
      }
      
      const message: GmailMessage = await detailResponse.json()
      
      // Parse email data
      const headers = message.payload.headers
      const email: Email = {
        id: message.id,
        threadId: message.threadId,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        snippet: message.snippet,
        body: getEmailBody(message.payload),
        date: new Date(parseInt(message.internalDate)),
        labelIds: message.labelIds,
      }
      
      return email
    })
    
    const emails = await Promise.all(emailPromises)
    
    // Filter out null values and remove duplicates by thread ID
    const validEmails = emails.filter((email): email is Email => email !== null)
    
    // Remove duplicates: keep only the latest email per thread
    const uniqueThreads = new Map<string, Email>();
    validEmails.forEach(email => {
      const existing = uniqueThreads.get(email.threadId);
      if (!existing || email.date > existing.date) {
        uniqueThreads.set(email.threadId, email);
      }
    });
    
    const result = Array.from(uniqueThreads.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
    console.log("Returning unique emails:", result.length);
    return result;
    
  } catch (error) {
    console.error("Error fetching emails:", error)
    throw error
  }
}

/**
 * Fetch only new (unread) emails with a specific label
 * @param labelName - The name of the Gmail label (e.g., "INBOX", "SENT", or a custom label)
 * @param maxResults - Maximum number of emails to fetch (default 10)
 * @param markAsRead - Automatically mark emails as read after fetching (default true)
 * @returns Array of unread email objects
 */
export async function getUnreadEmailsByLabel(
  labelName: string,
  maxResults: number = 10,
  markAsRead: boolean = true
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    console.log("Fetching unread emails with label:", labelName);
    
    // Step 1: Find the label ID based on the name
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!labelsResponse.ok) {
      const error = await labelsResponse.json()
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const labelsData = await labelsResponse.json()
    const matchingLabel = labelsData.labels.find(
      (label: { name: string; id: string }) => 
        label.name.toLowerCase() === labelName.toLowerCase()
    )
    
    if (!matchingLabel) {
      console.log(`Label "${labelName}" not found in Gmail labels.`);
      return []
    }
    
    console.log(`Found label "${labelName}" with ID:`, matchingLabel.id);
    
    // Step 2: Get unread message IDs with the label
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${matchingLabel.id}&maxResults=${maxResults}`;
    console.log("Gmail API URL:", url);
    
    const listResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    
    if (!listResponse.ok) {
      const error = await listResponse.json()
      console.error("Gmail API error response:", error);
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const listData = await listResponse.json()
    console.log("Gmail API found messages:", listData.messages?.length || 0);
    
    if (!listData.messages || listData.messages.length === 0) {
      console.log("No messages found with label:", labelName);
      return []
    }
    
    // Step 3: Get details for each message
    const emailPromises = listData.messages.map(async (msg: { id: string }) => {
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )
      
      if (!detailResponse.ok) {
        console.error(`Failed to fetch message ${msg.id}`)
        return null
      }
      
      const message: GmailMessage = await detailResponse.json()
      
      // Parse email data
      const headers = message.payload.headers
      const email: Email = {
        id: message.id,
        threadId: message.threadId,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        snippet: message.snippet,
        body: getEmailBody(message.payload),
        date: new Date(parseInt(message.internalDate)),
        labelIds: message.labelIds,
      }
      
      return email
    })
    
    const emails = await Promise.all(emailPromises)
    
    // Filter out null values (failed fetches)
    const validEmails = emails.filter((email): email is Email => email !== null)
    
    // Step 3: Mark all emails as read if desired
    if (markAsRead && validEmails.length > 0) {
      const messageIds = validEmails.map(email => email.id)
      const markedCount = await markEmailsAsRead(messageIds)
      console.log(`Marked ${markedCount} out of ${validEmails.length} emails as read`)
    }
    
    return validEmails
    
  } catch (error) {
    console.error("Error fetching unread emails:", error)
    throw error
  }
}

/**
 * Fetch emails received after a specific date with a specific label
 * @param labelName - The name of the Gmail label
 * @param afterDate - Date after which emails must be received
 * @param maxResults - Maximum number of emails to fetch (default 10)
 * @returns Array of email objects
 */
export async function getRecentEmailsByLabel(
  labelName: string,
  afterDate: Date,
  maxResults: number = 10
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    // Format date as YYYY/MM/DD for Gmail query
    const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/')
    
    // Step 1: Get message IDs after the date with the label
    const query = encodeURIComponent(`after:${dateStr} label:${labelName}`)
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!listResponse.ok) {
      const error = await listResponse.json()
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const listData = await listResponse.json()
    
    if (!listData.messages || listData.messages.length === 0) {
      return []
    }
    
    // Step 2: Get details for each message
    const emailPromises = listData.messages.map(async (msg: { id: string }) => {
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )
      
      if (!detailResponse.ok) {
        console.error(`Failed to fetch message ${msg.id}`)
        return null
      }
      
      const message: GmailMessage = await detailResponse.json()
      
      // Parse email data
      const headers = message.payload.headers
      const email: Email = {
        id: message.id,
        threadId: message.threadId,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        snippet: message.snippet,
        body: getEmailBody(message.payload),
        date: new Date(parseInt(message.internalDate)),
        labelIds: message.labelIds,
      }
      
      return email
    })
    
    const emails = await Promise.all(emailPromises)
    
    // Filter out null values (failed fetches)
    return emails.filter((email): email is Email => email !== null)
    
  } catch (error) {
    console.error("Error fetching recent emails:", error)
    throw error
  }
}

/**
 * Send an email via Gmail API
 * @param to - Recipient email address
 * @param subject - Subject of the email
 * @param body - Body of the email (plain text or HTML)
 * @param labelName - Optional: Label to add to the sent email (e.g., "Outreach2024")
 * @param isHtml - Whether the body is HTML (default false)
 * @param enableTracking - Enable open tracking (default true, converts to HTML if needed)
 * @returns Object with message ID and tracking info
 */
export interface SendEmailResult {
  messageId: string | null
  trackingId: string | null
  hasTracking: boolean
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  labelName?: string,
  isHtml: boolean = false,
  enableTracking: boolean = true
): Promise<string | null> {
  try {
    console.log("sendEmail called with:", { to, subject: subject.substring(0, 50), labelName, isHtml, enableTracking });
    
    // Check rate limit first
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const rateCheck = await rateLimiter.checkLimit('email_send', session.user.id)
      if (!rateCheck.allowed) {
        throw new Error(rateCheck.message || 'Email sending rate limit exceeded. Please try again later.')
      }
    }
    
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      console.error("No access token available");
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    console.log("Access token retrieved successfully");
    
    // Get current user email
    const { data: { user } } = await supabase.auth.getUser()
    const fromEmail = user?.email || ""
    
    console.log("Sending from:", fromEmail);
    
    if (!fromEmail) {
      throw new AuthenticationError("Cannot determine sender email. Please re-authenticate.")
    }
    
    // Prepare email with tracking pixel if enabled
    const prepared: PreparedEmail = prepareEmailWithTracking(body, to, enableTracking)
    const processedBody = prepared.body
    const contentType = prepared.isHtml || isHtml ? 'text/html' : 'text/plain'
    
    console.log("Email prepared:", { 
      hasTracking: prepared.hasTracking, 
      trackingId: prepared.trackingId?.substring(0, 8),
      isHtml: prepared.isHtml 
    });
    
    // Create email in RFC 2822 format with tracking-enabled body
    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${contentType}; charset=utf-8`,
      `X-Tracking-Id: ${prepared.trackingId}`, // Custom header for internal tracking
      ``,
      processedBody
    ]
    
    const email = emailLines.join('\r\n')
    
    // Encode email in base64url format
    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    
    console.log("Email encoded, sending to Gmail API...");
    
    // Send the email
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedEmail
        }),
      }
    )
    
    console.log("Gmail API response status:", response.status);
    
    if (!response.ok) {
      const error = await response.json()
      console.error("Gmail API error:", error);
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const data = await response.json()
    const messageId = data.id
    
    console.log("Email sent successfully, message ID:", messageId, "tracking ID:", prepared.trackingId);
    
    // Add label if specified
    if (labelName && messageId) {
      console.log("Adding label to message:", labelName);
      // First check if label exists, otherwise create it
      const labelId = await ensureLabelExists(labelName)
      
      if (labelId) {
        await addLabelToMessage(messageId, labelId)
        console.log(`Label '${labelName}' added to sent email`)
      }
    }
    
    // Store tracking info in database for open tracking
    if (prepared.hasTracking && session?.user?.id) {
      try {
        const { error: trackingError } = await supabase
          .from('email_tracking')
          .insert({
            user_id: session.user.id,
            tracking_id: prepared.trackingId,
            gmail_message_id: messageId,
            recipient_email: to,
            recipient_email_hash: hashEmailForTracking(to),
            subject: subject,
            label_name: labelName || null,
            sent_at: new Date().toISOString()
          })
        
        if (trackingError) {
          console.warn('Failed to store tracking info:', trackingError.message)
          // Don't fail the send if tracking storage fails
        } else {
          console.log(`Tracking stored: trackingId=${prepared.trackingId}, gmailId=${messageId}`)
        }
      } catch (err) {
        console.warn('Error storing tracking info:', err)
        // Don't fail the send
      }
    }
    
    // Log tracking info for debugging (tracking ID is embedded in the email pixel)
    if (prepared.hasTracking) {
      console.log(`Email tracking enabled: trackingId=${prepared.trackingId}, recipient=${to}`)
    }
    
    return messageId
    
  } catch (error) {
    console.error("Error in sendEmail:", error)
    throw error
  }
}

/**
 * Send multiple emails in batch
 * @param emails - Array of email objects with to, subject, body
 * @param labelName - Optional: Label to add to all sent emails
 * @param onProgress - Optional: Callback function called after each email is sent
 * @returns Array of message IDs of sent emails
 */
export async function sendBatchEmails(
  emails: Array<{
    to: string
    subject: string
    body: string
    isHtml?: boolean
  }>,
  labelName?: string,
  onProgress?: (current: number, total: number, success: number, failed: number) => void
): Promise<string[]> {
  try {
    const messageIds: string[] = []
    let failedCount = 0
    
    console.log(`Starting batch send of ${emails.length} emails with label: ${labelName || 'none'}`);
    
    // Send emails sequentially to avoid rate limiting
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        console.log(`Sending email ${i + 1}/${emails.length} to ${email.to}`);
        
        const messageId = await sendEmail(
          email.to,
          email.subject,
          email.body,
          labelName,
          email.isHtml
        )
        
        if (messageId) {
          messageIds.push(messageId)
          console.log(`✓ Email sent to ${email.to}, message ID: ${messageId}`)
        } else {
          console.error(`✗ Email to ${email.to} returned null message ID`)
          failedCount++
        }
        
        // Call progress callback
        if (onProgress) {
          onProgress(i + 1, emails.length, messageIds.length, failedCount)
        }
        
        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`✗ Failed to send email to ${email.to}:`, error)
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  Error details: ${errorMessage}`);
        failedCount++
        
        // Call progress callback even on error
        if (onProgress) {
          onProgress(i + 1, emails.length, messageIds.length, failedCount)
        }
      }
    }
    
    console.log(`Batch send completed: ${messageIds.length} successful, ${emails.length - messageIds.length} failed`);
    return messageIds
    
  } catch (error) {
    console.error("Error in sendBatchEmails:", error)
    throw error
  }
}

/**
 * Ensure a label exists, create it if it doesn't
 * @param labelName - Name of the label
 * @returns Label ID
 */
async function ensureLabelExists(labelName: string): Promise<string | null> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    // Fetch all labels
    const labels = await getGmailLabels()
    
    // Check if label already exists
    const existingLabel = labels.find(l => l.name === labelName)
    if (existingLabel) {
      return existingLabel.id
    }
    
    // Label doesn't exist, create it
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }),
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to create label:', error)
      return null
    }
    
    const data = await response.json()
    console.log(`Label '${labelName}' created with ID: ${data.id}`)
    return data.id
    
  } catch (error) {
    console.error("Error ensuring label exists:", error)
    return null
  }
}

/**
 * Add a label to a message
 * @param messageId - ID of the message
 * @param labelId - ID of the label
 * @returns Boolean indicating success
 */
async function addLabelToMessage(messageId: string, labelId: string): Promise<boolean> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: [labelId]
        }),
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      console.error(`Failed to add label to message ${messageId}:`, error)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error("Error adding label to message:", error)
    return false
  }
}

/**
 * Get replies to a sent email (emails in the same thread)
 * @param threadId - Thread ID of the original email
 * @returns Array of emails in the thread
 */
export async function getEmailThread(threadId: string): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const threadData = await response.json()
    
    if (!threadData.messages || threadData.messages.length === 0) {
      return []
    }
    
    // Parse all messages in the thread
    const emails: Email[] = threadData.messages.map((message: GmailMessage) => {
      const headers = message.payload.headers
      return {
        id: message.id,
        threadId: message.threadId,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        snippet: message.snippet,
        body: getEmailBody(message.payload),
        date: new Date(parseInt(message.internalDate)),
        labelIds: message.labelIds,
      }
    })
    
    // Sort by date (oldest first)
    return emails.sort((a, b) => a.date.getTime() - b.date.getTime())
    
  } catch (error) {
    console.error("Error fetching email thread:", error)
    throw error
  }
}

/**
 * Fetch all replies to emails with a specific label
 * @param labelName - Label name to fetch replies for
 * @param onlyUnread - Only fetch unread replies (default true)
 * @param analyzeSentiments - Perform sentiment analysis on replies (default true)
 * @returns Array of emails that are replies to labelled emails
 */
export async function getRepliesByLabel(
  labelName: string,
  onlyUnread: boolean = true,
  analyzeSentiments: boolean = true
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    // Get current user email
    const { data: { user } } = await supabase.auth.getUser()
    const myEmail = user?.email?.toLowerCase() || ""
    
    console.log("Getting replies for label:", labelName, "My email:", myEmail);
    
    // First fetch all emails with the label
    const labeledEmails = await getEmailsByLabel(labelName, 100)
    
    console.log("Found labeled emails:", labeledEmails.length);
    
    if (labeledEmails.length === 0) {
      return []
    }
    
    // Fetch all threads for these emails
    const threadIds = [...new Set(labeledEmails.map(e => e.threadId))]
    
    console.log("Checking threads:", threadIds.length);
    
    const allReplies: Email[] = []
    
    for (const threadId of threadIds) {
      const threadEmails = await getEmailThread(threadId)
      
      console.log(`Thread ${threadId}: ${threadEmails.length} emails`);
      
      // Filter only INCOMING replies (not sent by you)
      const replies = threadEmails.filter(email => {
        const hasLabel = email.labelIds.includes(labelName)
        const isUnread = email.labelIds.includes('UNREAD')
        const isSentByMe = email.from.toLowerCase().includes(myEmail)
        const isInbox = email.labelIds.includes('INBOX')
        
        // A reply is:
        // 1. NOT the original email with the label
        // 2. NOT sent by you (check from address)
        // 3. IN your inbox (so received)
        // 4. Optional: only unread
        const isReply = !hasLabel && !isSentByMe && isInbox && (!onlyUnread || isUnread)
        
        if (isReply) {
          console.log(`✓ Reply found from ${email.from} in thread ${threadId}`);
        }
        
        return isReply
      })
      
      allReplies.push(...replies)
    }
    
    console.log("Total replies found:", allReplies.length);
    
    // Sort by date (newest first)
    const sortedReplies = allReplies.sort((a, b) => b.date.getTime() - a.date.getTime())
    
    // Remove duplicates: keep only the latest email per thread
    const uniqueThreads = new Map<string, Email>();
    sortedReplies.forEach(email => {
      const existing = uniqueThreads.get(email.threadId);
      if (!existing || email.date > existing.date) {
        uniqueThreads.set(email.threadId, email);
      }
    });
    
    const uniqueReplies = Array.from(uniqueThreads.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Perform sentiment analysis if requested
    if (analyzeSentiments && uniqueReplies.length > 0) {
      console.log(`Analyzing sentiment for ${uniqueReplies.length} replies...`);
      
      for (const reply of uniqueReplies) {
        try {
          const sentiment = await analyzeSentiment(reply.body, reply.subject);
          reply.sentiment = sentiment;
          
          console.log(`✓ Sentiment analyzed for email ${reply.id}: ${sentiment.sentiment} (${sentiment.confidence})`);
        } catch (error) {
          console.error(`Failed to analyze sentiment for email ${reply.id}:`, error);
        }
      }
    }
    
    return uniqueReplies;
    
  } catch (error) {
    console.error("Error fetching replies by label:", error)
    throw error
  }
}

/**
 * Mark an email as read
 * @param messageId - The ID of the message to mark as read
 * @returns Boolean indicating success
 */
export async function markEmailAsRead(messageId: string): Promise<boolean> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        }),
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      console.error(`Failed to mark message ${messageId} as read:`, error)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error("Error marking email as read:", error)
    return false
  }
}

/**
 * Mark multiple emails as read
 * @param messageIds - Array of message IDs to mark as read
 * @returns Number of successfully marked emails
 */
export async function markEmailsAsRead(messageIds: string[]): Promise<number> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    // Use batchModify for efficiency (max 1000 messages per call)
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: messageIds,
          removeLabelIds: ['UNREAD']
        }),
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to mark messages as read:', error)
      return 0
    }
    
    return messageIds.length
    
  } catch (error) {
    console.error("Error marking emails as read:", error)
    return 0
  }
}

/**
 * Fetch all available labels
 * @returns Array van label objecten met id en name
 */
export async function getGmailLabels(): Promise<Array<{ id: string; name: string; type?: string }>> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gmail API error: ${error.error?.message || 'Unknown error'}`)
    }
    
    const data = await response.json()
    return data.labels || []
    
  } catch (error) {
    console.error("Error fetching labels:", error)
    throw error
  }
}

/**
 * Delete a Gmail label
 * @param labelId - The ID of the label to delete
 */
export async function deleteGmailLabel(labelId: string): Promise<void> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new AuthenticationError("Google re-authentication required. Please re-connect your Gmail account.")
    }
    
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to delete label: ${error.error?.message || 'Unknown error'}`)
    }
    
    console.log(`Label ${labelId} deleted successfully`)
    
  } catch (error) {
    console.error("Error deleting label:", error)
    throw error
  }
}
