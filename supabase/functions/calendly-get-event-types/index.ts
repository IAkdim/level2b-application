// Supabase Edge Function: calendly-get-event-types
// Fetches available event types (scheduling links) from Calendly for the current user

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface EventType {
  uri: string
  name: string
  scheduling_url: string
  duration: number
  active: boolean
  description_plain?: string
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
    console.log('Get Calendly event types function invoked')

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create client with user's JWT to verify authentication
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    
    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    // Get user settings with Calendly token using service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('calendly_access_token')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings) {
      // No settings yet, return empty array (not an error)
      console.log('No user settings found, returning empty event types')
      return new Response(
        JSON.stringify({ eventTypes: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!settings.calendly_access_token) {
      // Calendly not connected, return empty array
      console.log('Calendly not connected, returning empty event types')
      return new Response(
        JSON.stringify({ eventTypes: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // First get the user's URI from Calendly
    console.log('Fetching Calendly user info...')
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${settings.calendly_access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        throw new Error('Calendly token expired. Please reconnect.')
      }
      throw new Error('Failed to fetch Calendly user info')
    }

    const userData = await userResponse.json()
    const calendlyUserUri = userData.resource.uri

    // Fetch event types from Calendly
    console.log('Fetching event types from Calendly...')
    const eventTypesUrl = `https://api.calendly.com/event_types?user=${encodeURIComponent(calendlyUserUri)}&active=true`
    
    const response = await fetch(eventTypesUrl, {
      headers: {
        'Authorization': `Bearer ${settings.calendly_access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to fetch event types:', errorText)
      
      if (response.status === 401) {
        throw new Error('Calendly token expired. Please reconnect.')
      }
      
      throw new Error(`Failed to fetch event types: ${errorText}`)
    }

    const data = await response.json()
    
    // Transform event types to simpler format
    const eventTypes: EventType[] = data.collection.map((et: any) => ({
      uri: et.uri,
      name: et.name,
      scheduling_url: et.scheduling_url,
      duration: et.duration,
      active: et.active,
      description_plain: et.description_plain,
    }))

    console.log(`Found ${eventTypes.length} event types`)

    return new Response(
      JSON.stringify({ eventTypes }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in calendly-get-event-types:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(
      JSON.stringify({ error: errorMessage, eventTypes: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
