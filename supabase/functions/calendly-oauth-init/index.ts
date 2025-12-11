// Supabase Edge Function: calendly-oauth-init
// Generates the Calendly OAuth authorization URL

const CALENDLY_CLIENT_ID = Deno.env.get('CALENDLY_CLIENT_ID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

interface InitOAuthRequest {
  orgId: string
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

    if (!CALENDLY_CLIENT_ID) {
      throw new Error('CALENDLY_CLIENT_ID not configured')
    }

    if (!SUPABASE_URL) {
      throw new Error('SUPABASE_URL not configured')
    }

    const { orgId }: InitOAuthRequest = await req.json()
    
    if (!orgId) {
      throw new Error('orgId is required')
    }
    
    // Construct redirect URI - must match EXACTLY what's configured in Calendly OAuth app
    const supabaseUrl = SUPABASE_URL.replace(/\/$/, '') // Remove trailing slash if present
    const redirectUri = `${supabaseUrl}/functions/v1/calendly-oauth-callback`
    
    // Build OAuth URL
    const authUrl = new URL('https://auth.calendly.com/oauth/authorize')
    authUrl.searchParams.set('client_id', CALENDLY_CLIENT_ID)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', orgId) // Use orgId as state to track which org is connecting
    
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
