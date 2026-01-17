import { supabase } from './supabaseClient'

// Quick test function to create a notification
export async function createTestNotification() {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('No user logged in')
      return
    }

    // Create notification
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'info',
        title: 'Test via App',
        message: 'Deze notificatie is aangemaakt vanuit de app!',
        action_url: '/leads',
        metadata: { test: true }
      })
      .select()

    if (error) {
      console.error('Error creating notification:', error)
    } else {
      console.log('Notification created successfully:', data)
    }

    return data
  } catch (error) {
    console.error('Exception:', error)
  }
}
