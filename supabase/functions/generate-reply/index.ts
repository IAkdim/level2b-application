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

    // Bepaal de prompt strategie op basis van sentiment
    let strategyPrompt = ''
    
    if (sentiment === 'positive') {
      strategyPrompt = `De prospect is POSITIEF en geïnteresseerd. Jouw doel:
- Bedank voor de interesse en enthousiasme
- Stel voor om een meeting te plannen via Calendly
- Houd de toon professioneel maar enthousiast
- Maak duidelijk wat ze kunnen verwachten in de meeting
- Sluit af met een directe call-to-action om een tijdslot te kiezen`
    } else if (sentiment === 'doubtful') {
      strategyPrompt = `De prospect is TWIJFELEND en heeft twijfels. Jouw doel:
- Erken hun twijfels op een empathische manier
- Geef concrete voordelen en waardepropositie
- Gebruik social proof (andere klanten, resultaten) als dat relevant is
- Bied aan om specifieke vragen te beantwoorden
- Stel voor om een vrijblijvend gesprek te plannen om hun vragen te beantwoorden
- Gebruik een overtuigende maar niet pusherige toon`
    } else {
      strategyPrompt = `De prospect lijkt NIET GEÏNTERESSEERD. Jouw doel:
- Accepteer hun positie met respect
- Stel open vragen om de echte bezwaren te achterhalen
- Probeer te begrijpen wat hun grootste zorgen/uitdagingen zijn
- Bied waarde zonder direct te verkopen
- Houd de deur open voor toekomstige conversaties
- Gebruik een nieuwsgierige, consultative toon`
    }

    const systemPrompt = `Je bent een expert B2B sales professional met jarenlange ervaring in consultative selling. 
Je schrijft persoonlijke, overtuigende email responses die klanten helpen en waarde bieden.

CONTEXT:
Sentiment van de prospect: ${sentiment.toUpperCase()}
Bedrijfsnaam: ${context.companyName || 'jouw bedrijf'}
Product/Service: ${context.productService || 'jullie dienstverlening'}

STRATEGIE:
${strategyPrompt}

STIJL RICHTLIJNEN:
- Schrijf in het Nederlands
- Gebruik een professionele maar warme toon
- Personaliseer de email (gebruik de naam van de prospect)
- Houd het beknopt (max 150 woorden)
- Eindig met een duidelijke vraag of call-to-action
- De email moet klinken als geschreven door een mens, niet door AI

KRITIEK - EMAIL AFSLUITING:
- NOOIT "Met vriendelijke groet" gebruiken
- NOOIT een handtekening toevoegen
- NOOIT placeholders zoals [Naam], [Jouw naam], [Bedrijf] gebruiken
- De email stopt direct na de laatste zin of vraag
- Voorbeeld GOED: "Laten we in contact blijven. Wanneer je er klaar voor bent, hoor ik het graag."
- Voorbeeld FOUT: "Laten we in contact blijven.\n\nMet vriendelijke groet,\n[Jouw naam]"

De body moet eindigen waar de inhoud eindigt - zonder groet of naam.`

    const userPrompt = `Originele email onderwerp: "${context.originalSubject}"

Originele email van ${context.recipientName} (${context.recipientEmail}):
"""
${context.originalBody}
"""

Schrijf nu een perfecte sales reply email. 

BELANGRIJK: Geef ALLEEN een JSON object terug met exact deze structuur:
{
  "subject": "Re: [origineel onderwerp]",
  "body": "[email body tekst - GEEN JSON, ALLEEN PLAIN TEXT]",
  "tone": "[beschrijving van de gebruikte tone/aanpak]"
}

De "body" field moet ALLEEN de email tekst bevatten, GEEN JSON formatting.`

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
