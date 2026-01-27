/**
 * Email API - Public exports
 * 
 * Usage:
 *   import { emailService } from '@/lib/api/email'
 *   
 *   // Send email
 *   await emailService.sendEmail({ to: '...', subject: '...', body: '...' })
 *   
 *   // Get emails
 *   const emails = await emailService.getEmailsByLabel('MyLabel')
 */

// Main service facade (use this in components)
export { emailService } from './emailService'

// Types
export type {
  Email,
  SendEmailRequest,
  SendEmailResult,
  EmailThread,
  Label,
  EmailTrackingMetadata
} from './types'

// Email tracking CRUD (if needed directly)
export {
  saveEmailTracking,
  getTrackedEmails,
  getTrackedEmailByMessageId,
  getTrackedEmailsByThreadId,
  deleteEmailTracking
} from './emailTracking'

// Provider interface (for extending with new providers)
export type { IEmailProvider } from './emailProvider'
