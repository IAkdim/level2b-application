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
    const messageId = await gmail.sendEmail(
      request.to,
      request.subject,
      request.body,
      request.label,
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

    const label = requests[0]?.label // Assuming all use same label
    const messageIds = await gmail.sendBatchEmails(emails, label, onProgress)

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
