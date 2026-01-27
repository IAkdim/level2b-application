/**
 * Email service facade
 * Auto-detects provider (Gmail/Outlook) and routes calls appropriately
 * Also handles email tracking metadata storage
 */

import { supabase } from "@/lib/supabaseClient"
import type { IEmailProvider } from './emailProvider'
import type {
  Email,
  SendEmailRequest,
  SendEmailResult,
  Label
} from './types'
import { GmailProvider } from './gmailProvider'
import { OutlookProvider } from './outlookProvider'
import { saveEmailTracking } from './emailTracking'

class EmailService {
  private provider: IEmailProvider | null = null
  private providerType: 'gmail' | 'outlook' | null = null

  /**
   * Auto-detect and initialize the appropriate email provider
   */
  private async getProvider(): Promise<IEmailProvider> {
    if (this.provider && this.providerType) {
      return this.provider
    }

    // Detect provider from Supabase auth session
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session. Please authenticate.')
    }

    const provider = session.user?.app_metadata?.provider

    if (provider === 'google') {
      this.providerType = 'gmail'
      this.provider = new GmailProvider()
    } else if (provider === 'azure' || provider === 'microsoft') {
      this.providerType = 'outlook'
      this.provider = new OutlookProvider()
    } else {
      throw new Error(`Unsupported email provider: ${provider}`)
    }

    return this.provider
  }

  /**
   * Send a single email and track it
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
    const provider = await this.getProvider()
    const result = await provider.sendEmail(request)

    // Save tracking metadata to Supabase
    await saveEmailTracking({
      threadId: result.threadId,
      messageId: result.messageId,
      provider: this.providerType!,
      label: request.label,
      leadId: request.leadId,
      sentAt: result.sentAt
    })

    return result
  }

  /**
   * Send multiple emails in batch and track them
   */
  async sendBatchEmails(
    requests: SendEmailRequest[],
    onProgress?: (current: number, total: number, success: number, failed: number) => void
  ): Promise<SendEmailResult[]> {
    const provider = await this.getProvider()
    const results = await provider.sendBatchEmails(requests, onProgress)

    // Save all tracking metadata
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const request = requests[i]

      await saveEmailTracking({
        threadId: result.threadId,
        messageId: result.messageId,
        provider: this.providerType!,
        label: request.label,
        leadId: request.leadId,
        sentAt: result.sentAt
      })
    }

    return results
  }

  /**
   * Get emails by label (on-demand fetch from provider)
   */
  async getEmailsByLabel(labelName: string, maxResults: number = 10): Promise<Email[]> {
    const provider = await this.getProvider()
    return await provider.getEmailsByLabel(labelName, maxResults)
  }

  /**
   * Get unread emails by label
   */
  async getUnreadEmailsByLabel(
    labelName: string,
    maxResults: number = 10,
    markAsRead: boolean = true
  ): Promise<Email[]> {
    const provider = await this.getProvider()
    return await provider.getUnreadEmailsByLabel(labelName, maxResults, markAsRead)
  }

  /**
   * Get email thread by ID (on-demand fetch)
   */
  async getEmailThread(threadId: string): Promise<Email[]> {
    const provider = await this.getProvider()
    return await provider.getEmailThread(threadId)
  }

  /**
   * Get replies to emails with a specific label
   */
  async getRepliesByLabel(
    labelName: string,
    onlyUnread: boolean = true,
    analyzeSentiment: boolean = true
  ): Promise<Email[]> {
    const provider = await this.getProvider()
    return await provider.getRepliesByLabel(labelName, onlyUnread, analyzeSentiment)
  }

  /**
   * Get all available labels
   */
  async getLabels(): Promise<Label[]> {
    const provider = await this.getProvider()
    return await provider.getLabels()
  }

  /**
   * Ensure a label exists
   */
  async ensureLabelExists(labelName: string): Promise<string | null> {
    const provider = await this.getProvider()
    return await provider.ensureLabelExists(labelName)
  }

  /**
   * Delete a label
   */
  async deleteLabel(labelId: string): Promise<void> {
    const provider = await this.getProvider()
    return await provider.deleteLabel(labelId)
  }

  /**
   * Check if authentication is valid
   */
  async checkAuthentication(): Promise<void> {
    const provider = await this.getProvider()
    return await provider.checkAuthentication()
  }

  /**
   * Get current provider type
   */
  async getProviderType(): Promise<'gmail' | 'outlook'> {
    await this.getProvider()
    return this.providerType!
  }
}

// Export singleton instance
export const emailService = new EmailService()
