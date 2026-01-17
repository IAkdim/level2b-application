// API functions for notifications
import { supabase } from '../supabaseClient'

export interface Notification {
  id: string
  user_id: string
  type: 'meeting_scheduled' | 'meeting_canceled' | 'email_received' | 'email_bounced' | 'lead_status_changed' | 'campaign_completed' | 'daily_limit_warning' | 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  action_url: string | null
  metadata: Record<string, any>
  created_at: string
}

/**
 * Get all notifications for the current user
 */
export async function getNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching notifications:', error)
    throw error
  }

  return data || []
}

/**
 * Get unread notifications count
 */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false)

  if (error) {
    console.error('Error fetching unread count:', error)
    throw error
  }

  return count || 0
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)

  if (error) {
    console.error('Error marking notification as read:', error)
    throw error
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase.rpc('mark_all_notifications_read', {
    p_user_id: user.id
  })

  if (error) {
    console.error('Error marking all notifications as read:', error)
    throw error
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) {
    console.error('Error deleting notification:', error)
    throw error
  }
}

/**
 * Create a notification (typically used by system/admin)
 */
export async function createNotification(notification: {
  type: Notification['type']
  title: string
  message: string
  action_url?: string
  metadata?: Record<string, any>
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      ...notification,
      metadata: notification.metadata || {}
    })

  if (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

/**
 * Subscribe to real-time notification changes
 */
export function subscribeToNotifications(
  callback: (notification: Notification) => void
) {
  return supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      (payload) => {
        callback(payload.new as Notification)
      }
    )
    .subscribe()
}
