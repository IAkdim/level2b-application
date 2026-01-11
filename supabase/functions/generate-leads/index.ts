import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateLeadsRequest {
  method: 'google_maps' | 'social_media'
  niche: string
  location: string
  maxLeads: number
  emailProvider?: string
  orgId: string
}

interface Lead {
  company: string
  contact_name?: string
  email?: string
  phone?: string
  website?: string
  linkedin_url?: string
  source: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let userId: string | undefined
  let orgId: string | undefined

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Create admin client for rate limiting (uses service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify authentication
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    userId = user.id

    const body: GenerateLeadsRequest = await req.json()
    const { method, niche, location, maxLeads, emailProvider, orgId: requestOrgId } = body
    orgId = requestOrgId

    console.log('Starting lead generation:', { method, niche, location, maxLeads })

    // ✅ RATE LIMITING CHECK
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc(
      'get_hourly_rate_limit',
      { p_user_id: userId, p_org_id: orgId }
    )

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError)
      throw new Error('Rate limit check failed')
    }

    const rateLimit = rateLimitData?.[0]
    if (rateLimit && rateLimit.limit_remaining < maxLeads) {
      throw new Error(
        `Rate limit exceeded. You can generate ${rateLimit.limit_remaining} more leads this hour. ` +
        `Limit resets at ${new Date(rateLimit.hour_start).getHours() + 1}:00.`
      )
    }

    let leads: Lead[] = []

    if (method === 'google_maps') {
      leads = await generateFromGoogleMaps(niche, location, maxLeads)
    } else if (method === 'social_media') {
      leads = await generateFromSocialMedia(niche, location, maxLeads, emailProvider || 'gmail.com')
    }

    // Save leads to database
    const savedLeads = await saveLeadsToDatabase(supabaseClient, leads, orgId, method)

    // ✅ INCREMENT RATE LIMIT
    await supabaseAdmin.rpc('increment_rate_limit', {
      p_user_id: userId,
      p_org_id: orgId,
      p_leads_count: savedLeads.length
    })

    // ✅ LOG API USAGE (success)
    const duration = Date.now() - startTime
    await supabaseAdmin.from('api_usage_logs').insert({
      organization_id: orgId,
      user_id: userId,
      endpoint: 'generate-leads',
      method: method,
      leads_requested: maxLeads,
      leads_generated: savedLeads.length,
      success: true,
      duration_ms: duration,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent')
    })

    return new Response(
      JSON.stringify({
        success: true,
        leadsGenerated: savedLeads.length,
        leads: savedLeads,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error generating leads:', error)

    // ✅ LOG API USAGE (failure)
    if (userId && orgId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        const duration = Date.now() - startTime
        await supabaseAdmin.from('api_usage_logs').insert({
          organization_id: orgId,
          user_id: userId,
          endpoint: 'generate-leads',
          method: 'unknown',
          leads_requested: 0,
          leads_generated: 0,
          success: false,
          error_message: error.message || 'Unknown error',
          duration_ms: duration,
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          user_agent: req.headers.get('user-agent')
        })
      } catch (logError) {
        console.error('Failed to log error:', logError)
      }
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate leads',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

async function generateFromGoogleMaps(
  niche: string,
  location: string,
  maxLeads: number
): Promise<Lead[]> {
  const leads: Lead[] = []
  
  // Google Places API key from environment
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
  
  if (!apiKey) {
    console.warn('No Google Maps API key found, using mock data')
    // Return mock data for testing
    return generateMockLeads(niche, location, maxLeads, 'google_maps')
  }

  try {
    // Step 1: Text search for businesses
    const searchQuery = `${niche} in ${location}`
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
    
    const searchResponse = await fetch(searchUrl)
    const searchData = await searchResponse.json()

    if (searchData.status !== 'OK' || !searchData.results) {
      throw new Error(`Google Maps search failed: ${searchData.status}. Please check your API key and quota.`)
    }

    const places = searchData.results.slice(0, maxLeads)

    // Step 2: Get details for each place
    for (const place of places) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,website,formatted_address&key=${apiKey}`
        
        const detailsResponse = await fetch(detailsUrl)
        const detailsData = await detailsResponse.json()

        if (detailsData.status === 'OK' && detailsData.result) {
          const result = detailsData.result
          let email = undefined

          // Step 3: Try to scrape email from website
          if (result.website) {
            email = await scrapeEmailFromWebsite(result.website)
          }

          leads.push({
            company: result.name || place.name,
            email,
            phone: result.formatted_phone_number,
            website: result.website,
            source: `Google Maps - ${location}`,
          })

          if (leads.length >= maxLeads) break
        }
      } catch (error) {
        console.error('Error fetching place details:', error)
      }
    }
  } catch (error) {
    console.error('Error in Google Maps generation:', error)
    throw error
  }

  return leads
}

async function generateFromSocialMedia(
  niche: string,
  location: string,
  maxLeads: number,
  emailProvider: string
): Promise<Lead[]> {
  const leads: Lead[] = []
  
  // Google Custom Search API key from environment
  const apiKey = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY')
  const searchEngineId = Deno.env.get('GOOGLE_CUSTOM_SEARCH_ENGINE_ID')
  
  if (!apiKey || !searchEngineId) {
    throw new Error('Google Custom Search not configured. Please add GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID in Supabase Edge Function secrets.')
  }

  try {
    // Search LinkedIn
    const linkedInQuery = `site:linkedin.com/in "${niche}" "@${emailProvider}" "${location}"`
    const linkedInLeads = await searchSocialMedia(linkedInQuery, apiKey, searchEngineId, Math.ceil(maxLeads / 2), 'linkedin.com')
    leads.push(...linkedInLeads)

    // Search Twitter/X if we need more leads
    if (leads.length < maxLeads) {
      const twitterQuery = `site:twitter.com "${niche}" "@${emailProvider}" "${location}"`
      const twitterLeads = await searchSocialMedia(twitterQuery, apiKey, searchEngineId, maxLeads - leads.length, 'twitter.com')
      leads.push(...twitterLeads)
    }
  } catch (error) {
    console.error('Error in social media generation:', error)
    throw error
  }

  return leads.slice(0, maxLeads)
}

async function searchSocialMedia(
  query: string,
  apiKey: string,
  searchEngineId: string,
  maxResults: number,
  platform: string
): Promise<Lead[]> {
  const leads: Lead[] = []
  
  try {
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${Math.min(maxResults, 10)}`
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (data.items) {
      for (const item of data.items) {
        const email = extractEmailFromText(item.snippet + ' ' + item.title)
        const name = extractNameFromText(item.title)

        if (email || name) {
          leads.push({
            company: name || 'Unknown',
            contact_name: name,
            email,
            linkedin_url: platform === 'linkedin.com' ? item.link : undefined,
            source: `Social Media - ${platform}`,
          })
        }
      }
    }
  } catch (error) {
    console.error('Error searching social media:', error)
  }

  return leads
}

async function scrapeEmailFromWebsite(websiteUrl: string): Promise<string | undefined> {
  try {
    // Add timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) return undefined

    const html = await response.text()
    
    // Look for email in HTML
    const email = extractEmailFromText(html)
    return email
  } catch (error) {
    console.error('Error scraping website:', error)
    return undefined
  }
}

function extractEmailFromText(text: string): string | undefined {
  // Match email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailRegex)
  
  if (matches && matches.length > 0) {
    // Filter out common noise emails
    const filtered = matches.filter(email => 
      !email.includes('example.com') &&
      !email.includes('test.com') &&
      !email.includes('noreply') &&
      !email.includes('no-reply')
    )
    return filtered[0]
  }
  
  return undefined
}

function extractNameFromText(text: string): string | undefined {
  // Try to extract name from LinkedIn/Twitter title
  // LinkedIn format: "Name - Job Title | LinkedIn"
  const linkedInMatch = text.match(/^([^-|]+)/)
  if (linkedInMatch) {
    return linkedInMatch[1].trim()
  }
  
  return undefined
}

async function saveLeadsToDatabase(
  supabaseClient: any,
  leads: Lead[],
  orgId: string,
  method: string
): Promise<any[]> {
  const savedLeads = []

  for (const lead of leads) {
    try {
      const { data, error } = await supabaseClient
        .from('leads')
        .insert({
          organization_id: orgId,
          company: lead.company,
          contact_name: lead.contact_name,
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          linkedin_url: lead.linkedin_url,
          status: 'new',
          source: lead.source,
          tags: [method === 'google_maps' ? 'Google Maps Generated' : 'Social Media Generated', 'AI Generated'],
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving lead:', error)
      } else {
        savedLeads.push(data)
      }
    } catch (error) {
      console.error('Error saving lead:', error)
    }
  }

  return savedLeads
}
