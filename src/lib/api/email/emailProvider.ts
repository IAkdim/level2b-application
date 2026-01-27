/**
 * Email provider abstraction interface
 * Implementations: Gmail, Outlook (future)
 */

import type {
  Email,
  SendEmailRequest,
  SendEmailResult,
  EmailThread,
  Label
} from './types'

export interface IEmailProvider {
  /**
   * Get provider name
   */
  getProviderName(): 'gmail' | 'outlook'

  /**
   * Send a single email
   */
  sendEmail(request: SendEmailRequest): Promise<SendEmailResult>

  /**
   * Send multiple emails in batch
   */
  sendBatchEmails(
    requests: SendEmailRequest[],
    onProgress?: (current: number, total: number, success: number, failed: number) => void
  ): Promise<SendEmailResult[]>

  /**
   * Get emails by label/category (on-demand fetch, not from DB)
   */
  getEmailsByLabel(labelName: string, maxResults?: number): Promise<Email[]>

  /**
   * Get unread emails by label
   */
  getUnreadEmailsByLabel(
    labelName: string,
    maxResults?: number,
    markAsRead?: boolean
  ): Promise<Email[]>

  /**
   * Get email thread/conversation by ID (on-demand fetch)
   */
  getEmailThread(threadId: string): Promise<Email[]>

  /**
   * Get replies to emails with a specific label
   */
  getRepliesByLabel(
    labelName: string,
    onlyUnread?: boolean,
    analyzeSentiment?: boolean
  ): Promise<Email[]>

  /**
   * Get all available labels/categories
   */
  getLabels(): Promise<Label[]>

  /**
   * Ensure a label/category exists (create if needed)
   */
  ensureLabelExists(labelName: string): Promise<string | null>

  /**
   * Delete a label/category
   */
  deleteLabel(labelId: string): Promise<void>

  /**
   * Check if authentication is valid
   */
  checkAuthentication(): Promise<void>
}
