// Supabase Edge Function: generate-reply
// Genereert een AI sales reply op basis van email context en sentiment

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')

interface EmailReplyContext {
  recipientEmail: string
  recipientName: string
  originalSubject: string
  originalBody: string
  sentiment: 'positive' | 'neutral' | 'negative'
  userName?: string
  companyName?: string
  productService?: string
  calendlyLink?: string
  language?: string
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

    // Validate required fields
    const missingFields = []
    if (!context.recipientName) missingFields.push('recipientName')
    if (!context.recipientEmail) missingFields.push('recipientEmail')
    if (!context.originalSubject) missingFields.push('originalSubject')
    if (!context.originalBody) missingFields.push('originalBody')
    if (!context.sentiment) missingFields.push('sentiment')
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }

    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY not configured')
    }

    const sentiment = context.sentiment
    console.log(`[REPLY] Using sentiment from UI: ${sentiment}`)
    console.log(`[REPLY] Calendly link received: ${context.calendlyLink || 'NOT PROVIDED'}`)

    // GUARDRAIL: Block positive replies without Calendly link
    if (sentiment === 'positive' && !context.calendlyLink) {
      console.error('[REPLY] BLOCKED: Positive sentiment but no Calendly link provided')
      throw new Error('Cannot generate positive reply: Calendly link is required but missing')
    }

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

    // Build strategy based on UI sentiment
    let strategyPrompt = ''
    
    if (sentiment === 'positive') {
      strategyPrompt = `The prospect is POSITIVE and interested. Your goal:
- Thank them warmly for their interest
- Briefly confirm what ${context.productService || 'your service'} offers
- Express enthusiasm about helping them
- Keep tone professional but enthusiastic
- End with a natural closing like "I would be happy to discuss this further" or "Let me know if you have any questions"
- CRITICAL: Do NOT mention scheduling, meetings, calendars, or booking calls - the system will add the Calendly link automatically`
    } else if (sentiment === 'neutral') {
      strategyPrompt = `The prospect is NEUTRAL - interested but uncertain. Your goal:
- Acknowledge their inquiry professionally
- Explain clearly what ${context.productService || 'your service'} does and the value it provides
- Address potential concerns proactively
- End with an open invitation to ask questions or discuss further
- Do NOT push for a meeting`
    } else {
      // negative
      strategyPrompt = `The prospect is NEGATIVE or not interested. Your goal:
- Thank them professionally for their time
- Keep it brief and respectful
- Leave the door open for future communication
- Do NOT push for a meeting or try to convince them`
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

    // Parse Claude response - handle malformed JSON with control characters
    let result: GeneratedReply
    try {
      // Extract JSON from response
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        // Clean the JSON string by removing/escaping control characters
        let jsonString = jsonMatch[0]
        
        // Try parsing - if it fails due to control chars, we'll handle it differently
        let parsed: any
        try {
          parsed = JSON.parse(jsonString)
        } catch (parseErr) {
          console.log('Direct JSON parse failed, trying alternate extraction')
          
          // Manually extract body using regex (more forgiving than JSON.parse)
          const subjectMatch = jsonString.match(/"subject"\s*:\s*"([^"]+)"/)
          const bodyMatch = jsonString.match(/"body"\s*:\s*"([\s\S]+?)"\s*,\s*"tone"/)
          const toneMatch = jsonString.match(/"tone"\s*:\s*"([^"]+)"/)
          
          if (bodyMatch && bodyMatch[1]) {
            result = {
              subject: subjectMatch?.[1] || `Re: ${context.originalSubject}`,
              body: bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
              tone: toneMatch?.[1] || sentiment,
            }
            console.log('✓ Extracted via regex, body length:', result.body.length)
          } else {
            throw parseErr // Re-throw if regex extraction also fails
          }
        }
        
        // If JSON.parse succeeded, extract fields
        if (parsed) {
          let bodyText = parsed.body || claudeResponse
          let subjectText = parsed.subject || `Re: ${context.originalSubject}`
          let toneText = parsed.tone || sentiment
          
          // Handle nested JSON (if body is itself a JSON string)
          if (typeof bodyText === 'string' && bodyText.trim().startsWith('{')) {
            try {
              const nestedJson = JSON.parse(bodyText)
              if (nestedJson.body) {
                bodyText = nestedJson.body
                subjectText = nestedJson.subject || subjectText
                toneText = nestedJson.tone || toneText
                console.log('✓ Extracted from nested JSON')
              }
            } catch {
              // Not nested, continue
            }
          }
          
          result = {
            subject: subjectText,
            body: bodyText,
            tone: toneText,
          }
        }
      } else {
        // No JSON found
        result = {
          subject: `Re: ${context.originalSubject}`,
          body: claudeResponse,
          tone: sentiment,
        }
      }
    } catch (parseError) {
      console.error('JSON extraction failed:', parseError)
      // Final fallback: use raw response
      result = {
        subject: `Re: ${context.originalSubject}`,
        body: claudeResponse,
        tone: sentiment,
      }
    }

    console.log('Result before CTA injection:', {
      subject: result.subject,
      bodyLength: result.body.length,
      bodyPreview: result.body.substring(0, 150)
    })

    // CRITICAL: CTA injection for positive sentiment
    // This MUST happen for every positive reply without exception
    if (sentiment === 'positive') {
      console.log('[REPLY] Positive sentiment detected - preparing CTA injection')
      console.log(`[REPLY] Calendly link for injection: ${context.calendlyLink}`)
      
      if (!context.calendlyLink) {
        console.error('[REPLY] FATAL: Positive sentiment but no Calendly link at injection point')
        throw new Error('Internal error: Cannot inject CTA without Calendly link')
      }

      // Remove any signature/closing that Claude added (despite instructions)
      const closingPatterns = [
        /\n\n(Best|Kind regards|Sincerely|Regards|Cheers|Thanks|Thank you|Met vriendelijke groet|Groeten|Mvg),?\s*\n.*$/is,
        /\n\n(Best|Kind regards|Sincerely|Regards|Cheers|Thanks|Thank you|Met vriendelijke groet|Groeten|Mvg),?\s*$/is,
      ]
      
      let cleanedBody = result.body
      for (const pattern of closingPatterns) {
        cleanedBody = cleanedBody.replace(pattern, '')
      }
      cleanedBody = cleanedBody.trim()
      
      console.log('[REPLY] Removed signature/closing from body')

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
      console.log(`[REPLY] Using CTA template for language: ${targetLanguage}`)
      
      // Add signature after Calendly link
      const signatureTemplates: Record<string, string> = {
        en: `\n\nBest,\n${context.userName || 'there'}`,
        nl: `\n\nMet vriendelijke groet,\n${context.userName || 'daar'}`,
        de: `\n\nMit freundlichen Grüßen,\n${context.userName || 'dort'}`,
        fr: `\n\nCordialement,\n${context.userName || 'là'}`,
        es: `\n\nSaludos,\n${context.userName || 'allí'}`,
        it: `\n\nCordiali saluti,\n${context.userName || 'lì'}`,
        pt: `\n\nCordialmente,\n${context.userName || 'lá'}`,
      }
      
      const signature = signatureTemplates[targetLanguage] || signatureTemplates['en']
      
      // Structure: [cleaned body] + [CTA with Calendly] + [signature]
      result.body = cleanedBody + ctaBlock + signature
      
      console.log('[REPLY] ✓ CTA INJECTED - Positive reply contains Calendly link + signature')
      
      // Verify injection
      if (!result.body.includes(context.calendlyLink)) {
        console.error('[REPLY] FATAL: CTA injection failed - link not found in body')
        throw new Error('Internal error: CTA injection verification failed')
      }
    } else {
      console.log(`[REPLY] No CTA injection - Sentiment is ${sentiment}`)
    }

    console.log('Final result after CTA injection:', {
      subject: result.subject,
      bodyLength: result.body.length,
      bodyPreview: result.body.substring(0, 150),
      bodyEnding: result.body.substring(result.body.length - 150)
    })

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
