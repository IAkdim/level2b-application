// Supabase Edge Function: calendly-oauth-callback
// Handles the OAuth callback from Calendly and stores tokens in user_settings

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CALENDLY_CLIENT_ID = Deno.env.get('CALENDLY_CLIENT_ID')
const CALENDLY_CLIENT_SECRET = Deno.env.get('CALENDLY_CLIENT_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface StateData {
  userId: string
  redirectUrl: string
}

function parseState(state: string): StateData {
  try {
    const decoded = atob(state)
    return JSON.parse(decoded)
  } catch {
    // Fallback for old format (just userId)
    return { userId: state, redirectUrl: 'http://localhost:5173' }
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Default redirect URL in case of early errors
  let appUrl = 'http://localhost:5173'

  try {
    console.log('Calendly OAuth callback invoked')

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Parse state to get userId and redirectUrl
    if (state) {
      const stateData = parseState(state)
      appUrl = stateData.redirectUrl.replace(/\/$/, '')
    }

    if (error) {
      console.error('OAuth error:', error)
      return Response.redirect(`${appUrl}/configuration?calendly_error=${error}`, 302)
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter')
    }

    const { userId } = parseState(state)

    if (!CALENDLY_CLIENT_ID || !CALENDLY_CLIENT_SECRET) {
      throw new Error('Calendly OAuth credentials not configured')
    }

    // Exchange authorization code for access token
    // MUST match the redirect_uri used in the authorization request
    const supabaseUrl = SUPABASE_URL.replace(/\/$/, '') // Remove trailing slash if present
    const redirectUri = `${supabaseUrl}/functions/v1/calendly-oauth-callback`
    
    console.log('Exchanging code for token with redirect_uri:', redirectUri)
    const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CALENDLY_CLIENT_ID,
        client_secret: CALENDLY_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      throw new Error(`Failed to exchange code for token: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token received successfully')

    // Get user info from Calendly
    console.log('Fetching Calendly user info...')
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('Failed to fetch user info:', errorText)
      throw new Error(`Failed to fetch user info: ${errorText}`)
    }

    const userData = await userResponse.json()
    const calendlyUserUri = userData.resource.uri
    console.log('Calendly user URI:', calendlyUserUri)

    // Get the first event type to use as the scheduling URL
    console.log('Fetching Calendly event types...')
    const eventTypesResponse = await fetch('https://api.calendly.com/event_types?user=' + encodeURIComponent(calendlyUserUri), {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    let schedulingUrl = ''
    let eventTypeUri = ''
    let eventTypeName = ''

    if (eventTypesResponse.ok) {
      const eventTypesData = await eventTypesResponse.json()
      if (eventTypesData.collection && eventTypesData.collection.length > 0) {
        const firstEventType = eventTypesData.collection[0]
        schedulingUrl = firstEventType.scheduling_url || ''
        eventTypeUri = firstEventType.uri || ''
        eventTypeName = firstEventType.name || ''
        console.log('Found event type:', eventTypeName, schedulingUrl)
      }
    }

    // Store tokens in user_settings using service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check if user_settings exist for this user
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .single()

    const calendlyData = {
      calendly_access_token: tokenData.access_token,
      calendly_refresh_token: tokenData.refresh_token,
      calendly_scheduling_url: schedulingUrl,
      calendly_event_type_uri: eventTypeUri,
      calendly_event_type_name: eventTypeName,
      updated_at: new Date().toISOString(),
    }

    console.log('Saving Calendly data to user_settings for user:', userId)

    if (existingSettings) {
      // Update existing settings
      const { error: updateError } = await supabase
        .from('user_settings')
        .update(calendlyData)
        .eq('user_id', userId)

      if (updateError) {
        console.error('Failed to update user_settings:', updateError)
        throw updateError
      }
      console.log('Updated existing user_settings')
    } else {
      // Create new user_settings
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          ...calendlyData,
        })

      if (insertError) {
        console.error('Failed to insert user_settings:', insertError)
        throw insertError
      }
      console.log('Created new user_settings')
    }

    console.log('Tokens stored successfully in user_settings')

    // Redirect back to app with success
    return Response.redirect(`${appUrl}/configuration?calendly_connected=true`, 302)

  } catch (error) {
    console.error('Error in calendly-oauth-callback:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return Response.redirect(`${appUrl}/configuration?calendly_error=${encodeURIComponent(errorMessage)}`, 302)
  }
})
