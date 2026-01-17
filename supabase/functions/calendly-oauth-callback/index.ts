// Supabase Edge Function: calendly-oauth-callback
// Handles the OAuth callback from Calendly and stores tokens
//
// ⚠️  DEPRECATED: This function requires organization support which has been removed.
// This function is kept for reference but will not work without organizations.
// To re-enable, you would need to:
// 1. Restore organization tables in the database
// 2. Update to work with user-based approach instead of org-based

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CALENDLY_CLIENT_ID = Deno.env.get('CALENDLY_CLIENT_ID')
const CALENDLY_CLIENT_SECRET = Deno.env.get('CALENDLY_CLIENT_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:5173'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Calendly OAuth callback invoked')

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // This is the orgId
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      // Redirect to app with error
      const appUrl = APP_URL.replace(/\/$/, '') // Remove trailing slash if present
      return Response.redirect(`${appUrl}/configuration?calendly_error=${error}`, 302)
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter')
    }

    const orgId = state

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

    // Calculate token expiration
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

    // Store tokens in database using service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check if settings exist
    const { data: existingSettings } = await supabase
      .from('organization_settings')
      .select('id')
      .eq('org_id', orgId)
      .single()

    if (existingSettings) {
      // Update existing settings
      const { error: updateError } = await supabase
        .from('organization_settings')
        .update({
          calendly_access_token: tokenData.access_token,
          calendly_refresh_token: tokenData.refresh_token,
          calendly_token_expires_at: expiresAt.toISOString(),
          calendly_user_uri: calendlyUserUri,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)

      if (updateError) {
        console.error('Failed to update settings:', updateError)
        throw updateError
      }
    } else {
      // Create new settings
      const { error: insertError } = await supabase
        .from('organization_settings')
        .insert({
          org_id: orgId,
          calendly_access_token: tokenData.access_token,
          calendly_refresh_token: tokenData.refresh_token,
          calendly_token_expires_at: expiresAt.toISOString(),
          calendly_user_uri: calendlyUserUri,
        })

      if (insertError) {
        console.error('Failed to insert settings:', insertError)
        throw insertError
      }
    }

    console.log('Tokens stored successfully')

    // Redirect back to app with success
    const appUrl = APP_URL.replace(/\/$/, '') // Remove trailing slash if present
    return Response.redirect(`${appUrl}/configuration?calendly_connected=true&tab=company`, 302)

  } catch (error) {
    console.error('Error in calendly-oauth-callback:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const appUrl = APP_URL.replace(/\/$/, '') // Remove trailing slash if present
    
    return Response.redirect(`${appUrl}/configuration?calendly_error=${encodeURIComponent(errorMessage)}`, 302)
  }
})
