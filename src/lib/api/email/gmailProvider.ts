/**
 * Gmail implementation of IEmailProvider
 * Wraps existing gmail.ts functions
 */

import type { IEmailProvider } from './emailProvider'
import type {
  Email,
  SendEmailRequest,
  SendEmailResult,
  Label
} from './types'
import * as gmail from '../gmail'

export class GmailProvider implements IEmailProvider {
  getProviderName(): 'gmail' {
    return 'gmail'
  }

  async checkAuthentication(): Promise<void> {
    await gmail.checkGmailAuthentication()
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
    // Send email WITHOUT applying Gmail label (campaign tracking is now database-only)
    const messageId = await gmail.sendEmail(
      request.to,
      request.subject,
      request.body,
      undefined, // No label - using campaign_name in database instead
      request.isHtml
    )

    if (!messageId) {
      throw new Error('Failed to send email: no message ID returned')
    }

    // Fetch the sent email to get thread ID
    // Note: Gmail API returns threadId in the send response, but our current
    // implementation doesn't expose it. For now, we'll use messageId as threadId
    // until we refactor gmail.ts to return the full response.

    return {
      messageId,
      threadId: messageId, // TODO: Get actual threadId from Gmail API response
      sentAt: new Date()
    }
  }

  async sendBatchEmails(
    requests: SendEmailRequest[],
    onProgress?: (current: number, total: number, success: number, failed: number) => void
  ): Promise<SendEmailResult[]> {
    const emails = requests.map(req => ({
      to: req.to,
      subject: req.subject,
      body: req.body,
      isHtml: req.isHtml
    }))

    // Send WITHOUT applying Gmail labels (campaign tracking is database-only now)
    const messageIds = await gmail.sendBatchEmails(emails, undefined, onProgress)

    return messageIds.map(messageId => ({
      messageId,
      threadId: messageId, // TODO: Get actual threadId
      sentAt: new Date()
    }))
  }

  async getEmailsByLabel(labelName: string, maxResults: number = 10): Promise<Email[]> {
    return await gmail.getEmailsByLabel(labelName, maxResults)
  }

  async getUnreadEmailsByLabel(
    labelName: string,
    maxResults: number = 10,
    markAsRead: boolean = true
  ): Promise<Email[]> {
    return await gmail.getUnreadEmailsByLabel(labelName, maxResults, markAsRead)
  }

  async getEmailThread(threadId: string): Promise<Email[]> {
    return await gmail.getEmailThread(threadId)
  }

  async getEmailThreadsBatch(threadIds: string[]): Promise<Map<string, Email[]>> {
    const map = new Map<string, Email[]>()

    // Batch fetch threads (max 100 at a time for performance)
    const BATCH_SIZE = 100

    for (let i = 0; i < threadIds.length; i += BATCH_SIZE) {
      const batch = threadIds.slice(i, i + BATCH_SIZE)

      // Fetch threads in parallel within each batch
      const promises = batch.map(async (threadId) => {
        try {
          const emails = await this.getEmailThread(threadId)
          return { threadId, emails }
        } catch (error) {
          console.error(`Error fetching thread ${threadId}:`, error)
          return { threadId, emails: [] }
        }
      })

      const results = await Promise.all(promises)

      results.forEach(({ threadId, emails }) => {
        if (emails.length > 0) {
          map.set(threadId, emails)
        }
      })
    }

    console.log(`Fetched ${map.size}/${threadIds.length} threads from Gmail`)
    return map
  }

  async getRepliesByLabel(
    labelName: string,
    onlyUnread: boolean = true,
    analyzeSentiment: boolean = true
  ): Promise<Email[]> {
    return await gmail.getRepliesByLabel(labelName, onlyUnread, analyzeSentiment)
  }

  async getLabels(): Promise<Label[]> {
    const gmailLabels = await gmail.getGmailLabels()
    
    return gmailLabels.map(label => ({
      id: label.id,
      name: label.name,
      type: label.type === 'system' ? 'system' : 'user'
    }))
  }

  async ensureLabelExists(labelName: string): Promise<string | null> {
    // Gmail's ensureLabelExists is not exported, so we need to implement it here
    // or export it from gmail.ts
    const labels = await this.getLabels()
    const existing = labels.find(l => l.name === labelName)
    
    if (existing) {
      return existing.id
    }

    // For now, return null if label doesn't exist
    // TODO: Implement label creation or export ensureLabelExists from gmail.ts
    console.warn(`Label "${labelName}" not found. Create it manually in Gmail.`)
    return null
  }

  async deleteLabel(labelId: string): Promise<void> {
    await gmail.deleteGmailLabel(labelId)
  }
}
