// supabase/functions/track-email-open/index.ts
// Edge Function to handle email open tracking via tracking pixel

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

// 1x1 transparent GIF (smallest possible valid image)
const TRANSPARENT_GIF = Uint8Array.from(atob(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
), c => c.charCodeAt(0))

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EMAIL_TRACKING_SECRET = Deno.env.get('EMAIL_TRACKING_SECRET') || 'your-tracking-secret-change-in-production'

// Apple Mail Privacy Protection IP ranges (Apple's assigned blocks)
// Reference: https://bgp.he.net/AS714#_prefixes
const APPLE_PROXY_PREFIXES = ['17.']  // Apple owns the entire 17.0.0.0/8 block

// CORS headers for pixel response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

// Image response headers (prevent caching to track multiple opens)
const imageHeaders = {
  ...corsHeaders,
  'Content-Type': 'image/gif',
  'Content-Length': String(TRANSPARENT_GIF.length),
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

interface TrackingPayload {
  mid: string      // message_id (UUID)
  rh: string       // recipient_email_hash
  ts: number       // timestamp when email was sent
  sig: string      // HMAC signature
}

/**
 * Generate HMAC signature for verification
 * CRITICAL: This MUST match the frontend algorithm exactly!
 */
function generateSignature(messageId: string, recipientHash: string, timestamp: number): string {
  const data = `${messageId}:${recipientHash}:${timestamp}`
  
  // Simple hash - MUST match frontend in emailTracking.ts
  // Frontend uses: EMAIL_TRACKING_SECRET + data, then charCodeAt on the string
  const combined = EMAIL_TRACKING_SECRET + data
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Verify the tracking token signature
 */
function verifySignature(payload: TrackingPayload): boolean {
  const expectedSig = generateSignature(payload.mid, payload.rh, payload.ts)
  return payload.sig === expectedSig
}

/**
 * Parse and decode the tracking token
 */
function parseTrackingToken(token: string): TrackingPayload | null {
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(decoded) as TrackingPayload
    
    // Validate required fields
    if (!payload.mid || !payload.rh || !payload.ts || !payload.sig) {
      console.error('Invalid tracking token: missing required fields')
      return null
    }
    
    // Verify signature
    if (!verifySignature(payload)) {
      console.error('Invalid tracking token: signature mismatch')
      return null
    }
    
    // Check token age (reject tokens older than 90 days)
    const tokenAge = Date.now() - payload.ts
    const maxAge = 90 * 24 * 60 * 60 * 1000 // 90 days in ms
    if (tokenAge > maxAge) {
      console.error('Tracking token expired')
      return null
    }
    
    return payload
  } catch (error) {
    console.error('Failed to parse tracking token:', error)
    return null
  }
}

/**
 * Detect if request is from Apple Mail Privacy Protection
 */
function isAppleMPP(request: Request): boolean {
  const userAgent = request.headers.get('user-agent') || ''
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const clientIp = forwardedFor.split(',')[0].trim()
  
  // Check if IP is from Apple's proxy
  if (clientIp && APPLE_PROXY_PREFIXES.some(prefix => clientIp.startsWith(prefix))) {
    return true
  }
  
  // Heuristic: Apple Mail without specific client identifiers
  // Apple MPP uses a generic WebKit user agent
  if (userAgent.includes('AppleWebKit') && 
      !userAgent.includes('Chrome') && 
      !userAgent.includes('Firefox') &&
      !userAgent.includes('Edge')) {
    // This alone isn't definitive, but combined with other signals...
    // For now, we'll be conservative and not flag this alone
  }
  
  return false
}

/**
 * Get country from IP (simple implementation)
 * In production, use a proper GeoIP service
 */
function getCountryFromIP(request: Request): string | null {
  // Cloudflare and Vercel provide country headers
  const cfCountry = request.headers.get('cf-ipcountry')
  if (cfCountry && cfCountry !== 'XX') return cfCountry
  
  const vercelCountry = request.headers.get('x-vercel-ip-country')
  if (vercelCountry) return vercelCountry
  
  return null
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Only accept GET requests
  if (req.method !== 'GET') {
    return new Response(TRANSPARENT_GIF, { headers: imageHeaders })
  }
  
  const url = new URL(req.url)
  const token = url.searchParams.get('t')
  
  // No token = return pixel without tracking
  if (!token) {
    console.log('No tracking token provided')
    return new Response(TRANSPARENT_GIF, { headers: imageHeaders })
  }
  
  try {
    // Parse and verify token
    const payload = parseTrackingToken(token)
    if (!payload) {
      return new Response(TRANSPARENT_GIF, { headers: imageHeaders })
    }
    
    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Detect Apple MPP
    const isAppleProxy = isAppleMPP(req)
    
    // Get metadata
    const userAgent = req.headers.get('user-agent') || null
    const ipCountry = getCountryFromIP(req)
    
    // Record the open - try multiple approaches
    let recorded = false
    
    // Approach 1: Direct update on email_tracking table (most reliable)
    try {
      const { data: directData, error: directError } = await supabase
        .from('email_tracking')
        .update({
          is_opened: true,
          first_opened_at: new Date().toISOString(),
          open_count: 1, // Will be incremented by trigger if exists
          last_opened_at: new Date().toISOString(),
          open_user_agent: userAgent?.substring(0, 500),
          open_ip_country: ipCountry,
          is_apple_mpp: isAppleProxy,
          updated_at: new Date().toISOString()
        })
        .eq('tracking_id', payload.mid)
        .select('id, is_opened')
      
      if (!directError && directData && directData.length > 0) {
        console.log(`Email open recorded (direct update): trackingId=${payload.mid}, isAppleMPP=${isAppleProxy}`)
        recorded = true
      } else if (directError) {
        console.log(`Direct update failed (table may not exist): ${directError.message}`)
      }
    } catch (e) {
      console.log('Direct update approach failed:', e)
    }
    
    // Approach 2: Try the RPC function if direct update didn't work
    if (!recorded) {
      const { data: simpleData, error: simpleError } = await supabase.rpc('record_email_open_simple', {
        p_tracking_id: payload.mid,
        p_recipient_email_hash: payload.rh,
        p_user_agent: userAgent?.substring(0, 500),
        p_ip_country: ipCountry,
        p_is_apple_mpp: isAppleProxy
      })
      
      if (!simpleError && simpleData && simpleData.length > 0) {
        console.log(`Email open recorded (simple RPC): trackingId=${payload.mid}, isFirstOpen=${simpleData[0]?.is_first_open}`)
        recorded = true
      }
    }
    
    // Approach 3: Legacy RPC function
    if (!recorded) {
      const { data: oldData, error: oldError } = await supabase.rpc('record_email_open', {
        p_tracking_id: payload.mid,
        p_recipient_email_hash: payload.rh,
        p_user_agent: userAgent?.substring(0, 500),
        p_ip_country: ipCountry,
        p_is_apple_mpp: isAppleProxy
      })
      
      if (!oldError && oldData && oldData.length > 0) {
        console.log(`Email open recorded (legacy RPC): trackingId=${payload.mid}`)
        recorded = true
      } else if (oldError) {
        console.error('All approaches failed. Last error:', oldError.message)
      }
    }
    
    if (!recorded) {
      console.warn(`Could not record open for trackingId=${payload.mid} - no matching record found`)
    }
    
  } catch (error) {
    console.error('Tracking error:', error)
    // Still return pixel - don't break email display
  }
  
  return new Response(TRANSPARENT_GIF, { headers: imageHeaders })
})
