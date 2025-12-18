// Supabase Edge Function: calendly-sync-meetings
// Fetches scheduled events from Calendly API and syncs to database

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Calendly sync meetings function invoked')

    const { orgId } = await req.json()
    
    if (!orgId) {
      throw new Error('orgId is required')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get organization settings with Calendly token
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

    // Fetch scheduled events from Calendly
    // Get events from last 30 days and next 90 days
    const minStartTime = new Date()
    minStartTime.setDate(minStartTime.getDate() - 30)
    
    const maxStartTime = new Date()
    maxStartTime.setDate(maxStartTime.getDate() + 90)

    console.log('Fetching scheduled events from Calendly...')
    const eventsUrl = new URL('https://api.calendly.com/scheduled_events')
    eventsUrl.searchParams.set('user', settings.calendly_user_uri)
    eventsUrl.searchParams.set('min_start_time', minStartTime.toISOString())
    eventsUrl.searchParams.set('max_start_time', maxStartTime.toISOString())
    eventsUrl.searchParams.set('count', '100')
    eventsUrl.searchParams.set('status', 'active')

    const response = await fetch(eventsUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${settings.calendly_access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to fetch events:', errorText)
      
      if (response.status === 401) {
        throw new Error('Calendly token expired. Please reconnect.')
      }
      
      throw new Error(`Failed to fetch events: ${errorText}`)
    }

    const eventsData = await response.json()
    const events = eventsData.collection || []
    
    console.log(`Found ${events.length} events`)

    let syncedCount = 0
    let skippedCount = 0

    // Process each event
    for (const event of events) {
      try {
        console.log('Processing event:', event.name, 'URI:', event.uri)
        
        // Check if event already exists
        const { data: existingMeeting } = await supabase
          .from('calendly_meetings')
          .select('id')
          .eq('calendly_uri', event.uri)
          .single()

        if (existingMeeting) {
          console.log('Meeting already exists:', event.uri)
          skippedCount++
          continue
        }

        console.log('Fetching invitees for event:', event.uri)
        
        // Fetch invitees for this event
        const inviteesResponse = await fetch(`${event.uri}/invitees`, {
          headers: {
            'Authorization': `Bearer ${settings.calendly_access_token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!inviteesResponse.ok) {
          const errorText = await inviteesResponse.text()
          console.error('Failed to fetch invitees for event:', event.uri, 'Status:', inviteesResponse.status, 'Error:', errorText)
          continue
        }

        const inviteesData = await inviteesResponse.json()
        const invitees = inviteesData.collection || []

        console.log('Found', invitees.length, 'invitees for event:', event.name)

        if (invitees.length === 0) {
          console.log('No invitees found for event, skipping:', event.uri)
          continue
        }

        // Use first invitee (typically there's only one for 1-on-1 meetings)
        const invitee = invitees[0]
        
        console.log('Creating meeting for invitee:', invitee.name, 'Email:', invitee.email)

        // Calculate duration
        const startTime = new Date(event.start_time)
        const endTime = new Date(event.end_time)
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

        // Try to find matching lead by email
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('org_id', orgId)
          .ilike('email', invitee.email)
          .single()

        console.log('Lead lookup for email', invitee.email, ':', lead ? `Found (${lead.id})` : 'Not found')

        // Determine status based on event status and time
        let meetingStatus = 'scheduled'
        if (event.status === 'canceled') {
          meetingStatus = 'canceled'
        } else if (endTime < new Date()) {
          meetingStatus = 'completed'
        }

        console.log('Inserting meeting into database...')
        
        // Create meeting record
        const { error: insertError } = await supabase
          .from('calendly_meetings')
          .insert({
            org_id: orgId,
            lead_id: lead?.id || null,
            calendly_event_id: event.uri.split('/').pop(),
            calendly_uri: event.uri,
            event_type_name: event.event_type ? event.event_type.split('/').pop() : event.name,
            event_type_uri: event.event_type || '',
            name: event.name,
            email: invitee.email,
            status: event.status === 'canceled' ? 'canceled' : 'active',
            start_time: event.start_time,
            end_time: event.end_time,
            location: event.location?.join_url || event.location?.type || 'Online',
            invitee_name: invitee.name,
            invitee_email: invitee.email,
            invitee_timezone: invitee.timezone,
            cancel_reason: invitee.cancel_reason || null,
            cancellation_reason: invitee.cancellation_reason || null,
            rescheduled: invitee.rescheduled || false,
            questions_and_answers: invitee.questions_and_answers || [],
            tracking: invitee.tracking || {},
            metadata: {
              calendly_event_type: event.event_type,
              calendly_invitee_uri: invitee.uri,
              calendly_cancel_url: invitee.cancel_url,
              calendly_reschedule_url: invitee.reschedule_url,
              event_status: event.status,
            },
          })

        if (insertError) {
          console.error('Failed to insert meeting:', insertError.message, 'Details:', insertError)
          continue
        }

        console.log('✓ Meeting synced successfully:', event.name)
        syncedCount++

        // Update lead status if found and meeting is upcoming
        if (lead?.id && meetingStatus === 'scheduled') {
          await supabase
            .from('leads')
            .update({
              status: 'meeting_scheduled',
              last_contact_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
        }

      } catch (eventError) {
        console.error('Error processing event:', eventError)
        continue
      }
    }

    console.log(`Sync complete: ${syncedCount} new meetings, ${skippedCount} skipped (already exist)`)

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        skipped: skippedCount,
        total: events.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in calendly-sync-meetings:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(
      JSON.stringify({ error: errorMessage, synced: 0, skipped: 0, total: 0 }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
