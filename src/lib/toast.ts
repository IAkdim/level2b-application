import { toast as sonnerToast } from "sonner"
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react"

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

interface ToastOptions {
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2
}

const colors = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
  loading: 'text-primary animate-spin'
}

/**
 * Consistent toast notifications for the application
 * 
 * Usage:
 * - toast.success('Lead added successfully')
 * - toast.error('Failed to delete lead', { description: 'Please try again' })
 * - toast.warning('Daily limit almost reached')
 * - toast.info('Tip: Use ⌘K to quickly navigate')
 * - const id = toast.loading('Sending emails...'); toast.dismiss(id)
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined
    })
  },

  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration ?? 6000, // Errors stay longer
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined
    })
  },

  warning: (message: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration ?? 5000,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined
    })
  },

  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick
      } : undefined
    })
  },

  loading: (message: string, options?: Omit<ToastOptions, 'duration'>) => {
    return sonnerToast.loading(message, {
      description: options?.description
    })
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId)
  },

  // Common workflow-specific toasts
  workflow: {
    templateCreated: () => toast.success('Template created!', {
      description: 'Next step: Add leads to start your outreach'
    }),
    
    leadsAdded: (count: number) => toast.success(`${count} lead${count !== 1 ? 's' : ''} added!`, {
      description: 'Ready to send emails'
    }),
    
    emailSent: () => toast.success('Email sent successfully!', {
      description: 'Track responses in Email Threads'
    }),
    
    emailsSent: (count: number) => toast.success(`${count} email${count !== 1 ? 's' : ''} sent!`, {
      description: 'Track responses in Email Threads'
    }),
    
    limitReached: (resetTime: string) => toast.warning('Daily limit reached', {
      description: `Resets in ${resetTime}`
    }),
    
    limitAlmostReached: (remaining: number) => toast.warning(`Only ${remaining} email${remaining !== 1 ? 's' : ''} left today`, {
      description: 'Use them wisely'
    }),
    
    connectionSuccess: (service: string) => toast.success(`${service} connected!`, {
      description: 'Your account is now linked'
    }),
    
    connectionError: (service: string) => toast.error(`Failed to connect ${service}`, {
      description: 'Please try again'
    })
  }
}

export default toast
