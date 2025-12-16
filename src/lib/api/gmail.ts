import { supabase } from "@/lib/supabaseClient"
import { analyzeSentiment, type SentimentAnalysis } from "./claude-secure"

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
 * Haal de Gmail access token op van de huidige gebruiker
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
 * Decode base64url gecodeerde string
 */
function decodeBase64Url(str: string): string {
  try {
    // Vervang base64url characters met base64
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    // Decode base64
    const decoded = atob(base64)
    // Decode URI component voor speciale characters
    return decodeURIComponent(escape(decoded))
  } catch (error) {
    console.error("Error decoding base64:", error)
    return str
  }
}

/**
 * Haal email body op uit Gmail message payload
 */
function getEmailBody(payload: GmailMessage['payload']): string {
  // Probeer eerst de directe body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  
  // Zoek in parts voor text/plain of text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    
    // Als geen text/plain, probeer text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
  }
  
  return ""
}

/**
 * Haal een header waarde op uit de email
 */
function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ""
}

/**
 * Haal emails op met een specifiek label
 * @param labelName - De naam van het Gmail label (bijv. "INBOX", "SENT", of een custom label)
 * @param maxResults - Maximum aantal emails om op te halen (standaard 10)
 * @returns Array van email objecten
 */
export async function getEmailsByLabel(
  labelName: string,
  maxResults: number = 10
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
    }
    
    console.log("Fetching emails with label:", labelName);
    
    // Bereken datum van 24 uur geleden
    const afterDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
    
    // Stap 1: Zoek eerst het label ID op basis van de naam
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
    
    // Stap 2: Haal message IDs op met het label (laatste 24 uur)
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
    
    // Stap 3: Haal details op voor elke message
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
 * Haal alleen nieuwe (ongelezen) emails op met een specifiek label
 * @param labelName - De naam van het Gmail label (bijv. "INBOX", "SENT", of een custom label)
 * @param maxResults - Maximum aantal emails om op te halen (standaard 10)
 * @param markAsRead - Markeer emails automatisch als gelezen na ophalen (standaard true)
 * @returns Array van ongelezen email objecten
 */
export async function getUnreadEmailsByLabel(
  labelName: string,
  maxResults: number = 10,
  markAsRead: boolean = true
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
    }
    
    console.log("Fetching unread emails with label:", labelName);
    
    // Stap 1: Zoek eerst het label ID op basis van de naam
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
    
    // Stap 2: Haal ongelezen message IDs op met het label
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
    
    // Stap 2: Haal details op voor elke message
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
    
    // Stap 3: Markeer alle emails als gelezen indien gewenst
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
 * Haal emails op die na een bepaalde datum zijn ontvangen met een specifiek label
 * @param labelName - De naam van het Gmail label
 * @param afterDate - Datum waarna emails moeten zijn ontvangen
 * @param maxResults - Maximum aantal emails om op te halen (standaard 10)
 * @returns Array van email objecten
 */
export async function getRecentEmailsByLabel(
  labelName: string,
  afterDate: Date,
  maxResults: number = 10
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
    }
    
    // Format date as YYYY/MM/DD voor Gmail query
    const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/')
    
    // Stap 1: Haal message IDs op die na de datum zijn en het label hebben
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
    
    // Stap 2: Haal details op voor elke message
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
 * Verstuur een email via Gmail API
 * @param to - Ontvanger email adres
 * @param subject - Onderwerp van de email
 * @param body - Body van de email (plain text of HTML)
 * @param labelName - Optioneel: Label om aan de verzonden email toe te voegen (bijv. "Outreach2024")
 * @param isHtml - Of de body HTML is (standaard false)
 * @returns Message ID van de verzonden email
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  labelName?: string,
  isHtml: boolean = false
): Promise<string | null> {
  try {
    console.log("sendEmail called with:", { to, subject: subject.substring(0, 50), labelName, isHtml });
    
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      console.error("No access token available");
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
    }
    
    console.log("Access token retrieved successfully");
    
    // Haal huidige gebruiker email op
    const { data: { user } } = await supabase.auth.getUser()
    const fromEmail = user?.email || ""
    
    console.log("Sending from:", fromEmail);
    
    if (!fromEmail) {
      throw new Error("Kan afzender email niet bepalen. Log opnieuw in.")
    }
    
    // Maak email in RFC 2822 format
    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`,
      ``,
      body
    ]
    
    const email = emailLines.join('\r\n')
    
    // Encode email in base64url format
    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    
    console.log("Email encoded, sending to Gmail API...");
    
    // Verstuur de email
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
    
    console.log("Email sent successfully, message ID:", messageId);
    
    // Voeg label toe indien opgegeven
    if (labelName && messageId) {
      console.log("Adding label to message:", labelName);
      // Eerst checken of label bestaat, anders aanmaken
      const labelId = await ensureLabelExists(labelName)
      
      if (labelId) {
        await addLabelToMessage(messageId, labelId)
        console.log(`Label '${labelName}' toegevoegd aan verzonden email`)
      }
    }
    
    return messageId
    
  } catch (error) {
    console.error("Error in sendEmail:", error)
    throw error
  }
}

/**
 * Verstuur meerdere emails in batch
 * @param emails - Array van email objecten met to, subject, body
 * @param labelName - Optioneel: Label om aan alle verzonden emails toe te voegen
 * @returns Array van message IDs van verzonden emails
 */
export async function sendBatchEmails(
  emails: Array<{
    to: string
    subject: string
    body: string
    isHtml?: boolean
  }>,
  labelName?: string
): Promise<string[]> {
  try {
    const messageIds: string[] = []
    
    console.log(`Starting batch send of ${emails.length} emails with label: ${labelName || 'none'}`);
    
    // Verstuur emails sequentieel om rate limiting te voorkomen
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
          console.log(`✓ Email verzonden naar ${email.to}, message ID: ${messageId}`)
        } else {
          console.error(`✗ Email naar ${email.to} returned null message ID`)
        }
        
        // Kleine delay tussen emails om rate limiting te voorkomen
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`✗ Failed to send email to ${email.to}:`, error)
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  Error details: ${errorMessage}`);
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
 * Zorg ervoor dat een label bestaat, maak het aan als het niet bestaat
 * @param labelName - Naam van het label
 * @returns Label ID
 */
async function ensureLabelExists(labelName: string): Promise<string | null> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
    }
    
    // Haal alle labels op
    const labels = await getGmailLabels()
    
    // Check of label al bestaat
    const existingLabel = labels.find(l => l.name === labelName)
    if (existingLabel) {
      return existingLabel.id
    }
    
    // Label bestaat niet, maak het aan
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
    console.log(`Label '${labelName}' aangemaakt met ID: ${data.id}`)
    return data.id
    
  } catch (error) {
    console.error("Error ensuring label exists:", error)
    return null
  }
}

/**
 * Voeg een label toe aan een message
 * @param messageId - ID van het bericht
 * @param labelId - ID van het label
 * @returns Boolean indicating success
 */
async function addLabelToMessage(messageId: string, labelId: string): Promise<boolean> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
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
 * Haal reacties op een verzonden email op (emails in dezelfde thread)
 * @param threadId - Thread ID van de originele email
 * @returns Array van emails in de thread
 */
export async function getEmailThread(threadId: string): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
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
    
    // Parse alle messages in de thread
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
    
    // Sorteer op datum (oudste eerst)
    return emails.sort((a, b) => a.date.getTime() - b.date.getTime())
    
  } catch (error) {
    console.error("Error fetching email thread:", error)
    throw error
  }
}

/**
 * Haal alle reacties op emails met een specifiek label
 * @param labelName - Label naam om reacties voor op te halen
 * @param onlyUnread - Alleen ongelezen reacties ophalen (standaard true)
 * @param analyzeSentiments - Voer sentiment analyse uit op reacties (standaard true)
 * @returns Array van emails die reacties zijn op gelabelde emails
 */
export async function getRepliesByLabel(
  labelName: string,
  onlyUnread: boolean = true,
  analyzeSentiments: boolean = true
): Promise<Email[]> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
    }
    
    // Haal huidige gebruiker email op
    const { data: { user } } = await supabase.auth.getUser()
    const myEmail = user?.email?.toLowerCase() || ""
    
    console.log("Getting replies for label:", labelName, "My email:", myEmail);
    
    // Haal eerst alle emails met het label op
    const labeledEmails = await getEmailsByLabel(labelName, 100)
    
    console.log("Found labeled emails:", labeledEmails.length);
    
    if (labeledEmails.length === 0) {
      return []
    }
    
    // Haal alle threads op voor deze emails
    const threadIds = [...new Set(labeledEmails.map(e => e.threadId))]
    
    console.log("Checking threads:", threadIds.length);
    
    const allReplies: Email[] = []
    
    for (const threadId of threadIds) {
      const threadEmails = await getEmailThread(threadId)
      
      console.log(`Thread ${threadId}: ${threadEmails.length} emails`);
      
      // Filter alleen INKOMENDE reacties (niet van jou verstuurd)
      const replies = threadEmails.filter(email => {
        const hasLabel = email.labelIds.includes(labelName)
        const isUnread = email.labelIds.includes('UNREAD')
        const isSentByMe = email.from.toLowerCase().includes(myEmail)
        const isInbox = email.labelIds.includes('INBOX')
        
        // Een reply is:
        // 1. NIET het originele email met het label
        // 2. NIET van jou verstuurd (check from address)
        // 3. IN je inbox (dus ontvangen)
        // 4. Optioneel: alleen ongelezen
        const isReply = !hasLabel && !isSentByMe && isInbox && (!onlyUnread || isUnread)
        
        if (isReply) {
          console.log(`✓ Reply found from ${email.from} in thread ${threadId}`);
        }
        
        return isReply
      })
      
      allReplies.push(...replies)
    }
    
    console.log("Total replies found:", allReplies.length);
    
    // Sorteer op datum (nieuwste eerst)
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
    
    // Voer sentiment analyse uit als gewenst
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
 * Markeer een email als gelezen
 * @param messageId - De ID van het bericht om als gelezen te markeren
 * @returns Boolean indicating success
 */
export async function markEmailAsRead(messageId: string): Promise<boolean> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
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
 * Markeer meerdere emails als gelezen
 * @param messageIds - Array van message IDs om als gelezen te markeren
 * @returns Number of successfully marked emails
 */
export async function markEmailsAsRead(messageIds: string[]): Promise<number> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
    }
    
    // Gebruik batchModify voor efficiëntie (max 1000 messages per call)
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
 * Haal alle beschikbare labels op
 * @returns Array van label objecten met id en name
 */
export async function getGmailLabels(): Promise<Array<{ id: string; name: string }>> {
  try {
    const accessToken = await getGmailAccessToken()
    
    if (!accessToken) {
      throw new Error("Niet geautoriseerd. Log opnieuw in.")
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
