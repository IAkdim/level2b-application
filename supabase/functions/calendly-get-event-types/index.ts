// Supabase Edge Function: calendly-get-event-types
// Fetches available event types (scheduling links) from Calendly

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

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { orgId } = await req.json()
    
    if (!orgId) {
      throw new Error('orgId is required')
    }

    // Get organization settings with Calendly token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: settings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('calendly_access_token, calendly_user_uri')
      .eq('org_id', orgId)
      .single()

    if (settingsError || !settings) {
      throw new Error('Organization settings not found')
    }

    if (!settings.calendly_access_token || !settings.calendly_user_uri) {
      throw new Error('Calendly not connected for this organization')
    }

    // Fetch event types from Calendly
    console.log('Fetching event types from Calendly...')
    const eventTypesUrl = `https://api.calendly.com/event_types?user=${settings.calendly_user_uri}&active=true`
    
    const response = await fetch(eventTypesUrl, {
      headers: {
        'Authorization': `Bearer ${settings.calendly_access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to fetch event types:', errorText)
      
      // If token expired, return specific error
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
