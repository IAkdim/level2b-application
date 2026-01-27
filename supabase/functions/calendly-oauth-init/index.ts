// Supabase Edge Function: calendly-oauth-init
// Generates the Calendly OAuth authorization URL for user-based authentication

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CALENDLY_CLIENT_ID = Deno.env.get('CALENDLY_CLIENT_ID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

interface InitOAuthRequest {
  redirectUrl?: string
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Calendly OAuth init function invoked')

    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    console.log('Authenticated user:', user.id)

    // Get redirectUrl from request body
    const body: InitOAuthRequest = await req.json().catch(() => ({}))
    const redirectUrl = body.redirectUrl || 'http://localhost:5173'

    if (!CALENDLY_CLIENT_ID) {
      throw new Error('CALENDLY_CLIENT_ID not configured')
    }

    if (!SUPABASE_URL) {
      throw new Error('SUPABASE_URL not configured')
    }
    
    // Construct redirect URI - must match EXACTLY what's configured in Calendly OAuth app
    const supabaseUrl = SUPABASE_URL.replace(/\/$/, '') // Remove trailing slash if present
    const redirectUri = `${supabaseUrl}/functions/v1/calendly-oauth-callback`
    
    // Encode userId and redirectUrl in state (base64 encoded JSON)
    const stateData = JSON.stringify({ userId: user.id, redirectUrl })
    const state = btoa(stateData)
    
    // Build OAuth URL
    const authUrl = new URL('https://auth.calendly.com/oauth/authorize')
    authUrl.searchParams.set('client_id', CALENDLY_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    
    console.log('OAuth URL generated:', authUrl.toString())
    console.log('Redirect URI:', redirectUri)

    return new Response(
      JSON.stringify({
        authUrl: authUrl.toString(),
        redirectUri,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in calendly-oauth-init:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
