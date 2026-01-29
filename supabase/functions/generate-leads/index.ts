/**
 * Lead Generation Edge Function v2.2
 * 
 * Google Maps Only - Production-ready implementation with:
 * - Email scraping from business websites (the main feature!)
 * - Retry logic with exponential backoff
 * - Duplicate detection before saving
 * - Business status filtering (excludes closed businesses)
 * - Comprehensive logging
 * - Optimized for Edge Function CPU limits
 * 
 * @version 2.2.0
 * @updated 2026-01-27
 */

import { serve } from "https://deno.land/std@0.220.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Timeouts - optimized for Edge Function CPU limits
  FUNCTION_TIMEOUT_MS: 50000,
  SCRAPE_TIMEOUT_MS: 3000,  // 3 seconds per website
  API_TIMEOUT_MS: 8000,
  
  // Retry settings
  MAX_RETRIES: 2,
  BASE_DELAY_MS: 500,
  RETRYABLE_STATUSES: ['OVER_QUERY_LIMIT', 'UNKNOWN_ERROR'],
  RETRYABLE_HTTP_CODES: [429, 500, 502, 503, 504],
  
  // Lead quality
  MIN_COMPANY_NAME_LENGTH: 2,
  
  // Email scraping paths to try (in order of priority)
  CONTACT_PATHS: ['', '/contact', '/kontakt', '/about', '/contact-us', '/contactus'],
  
  // Email blacklist patterns
  EMAIL_BLACKLIST: [
    'example.com', 'test.com', 'localhost', 'domain.com',
    'noreply', 'no-reply', 'donotreply', 'mailer-daemon',
    'postmaster', 'webmaster', 'hostmaster', 'support@google',
    'wixpress.com', 'squarespace.com', 'wordpress.com',
    'sentry.io', 'github.com', 'placeholder', '@sentry.',
    'schema.org', 'w3.org', 'facebook.com', 'twitter.com',
    'instagram.com', 'linkedin.com', 'privacy@', 'gdpr@',
    'abuse@', 'spam@', 'unsubscribe@', 'bounce@'
  ],
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =============================================================================
// TYPES
// =============================================================================

interface GenerateLeadsRequest {
  niche: string
  location: string
  maxLeads: number
}

interface Lead {
  company: string
  contact_name?: string
  email: string  // Required - the main point of lead generation
  phone?: string
  website?: string
  address?: string
  source: string
  place_id?: string
  business_status?: string
  quality_score?: number
}

interface PlaceResult {
  place_id: string
  name: string
  business_status?: string
  website?: string
  phone?: string
  address?: string
}

interface LogContext {
  [key: string]: unknown
}

// =============================================================================
// LOGGING
// =============================================================================

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: LogContext) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...context }
  console.log(JSON.stringify(entry))
}

// =============================================================================
// RETRY UTILITIES
// =============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = CONFIG.MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const errorMessage = (error as Error)?.message || String(error)
      
      const isRetryable = CONFIG.RETRYABLE_STATUSES.some(s => errorMessage.includes(s)) ||
        ((error as any)?.status && CONFIG.RETRYABLE_HTTP_CODES.includes((error as any).status))
      
      if (!isRetryable || attempt === maxRetries) {
        log('error', `${context} failed after ${attempt} attempts`, { error: errorMessage })
        throw error
      }
      
      const delay = CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500
      log('warn', `${context} failed, retrying in ${Math.round(delay)}ms`, { attempt, maxRetries, error: errorMessage })
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  throw lastError
}

async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = CONFIG.API_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key)
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let userId: string | undefined
  let supabaseAdmin: SupabaseClient | undefined

  // Function timeout protection
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Function timeout exceeded')), CONFIG.FUNCTION_TIMEOUT_MS)
  })

  try {
    const supabaseClient = createClient(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    supabaseAdmin = createClient(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    userId = user.id

    const body: GenerateLeadsRequest = await req.json()
    const { niche, location, maxLeads } = body

    // Input validation
    if (!niche?.trim()) throw new Error('Niche is required')
    if (!location?.trim()) throw new Error('Location is required')
    if (maxLeads < 1 || maxLeads > 100) throw new Error('maxLeads must be between 1 and 100')

    log('info', 'Starting lead generation', { niche, location, maxLeads, userId })

    // Rate limiting - check user's daily plan limits
    let rateLimit: any = null
    try {
      const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc(
        'get_hourly_rate_limit',
        { p_user_id: userId, p_org_id: null }
      )

      if (!rateLimitError && rateLimitData?.[0]) {
        rateLimit = rateLimitData[0]
        log('info', 'Rate limit status', { 
          dailyLimit: rateLimit.hourly_limit,
          leadsGenerated: rateLimit.leads_generated,
          remaining: rateLimit.limit_remaining 
        })

        if (rateLimit.hourly_limit === 0) {
          throw new Error(
            'Lead generation requires an active subscription. Please upgrade your plan to generate leads.'
          )
        }

        if (rateLimit.limit_remaining < 1) {
          throw new Error(
            `Daily limit reached. Your limit resets at midnight UTC.`
          )
        }
      }
    } catch (error) {
      // If rate limiting fails and it's a subscription error, rethrow
      const errMsg = (error as Error)?.message || ''
      if (errMsg.includes('subscription') || errMsg.includes('Daily limit')) {
        throw error
      }
      // Otherwise just log and continue (rate limiting is optional)
      log('warn', 'Rate limit check failed, continuing', { error: errMsg })
    }

    // Generate leads with timeout protection
    const generatePromise = (async () => {
      // Get places from Google Maps with details
      const places = await getPlacesWithDetails(niche, location, maxLeads * 3)  // Get more to filter down
      log('info', `Found ${places.length} places with websites`, { niche, location })

      // Scrape emails from websites (this is the key feature!)
      const leads = await scrapeEmailsFromPlaces(places, location, maxLeads)
      log('info', `Found ${leads.length} leads with emails`)

      // Deduplicate against existing leads
      const { unique, duplicates } = await findDuplicates(leads, userId!, supabaseClient)
      
      if (duplicates.length > 0) {
        log('info', `Filtered ${duplicates.length} duplicate leads`)
      }

      // Save
      const savedLeads = await saveLeadsToDatabase(supabaseClient, unique, userId!)
      return { savedLeads, totalFound: places.length, duplicatesFiltered: duplicates.length }
    })()

    const { savedLeads, totalFound, duplicatesFiltered } = await Promise.race([generatePromise, timeoutPromise])

    // Increment rate limit counter
    if (savedLeads.length > 0) {
      try {
        await supabaseAdmin.rpc('increment_rate_limit', {
          p_user_id: userId,
          p_org_id: null,
          p_leads_count: savedLeads.length
        })
      } catch (error) {
        log('warn', 'Failed to increment rate limit', { error: (error as Error)?.message })
      }
    }

    // Log API usage for analytics
    const duration = Date.now() - startTime
    try {
      await logApiUsage(supabaseAdmin, {
        userId, endpoint: 'generate-leads', method: 'google_maps', leadsRequested: maxLeads,
        leadsGenerated: savedLeads.length, success: true, durationMs: duration,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      })
    } catch (error) {
      log('warn', 'Failed to log API usage', { error: (error as Error)?.message })
    }

    log('info', 'Lead generation completed', { 
      leadsGenerated: savedLeads.length, totalFound, 
      duplicatesFiltered, duration_ms: duration 
    })

    return new Response(
      JSON.stringify({
        success: true,
        leadsGenerated: savedLeads.length,
        leads: savedLeads,
        meta: { totalFound, duplicatesFiltered, durationMs: duration }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const errorMessage = (error as Error)?.message || 'Unknown error'
    log('error', 'Lead generation failed', { error: errorMessage })

    if (userId && supabaseAdmin) {
      try {
        await logApiUsage(supabaseAdmin, {
          userId, endpoint: 'generate-leads', method: 'google_maps',
          leadsRequested: 0, leadsGenerated: 0, success: false, errorMessage,
          durationMs: Date.now() - startTime,
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        })
      } catch (logError) {
        log('error', 'Failed to log API usage', { error: (logError as Error)?.message })
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

// =============================================================================
// GOOGLE PLACES API
// =============================================================================

async function getPlacesWithDetails(niche: string, location: string, maxResults: number): Promise<PlaceResult[]> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
  
  if (!apiKey) {
    throw new Error('Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY in Supabase Edge Function secrets.')
  }

  const searchQuery = `${niche} in ${location}`
  
  // Using Places API (New) - Text Search endpoint
  const url = 'https://places.googleapis.com/v1/places:searchText'
  
  const requestBody = {
    textQuery: searchQuery,
    maxResultCount: Math.min(20, maxResults), // Max 20 per request
    languageCode: 'en',
  }
  
  const data = await withRetry(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.businessStatus,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.formattedAddress',
      },
      body: JSON.stringify(requestBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      const err = new Error(`Google Places API error: ${errorMessage}`)
      ;(err as any).status = response.status
      throw err
    }
    
    return await response.json()
  }, 'Places Text Search')
  
  if (!data.places?.length) return []
  
  // Filter and map results - only keep places with websites
  return data.places
    .filter((p: any) => 
      p.websiteUri && // Must have a website to scrape for email
      p.businessStatus !== 'CLOSED_PERMANENTLY' &&
      p.businessStatus !== 'CLOSED_TEMPORARILY' &&
      p.displayName?.text?.length >= CONFIG.MIN_COMPANY_NAME_LENGTH
    )
    .map((p: any) => ({
      place_id: p.id,
      name: p.displayName?.text || '',
      business_status: p.businessStatus,
      website: p.websiteUri,
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber,
      address: p.formattedAddress,
    }))
}

// =============================================================================
// EMAIL SCRAPING - The main feature!
// =============================================================================

async function scrapeEmailsFromPlaces(places: PlaceResult[], location: string, maxLeads: number): Promise<Lead[]> {
  const leads: Lead[] = []
  
  // Process places one at a time to avoid CPU overload
  for (const place of places) {
    if (leads.length >= maxLeads) break
    
    try {
      const email = await scrapeEmailFromWebsite(place.website!)
      
      if (email) {
        leads.push({
          company: place.name,
          email: email,
          phone: place.phone,
          website: place.website,
          address: place.address,
          source: `Google Maps - ${location}`,
          place_id: place.place_id,
          business_status: place.business_status,
        })
        log('debug', `Found email for ${place.name}`, { email })
      }
    } catch (error) {
      log('debug', `Failed to scrape email from ${place.name}`, { error: (error as Error)?.message })
    }
  }
  
  return leads
}

async function scrapeEmailFromWebsite(websiteUrl: string): Promise<string | undefined> {
  const baseUrl = cleanUrl(websiteUrl)
  if (!baseUrl) return undefined
  
  // Try multiple contact-related pages
  for (const path of CONFIG.CONTACT_PATHS) {
    try {
      const url = path ? `${baseUrl}${path}` : baseUrl
      const email = await scrapeEmailFromPage(url)
      if (email) return email
    } catch {
      // Continue to next path
    }
  }
  
  return undefined
}

async function scrapeEmailFromPage(url: string): Promise<string | undefined> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8,de;q=0.7',
      },
    }, CONFIG.SCRAPE_TIMEOUT_MS)
    
    if (!response.ok) return undefined
    
    const html = await response.text()
    
    // Method 1: Check mailto: links (most reliable)
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    if (mailtoMatch) {
      const email = mailtoMatch[1].toLowerCase()
      if (isValidEmail(email)) return email
    }
    
    // Method 2: Look for emails in common patterns
    const email = extractBestEmailFromHtml(html)
    if (email) return email
    
    return undefined
  } catch {
    return undefined
  }
}

function extractBestEmailFromHtml(html: string): string | undefined {
  if (!html) return undefined
  
  // Remove script and style content to avoid false positives
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  
  // Find all email patterns
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = cleanHtml.match(emailRegex)
  if (!matches) return undefined
  
  // Filter and score emails
  const validEmails = matches
    .map(e => e.toLowerCase())
    .filter(isValidEmail)
    .filter((e, i, arr) => arr.indexOf(e) === i)  // Unique
  
  if (validEmails.length === 0) return undefined
  
  // Score and sort by quality
  const scored = validEmails.map(email => ({
    email,
    score: scoreEmail(email)
  })).sort((a, b) => b.score - a.score)
  
  return scored[0]?.email
}

function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 254) return false
  
  // Check blacklist
  if (CONFIG.EMAIL_BLACKLIST.some(pattern => email.toLowerCase().includes(pattern))) {
    return false
  }
  
  // Check TLD
  const tldMatch = email.match(/\.([a-z]{2,})$/i)
  if (!tldMatch) return false
  
  // Invalid file extensions that look like TLDs
  const invalidTlds = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'js', 'json', 'xml', 'pdf', 'html', 'htm']
  if (invalidTlds.includes(tldMatch[1].toLowerCase())) return false
  
  // Basic format validation
  const parts = email.split('@')
  if (parts.length !== 2) return false
  if (parts[0].length < 1 || parts[1].length < 3) return false
  
  return true
}

function scoreEmail(email: string): number {
  let score = 0
  const localPart = email.split('@')[0].toLowerCase()
  
  // Prefer generic business emails
  if (localPart === 'info') score += 20
  if (localPart === 'contact') score += 20
  if (localPart === 'hello') score += 15
  if (localPart === 'sales') score += 10
  if (localPart === 'office') score += 10
  if (localPart === 'mail') score += 8
  if (localPart === 'enquiries' || localPart === 'inquiries') score += 8
  
  // Personal-looking emails are also good
  if (/^[a-z]+\.[a-z]+$/.test(localPart)) score += 5  // firstname.lastname
  
  // Shorter is usually better
  if (localPart.length < 15) score += 5
  if (localPart.length < 10) score += 3
  
  // Common business TLDs
  if (email.endsWith('.com')) score += 3
  if (email.endsWith('.nl')) score += 3
  if (email.endsWith('.de')) score += 3
  if (email.endsWith('.co.uk')) score += 3
  
  // Avoid numbered emails (info2@, admin1@)
  if (/\d/.test(localPart)) score -= 5
  
  return score
}

function cleanUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '')
  } catch {
    return undefined
  }
}

// =============================================================================
// DEDUPLICATION
// =============================================================================

async function findDuplicates(
  leads: Lead[], userId: string, supabase: SupabaseClient
): Promise<{ unique: Lead[], duplicates: Lead[] }> {
  const unique: Lead[] = []
  const duplicates: Lead[] = []
  
  if (leads.length === 0) return { unique, duplicates }
  
  const emails = leads.map(l => l.email.toLowerCase())
  
  try {
    const { data: emailMatches } = await supabase
      .from('leads')
      .select('email')
      .eq('user_id', userId)
      .in('email', emails)
    
    const existingEmails = new Set(
      (emailMatches || []).map(m => m.email?.toLowerCase()).filter(Boolean)
    )
    
    const seenEmails = new Set<string>()
    
    for (const lead of leads) {
      const normalizedEmail = lead.email.toLowerCase()
      
      if (existingEmails.has(normalizedEmail) || seenEmails.has(normalizedEmail)) {
        duplicates.push(lead)
      } else {
        unique.push(lead)
        seenEmails.add(normalizedEmail)
      }
    }
  } catch (error) {
    log('warn', 'Duplicate check failed, proceeding without dedup', { error: (error as Error)?.message })
    return { unique: leads, duplicates: [] }
  }
  
  return { unique, duplicates }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function saveLeadsToDatabase(
  supabaseClient: SupabaseClient, leads: Lead[], userId: string
): Promise<any[]> {
  if (leads.length === 0) return []
  
  const savedLeads: any[] = []

  // Build notes with address and website info
  const buildNotes = (lead: Lead): string | null => {
    const parts: string[] = []
    if (lead.website) parts.push(`Website: ${lead.website}`)
    if (lead.address) parts.push(`Address: ${lead.address}`)
    return parts.length > 0 ? parts.join('\n') : null
  }

  const leadsToInsert = leads.map(lead => ({
    user_id: userId,
    company: lead.company,
    name: lead.company,  // Use company name as lead name
    email: lead.email,   // Required field
    phone: lead.phone || null,
    status: 'new',
    source: [lead.source],
    notes: buildNotes(lead),
  }))

  // Batch insert in chunks
  const chunkSize = 20
  for (let i = 0; i < leadsToInsert.length; i += chunkSize) {
    const chunk = leadsToInsert.slice(i, i + chunkSize)
    
    try {
      const { data, error } = await supabaseClient
        .from('leads')
        .insert(chunk)
        .select()

      if (error) {
        log('error', 'Failed to save leads chunk', { error: error.message, chunkIndex: i })
      } else if (data) {
        savedLeads.push(...data)
      }
    } catch (error) {
      log('error', 'Exception saving leads chunk', { error: (error as Error)?.message })
    }
  }

  return savedLeads
}

async function logApiUsage(
  supabase: SupabaseClient,
  data: {
    userId: string; endpoint: string; method: string; leadsRequested: number
    leadsGenerated: number; success: boolean; errorMessage?: string
    durationMs: number; ipAddress: string | null; userAgent: string | null
  }
): Promise<void> {
  try {
    await supabase.from('api_usage_logs').insert({
      user_id: data.userId,
      endpoint: data.endpoint,
      method: data.method,
      leads_requested: data.leadsRequested,
      leads_generated: data.leadsGenerated,
      success: data.success,
      error_message: data.errorMessage || null,
      duration_ms: data.durationMs,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
    })
  } catch (error) {
    // API usage logging is optional, don't throw
  }
}
