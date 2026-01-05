// Supabase Edge Function: generate-reply
// Genereert een AI sales reply op basis van email context en sentiment

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')

interface EmailReplyContext {
  recipientName: string
  recipientEmail: string
  originalSubject: string
  originalBody: string
  sentiment: 'positive' | 'neutral' | 'negative'
  userName?: string
  companyName?: string
  productService?: string
  calendlyLink?: string
  language?: string // en, nl, de, fr, es, it, pt
}

interface GeneratedReply {
  subject: string
  body: string
  tone: string
  error?: string
}

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Generate reply function invoked')

    const context: EmailReplyContext = await req.json()
    console.log('Context received:', JSON.stringify(context))

    // Validate required fields with detailed error messages
    const missingFields = []
    if (!context.recipientName) missingFields.push('recipientName')
    if (!context.recipientEmail) missingFields.push('recipientEmail')
    if (!context.originalSubject) missingFields.push('originalSubject')
    if (!context.originalBody) missingFields.push('originalBody')
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }

    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY not configured')
    }

    // Default sentiment if not provided
    const sentiment = context.sentiment || 'neutral'
    console.log('Using sentiment:', sentiment)

    // Language mapping
    const languageNames: Record<string, string> = {
      en: 'English (British)',
      nl: 'Dutch (Nederlands)',
      de: 'German (Deutsch)',
      fr: 'French (Français)',
      es: 'Spanish (Español)',
      it: 'Italian (Italiano)',
      pt: 'Portuguese (Português)',
    }
    
    const targetLanguage = context.language || 'en'
    const languageName = languageNames[targetLanguage] || 'English (British)'
    
    console.log('Using language:', languageName)
    console.log('Calendly link:', context.calendlyLink || 'not provided')

    // Build strategy based on sentiment
    let strategyPrompt = ''
    let includeCalendlyLink = false
    
    if (sentiment === 'positive') {
      includeCalendlyLink = !!context.calendlyLink
      strategyPrompt = `The prospect is POSITIVE and interested. Your goal:
- Thank them warmly for their interest
- Briefly confirm what ${context.productService || 'your service'} offers
- Express enthusiasm about helping them
- Keep tone professional but enthusiastic
- End with a natural closing like "I would be happy to discuss this further" or "Let me know if you have any questions"
- Do NOT mention scheduling, meetings, calendars, or booking calls - the system will add that automatically`
    } else if (sentiment === 'neutral') {
      includeCalendlyLink = false
      strategyPrompt = `The prospect is NEUTRAL - interested but uncertain. Your goal:
- Acknowledge their inquiry professionally
- Explain clearly what ${context.productService || 'your service'} does and the value it provides
- Address potential concerns proactively
- End with an open invitation to ask questions or discuss further
- Do NOT push for a meeting
- Do NOT include a Calendly link`
    } else {
      includeCalendlyLink = false
      strategyPrompt = `The prospect is NEGATIVE or not interested. Your goal:
- Thank them respectfully for their time and response
- Accept their decision gracefully
- Leave the door open for future contact if their needs change
- Keep it brief and professional
- Do NOT push for a meeting
- Do NOT include a Calendly link`
    }

    const systemPrompt = `You are an expert B2B sales professional with years of experience in consultative selling. 
You write personalised, persuasive email responses that help clients and provide value.

CRITICAL LANGUAGE REQUIREMENT:
Write the ENTIRE email response in ${languageName}.
- Subject line: in ${languageName}
- Email body: in ${languageName}
- All text content: in ${languageName}
- Tone description can be in English (for internal reference)

CRITICAL DATA PROVIDED TO YOU:
Prospect's name: "${context.recipientName}"
Your name: ${context.userName ? `"${context.userName}"` : '(use natural fallback like "there")'}
Company name: ${context.companyName ? `"${context.companyName}"` : '(use natural fallback)'}
Product/Service: ${context.productService ? `"${context.productService}"` : '"your services"'}
Prospect's sentiment: ${sentiment.toUpperCase()}

STRATEGY:
${strategyPrompt}

STYLE GUIDELINES:
- Write in ${languageName}
- Use a professional but warm tone
- Keep it concise (max 150 words)
- End with a clear question or call-to-action
- The email should sound human-written, not AI-generated

ABSOLUTE RULES - NEVER VIOLATE:
- NEVER use placeholders like [Name], [Your name], [Company], [Prospect's Name]
- Use the actual values provided above directly in your text
- If a value is marked as "use natural fallback", write naturally without specifying the name (e.g., "Hi there," instead of "Hi [Name],")
- Start emails with the prospect's name "${context.recipientName}" if appropriate, or use a natural greeting
- For POSITIVE sentiment: NEVER mention scheduling, booking, calendars, meetings, or availability - the system handles this automatically
- The output must be 100% send-ready with NO editing needed

CRITICAL - EMAIL CLOSING:
- NEVER use formal closings like "Best regards", "Kind regards", "Sincerely", "Met vriendelijke groet"
- NEVER add a signature block
- The email stops directly after the last sentence or question
- Example GOOD: "Let's stay in touch. When you're ready, I'd love to hear from you."
- Example BAD: "Let's stay in touch.\\n\\nBest regards,\\n[Your name]"

The body must end where the content ends - without formal closing or signature.`

    const userPrompt = `Original email subject: "${context.originalSubject}"

Original email from ${context.recipientName} (${context.recipientEmail}):
"""
${context.originalBody}
"""

Write a perfect sales reply email now in ${languageName}.

USE THESE EXACT VALUES IN YOUR EMAIL (NO PLACEHOLDERS):
- Prospect's name: "${context.recipientName}"
${context.userName ? `- Your name: "${context.userName}"` : '- If you need your name, use a natural fallback (e.g., just skip it or say "I" or "we")'}
${context.companyName ? `- Company: "${context.companyName}"` : ''}
${context.productService ? `- Product/Service: "${context.productService}"` : ''}

CRITICAL REMINDERS:
- Write directly to ${context.recipientName} - use this name, not [Name] or [Prospect's Name]
- Write in ${languageName}
- The output must be send-ready with ZERO placeholders
- If any data is missing, write naturally without that detail

IMPORTANT: Return ONLY a JSON object with exactly this structure:
{
  "subject": "Re: ${context.originalSubject}",
  "body": "[complete email body in ${languageName} - addressed to ${context.recipientName} - NO placeholders - NO signature]",
  "tone": "[tone description in English]"
}

The "body" field must be 100% ready to send - NO brackets, NO placeholders, NO [Name] anywhere.`

    console.log('Calling Claude API...')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', errorText)
      throw new Error(`Claude API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Claude API response received')

    // Parse Claude response
    const claudeResponse = data.content[0].text
    console.log('Claude response text:', claudeResponse)

    // Extract JSON from response
    let result: GeneratedReply
    try {
      // Try to parse as JSON - Claude should return valid JSON
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        console.log('Parsed JSON from Claude:', JSON.stringify(parsed).substring(0, 300))
        
        // Check if body contains nested JSON string (common Claude mistake)
        let bodyText = parsed.body || claudeResponse
        let subjectText = parsed.subject || `Re: ${context.originalSubject}`
        let toneText = parsed.tone || sentiment
        
        console.log('Body type:', typeof bodyText)
        console.log('Body starts with:', bodyText.substring(0, 50))
        
        // Handle nested JSON - Claude sometimes returns the ENTIRE response as a JSON string in the body
        if (typeof bodyText === 'string') {
          // Check if it starts with { - it's probably nested JSON
          const trimmedBody = bodyText.trim()
          if (trimmedBody.startsWith('{')) {
            try {
              const nestedJson = JSON.parse(trimmedBody)
              if (nestedJson && typeof nestedJson === 'object' && nestedJson.body) {
                bodyText = nestedJson.body
                subjectText = nestedJson.subject || subjectText
                toneText = nestedJson.tone || toneText
                console.log('✓ Successfully extracted from nested JSON')
              }
            } catch (parseErr) {
              console.log('Not valid nested JSON, treating as text')
            }
          }
          
          // Clean up escape sequences if still present
          if (bodyText.includes('\\n') || bodyText.includes('\\"')) {
            bodyText = bodyText
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\t/g, '\t')
            console.log('✓ Cleaned escape sequences')
          }
        }
        
        result = {
          subject: subjectText,
          body: bodyText,
          tone: toneText,
        }
        
        console.log('Final extracted body length:', bodyText.length)
        console.log('Body preview:', bodyText.substring(0, 100))
      } else {
        // Fallback: create structured response
        result = {
          subject: `Re: ${context.originalSubject}`,
          body: claudeResponse,
          tone: sentiment,
        }
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      // If parsing fails, use the raw response as body
      result = {
        subject: `Re: ${context.originalSubject}`,
        body: claudeResponse,
        tone: sentiment,
      }
    }

    console.log('Final result:', JSON.stringify(result).substring(0, 200))

    // System-side CTA injection for positive sentiment
    if (sentiment === 'positive' && context.calendlyLink) {
      const ctaTemplates: Record<string, string> = {
        en: `\n\nI would love to discuss this further with you. Please feel free to book a time that works best for you:\n${context.calendlyLink}`,
        nl: `\n\nIk bespreek dit graag verder met je. Plan gerust een moment in dat jou het beste uitkomt:\n${context.calendlyLink}`,
        de: `\n\nIch würde dies gerne weiter mit Ihnen besprechen. Buchen Sie gerne einen Termin, der Ihnen am besten passt:\n${context.calendlyLink}`,
        fr: `\n\nJ'aimerais en discuter davantage avec vous. N'hésitez pas à réserver un créneau qui vous convient le mieux:\n${context.calendlyLink}`,
        es: `\n\nMe encantaría discutir esto más a fondo contigo. No dudes en reservar un horario que te funcione mejor:\n${context.calendlyLink}`,
        it: `\n\nMi piacerebbe discuterne ulteriormente con te. Sentiti libero di prenotare un orario che funziona meglio per te:\n${context.calendlyLink}`,
        pt: `\n\nGostaria de discutir isso mais detalhadamente contigo. Sinta-se à vontade para marcar um horário que funcione melhor para ti:\n${context.calendlyLink}`,
      }
      
      const ctaBlock = ctaTemplates[targetLanguage] || ctaTemplates['en']
      result.body = result.body + ctaBlock
      
      console.log('✓ Added meeting CTA block for positive sentiment')
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in generate-reply function:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(
      JSON.stringify({
        subject: '',
        body: '',
        tone: '',
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
