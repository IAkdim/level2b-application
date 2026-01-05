// Supabase Edge Function: generate-reply
// Genereert een AI sales reply op basis van email context en sentiment

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')

interface EmailReplyContext {
  recipientName: string
  recipientEmail: string
  originalSubject: string
  originalBody: string
  sentiment: 'positive' | 'doubtful' | 'not_interested'
  companyName?: string
  productService?: string
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
    const sentiment = context.sentiment || 'doubtful'
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

    // Bepaal de prompt strategie op basis van sentiment
    let strategyPrompt = ''
    
    if (sentiment === 'positive') {
      strategyPrompt = `The prospect is POSITIVE and interested. Your goal:
- Thank them for their interest and enthusiasm
- Suggest scheduling a meeting
- Keep the tone professional but enthusiastic
- Make clear what they can expect in the meeting
- Close with a direct call-to-action to choose a time slot`
    } else if (sentiment === 'doubtful') {
      strategyPrompt = `The prospect is DOUBTFUL and has concerns. Your goal:
- Acknowledge their doubts in an empathetic way
- Provide concrete benefits and value proposition
- Use social proof (other clients, results) if relevant
- Offer to answer specific questions
- Suggest a non-committal conversation to address their questions
- Use a persuasive but not pushy tone`
    } else {
      strategyPrompt = `The prospect seems NOT INTERESTED. Your goal:
- Accept their position with respect
- Ask open questions to understand the real objections
- Try to understand what their biggest concerns/challenges are
- Offer value without directly selling
- Keep the door open for future conversations
- Use a curious, consultative tone`
    }

    const systemPrompt = `You are an expert B2B sales professional with years of experience in consultative selling. 
You write personalised, persuasive email responses that help clients and provide value.

CRITICAL LANGUAGE REQUIREMENT:
Write the ENTIRE email response in ${languageName}.
- Subject line: in ${languageName}
- Email body: in ${languageName}
- All text content: in ${languageName}
- Tone description can be in English (for internal reference)

CONTEXT:
Prospect's sentiment: ${sentiment.toUpperCase()}
Company name: ${context.companyName || 'your company'}
Product/Service: ${context.productService || 'your services'}

STRATEGY:
${strategyPrompt}

STYLE GUIDELINES:
- Write in ${languageName}
- Use a professional but warm tone
- Personalise the email (use the prospect's name)
- Keep it concise (max 150 words)
- End with a clear question or call-to-action
- The email should sound human-written, not AI-generated

CRITICAL - EMAIL CLOSING:
- NEVER use formal closings like "Best regards", "Kind regards", "Sincerely", "Met vriendelijke groet"
- NEVER add a signature block
- NEVER use placeholders like [Name], [Your name], [Company]
- The email stops directly after the last sentence or question
- Example GOOD: "Let's stay in touch. When you're ready, I'd love to hear from you."
- Example BAD: "Let's stay in touch.\\n\\nBest regards,\\n[Your name]"

The body must end where the content ends - without formal closing or signature.`

    const userPrompt = `Original email subject: "${context.originalSubject}"

Original email from ${context.recipientName} (${context.recipientEmail}):
"""
${context.originalBody}
"""

Write a perfect sales reply email now.

IMPORTANT: Return ONLY a JSON object with exactly this structure:
{
  "subject": "Re: [original subject]",
  "body": "[email body text - NO JSON, ONLY PLAIN TEXT in ${languageName}]",
  "tone": "[description of the tone/approach used]"
}

The "body" field must ONLY contain the email text in ${languageName}, NO JSON formatting.`

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
