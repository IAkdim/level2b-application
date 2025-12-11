import { supabase } from './supabaseClient'

// Quick test function to create a notification
export async function createTestNotification() {
  try {
    // Get current user and org
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('No user logged in')
      return
    }

    const { data: userOrg } = await supabase
      .from('user_orgs')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (!userOrg) {
      console.error('No organization found')
      return
    }

    // Create notification
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        org_id: userOrg.org_id,
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
