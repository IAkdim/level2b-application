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
import { saveEmailTracking, linkOpenTrackingToMetadata } from './emailTracking'

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
   * Coordinates both tracking systems: email_tracking_metadata + email_tracking
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResult> {
    const provider = await this.getProvider()

    // Send email via provider (gmail.ts will store open tracking in email_tracking table)
    const result = await provider.sendEmail(request)

    // Save correlation metadata to email_tracking_metadata (PRIMARY table)
    const metadata = await saveEmailTracking({
      threadId: result.threadId,
      messageId: result.messageId,
      provider: this.providerType!,
      campaignName: request.campaignName,
      leadId: request.leadId,
      sentAt: result.sentAt
    })

    // Link email_tracking record to email_tracking_metadata if both exist
    // Note: email_tracking only exists if open tracking was enabled in gmail.ts
    if (metadata?.id) {
      // Query email_tracking for this message (gmail.ts stores by gmail_message_id)
      const { data: openTracking } = await supabase
        .from('email_tracking')
        .select('tracking_id')
        .eq('gmail_message_id', result.messageId)
        .single()

      if (openTracking?.tracking_id) {
        // Link the two tables
        await linkOpenTrackingToMetadata(openTracking.tracking_id, metadata.id)
      }
    }

    return result
  }

  /**
   * Send multiple emails in batch and track them
   * Coordinates both tracking systems for all emails
   */
  async sendBatchEmails(
    requests: SendEmailRequest[],
    onProgress?: (current: number, total: number, success: number, failed: number) => void
  ): Promise<SendEmailResult[]> {
    const provider = await this.getProvider()

    // Send all emails via provider
    const results = await provider.sendBatchEmails(requests, onProgress)

    // Save all tracking metadata and link to open tracking
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const request = requests[i]

      // Save correlation metadata
      const metadata = await saveEmailTracking({
        threadId: result.threadId,
        messageId: result.messageId,
        provider: this.providerType!,
        campaignName: request.campaignName,
        leadId: request.leadId,
        sentAt: result.sentAt
      })

      // Link to open tracking if it exists
      if (metadata?.id) {
        const { data: openTracking } = await supabase
          .from('email_tracking')
          .select('tracking_id')
          .eq('gmail_message_id', result.messageId)
          .single()

        if (openTracking?.tracking_id) {
          await linkOpenTrackingToMetadata(openTracking.tracking_id, metadata.id)
        }
      }
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
   * Get multiple threads in batch (more efficient than calling getEmailThread repeatedly)
   * Returns a map of threadId -> Email[]
   */
  async getEmailThreadsBatch(threadIds: string[]): Promise<Map<string, Email[]>> {
    const provider = await this.getProvider()
    return await provider.getEmailThreadsBatch(threadIds)
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
