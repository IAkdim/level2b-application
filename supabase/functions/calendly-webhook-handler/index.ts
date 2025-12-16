// Supabase Edge Function: calendly-webhook-handler
// Receives Calendly webhooks and syncs meetings to database

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const CALENDLY_WEBHOOK_SIGNING_KEY = Deno.env.get('CALENDLY_WEBHOOK_SIGNING_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface CalendlyWebhookPayload {
  event: string // e.g., "invitee.created", "invitee.canceled"
  payload: {
    event: string // Event URI
    invitee: string // Invitee URI
  }
  time: string
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'calendly-webhook-signature, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Calendly webhook received')

    // Verify webhook signature
    const signature = req.headers.get('Calendly-Webhook-Signature')
    const body = await req.text()
    
    if (CALENDLY_WEBHOOK_SIGNING_KEY && signature) {
      const hmac = createHmac('sha256', CALENDLY_WEBHOOK_SIGNING_KEY)
      hmac.update(body)
      const expectedSignature = hmac.digest('base64')
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature')
        return new Response('Invalid signature', { status: 401 })
      }
      console.log('Webhook signature verified')
    }

    const webhookData: CalendlyWebhookPayload = JSON.parse(body)
    console.log('Webhook event:', webhookData.event)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Handle different event types
    if (webhookData.event === 'invitee.created') {
      await handleInviteeCreated(supabase, webhookData)
    } else if (webhookData.event === 'invitee.canceled') {
      await handleInviteeCanceled(supabase, webhookData)
    } else {
      console.log('Unhandled event type:', webhookData.event)
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in calendly-webhook-handler:', error)
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

async function handleInviteeCreated(supabase: any, webhookData: CalendlyWebhookPayload) {
  console.log('Handling invitee.created event')
  
  // We need to fetch the full event and invitee details
  // But we need an access token. We'll get it from the first org that has Calendly connected
  // In production, you might want to store org_id in webhook subscription metadata
  
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('org_id, calendly_access_token')
    .not('calendly_access_token', 'is', null)
    .limit(1)
    .single()

  if (!settings || !settings.calendly_access_token) {
    console.error('No Calendly access token found')
    return
  }

  // Fetch event details
  const eventResponse = await fetch(webhookData.payload.event, {
    headers: {
      'Authorization': `Bearer ${settings.calendly_access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!eventResponse.ok) {
    console.error('Failed to fetch event details')
    return
  }

  const eventData = await eventResponse.json()
  const event = eventData.resource

  // Fetch invitee details
  const inviteeResponse = await fetch(webhookData.payload.invitee, {
    headers: {
      'Authorization': `Bearer ${settings.calendly_access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!inviteeResponse.ok) {
    console.error('Failed to fetch invitee details')
    return
  }

  const inviteeData = await inviteeResponse.json()
  const invitee = inviteeData.resource

  console.log('Event details:', {
    name: event.name,
    start_time: event.start_time,
    end_time: event.end_time,
    invitee_email: invitee.email,
  })

  // Calculate duration
  const startTime = new Date(event.start_time)
  const endTime = new Date(event.end_time)
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  // Try to find matching lead by email
  const { data: lead } = await supabase
    .from('leads')
    .select('id, org_id')
    .eq('org_id', settings.org_id)
    .ilike('email', invitee.email)
    .single()

  const leadId = lead?.id || null
  const orgId = lead?.org_id || settings.org_id

  // Check if meeting already exists
  const { data: existingMeeting } = await supabase
    .from('meetings')
    .select('id')
    .eq('calendly_event_uri', event.uri)
    .single()

  if (existingMeeting) {
    console.log('Meeting already exists, skipping')
    return
  }

  // Create meeting record
  const { error: insertError } = await supabase
    .from('meetings')
    .insert({
      org_id: orgId,
      lead_id: leadId,
      title: event.name,
      scheduled_at: event.start_time,
      end_time: event.end_time,
      duration_minutes: durationMinutes,
      location: event.location?.type || 'Online',
      meeting_url: event.location?.join_url || invitee.scheduling_url,
      status: 'scheduled',
      calendly_event_uri: event.uri,
      calendly_invitee_uri: invitee.uri,
      calendly_cancel_url: invitee.cancel_url,
      calendly_reschedule_url: invitee.reschedule_url,
      attendee_name: invitee.name,
      attendee_email: invitee.email,
      attendee_timezone: invitee.timezone,
      metadata: {
        calendly_event_type: event.event_type,
        questions_and_answers: invitee.questions_and_answers || [],
      },
    })

  if (insertError) {
    console.error('Failed to insert meeting:', insertError)
    throw insertError
  }

  console.log('Meeting created successfully')

  // Update lead status if found
  if (leadId) {
    await supabase
      .from('leads')
      .update({
        status: 'meeting_scheduled',
        last_contact_at: new Date().toISOString(),
      })
      .eq('id', leadId)
    
    console.log('Lead status updated to meeting_scheduled')
  }
}

async function handleInviteeCanceled(supabase: any, webhookData: CalendlyWebhookPayload) {
  console.log('Handling invitee.canceled event')

  // Find meeting by event URI
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, lead_id')
    .eq('calendly_event_uri', webhookData.payload.event)
    .single()

  if (!meeting) {
    console.log('Meeting not found for canceled event')
    return
  }

  // Update meeting status
  const { error: updateError } = await supabase
    .from('meetings')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      cancel_reason: 'Canceled via Calendly',
    })
    .eq('id', meeting.id)

  if (updateError) {
    console.error('Failed to update meeting:', updateError)
    throw updateError
  }

  console.log('Meeting marked as canceled')

  // Update lead status back to 'replied' if meeting was scheduled
  if (meeting.lead_id) {
    await supabase
      .from('leads')
      .update({
        status: 'replied',
      })
      .eq('id', meeting.lead_id)
    
    console.log('Lead status updated back to replied')
  }
}
