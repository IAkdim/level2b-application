// Supabase Edge Function: generate-cold-email-template
// Genereert een overtuigende cold email template op basis van bedrijfsinformatie

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')

interface CompanyInfo {
  companyName: string
  companyDescription?: string
  productService: string
  uniqueSellingPoints?: string[]
  targetAudience: string
  industry?: string
  calendlyLink?: string
}

interface GeneratedTemplate {
  templateName: string
  subject: string
  body: string
  tone: string
  targetSegment: string
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
    console.log('Generate cold email template function invoked')

    const companyInfo: CompanyInfo = await req.json()
    console.log('Company info received:', JSON.stringify(companyInfo))

    // Validate required fields
    const missingFields = []
    if (!companyInfo.companyName) missingFields.push('companyName')
    if (!companyInfo.productService) missingFields.push('productService')
    if (!companyInfo.targetAudience) missingFields.push('targetAudience')
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Verplichte velden ontbreken: ${missingFields.join(', ')}. Vul deze in via Configuratie > Bedrijfsinformatie.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!CLAUDE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'AI functionaliteit is niet geconfigureerd. Neem contact op met je administrator om de CLAUDE_API_KEY in te stellen in Supabase Edge Function secrets.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Build USPs string
    const uspsText = companyInfo.uniqueSellingPoints && companyInfo.uniqueSellingPoints.length > 0
      ? companyInfo.uniqueSellingPoints.map((usp, i) => `${i + 1}. ${usp}`).join('\n')
      : 'N/A'

    const systemPrompt = `Je bent een expert B2B cold email copywriter met jarenlange ervaring in outbound sales.
Je schrijft cold emails die:
- Direct nieuwsgierigheid opwekken
- Waarde bieden zonder te pushen
- Persoonlijk en relevant zijn
- Leiden tot een reactie of meeting
- Kort en bondig zijn (max 120 woorden)

BELANGRIJKE PRINCIPES:
1. Start met een haak die nieuwsgierigheid wekt
2. Maak het over HUN probleem, niet jouw product
3. Gebruik social proof als relevant
4. Eindige met een zachte CTA (geen harde verkoop)
5. Gebruik NOOIT placeholders zoals [Naam], [Bedrijf]
6. Schrijf in het Nederlands
7. Gebruik een professionele maar toegankelijke toon
8. GEEN "Met vriendelijke groet" of handtekening aan het einde`

    const userPrompt = `Genereer een overtuigende cold email template met deze bedrijfsinformatie:

BEDRIJF: ${companyInfo.companyName}
${companyInfo.companyDescription ? `BESCHRIJVING: ${companyInfo.companyDescription}` : ''}
PRODUCT/SERVICE: ${companyInfo.productService}
TARGET AUDIENCE: ${companyInfo.targetAudience}
${companyInfo.industry ? `INDUSTRIE: ${companyInfo.industry}` : ''}

UNIQUE SELLING POINTS:
${uspsText}

${companyInfo.calendlyLink ? `CALENDLY LINK: ${companyInfo.calendlyLink}` : ''}

Maak een email die:
- Een pakkende onderwerpregel heeft die nieuwsgierigheid wekt
- Een opening heeft die direct relevant is voor de target audience
- Een probleem of uitdaging adresseert die zij hebben
- Kort uitlegt hoe jullie kunnen helpen
- Eindigt met een zachte vraag of CTA (bij voorkeur link naar meeting als Calendly beschikbaar is)

BELANGRIJK: Geef ALLEEN een JSON object terug met exact deze structuur:
{
  "templateName": "[Beschrijvende naam voor template, bijv. 'Cold Email - Tech Startups']",
  "subject": "[Pakkende onderwerpregel zonder 'Re:']",
  "body": "[Complete email body - PLAIN TEXT, GEEN JSON, GEEN placeholders]",
  "tone": "[Beschrijving van de tone/stijl]",
  "targetSegment": "[Voor wie is deze template bedoeld]"
}

De body moet direct beginnen met de opening en eindigen na de CTA - ZONDER groet of handtekening.`

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
        max_tokens: 1500,
        temperature: 0.8, // Hoger voor meer creativiteit
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
      
      let errorMessage = 'AI service niet bereikbaar. '
      
      if (response.status === 401) {
        errorMessage += 'API key is ongeldig of verlopen. Vernieuw de CLAUDE_API_KEY in Supabase secrets.'
      } else if (response.status === 429) {
        errorMessage += 'Te veel verzoeken. Probeer het later opnieuw.'
      } else if (response.status === 400) {
        errorMessage += 'Ongeldig verzoek naar AI service. Check je bedrijfsinformatie.'
      } else {
        errorMessage += `Status ${response.status}. Check Supabase logs voor details.`
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()
    console.log('Claude API response received')

    const claudeResponse = data.content[0].text
    console.log('Claude response text:', claudeResponse.substring(0, 200))

    // Extract JSON from response
    let result: GeneratedTemplate
    try {
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        let jsonString = jsonMatch[0]
        
        // Fix common JSON issues from Claude:
        // 1. Replace actual newlines in string values with \n
        // 2. Replace actual tabs with \t
        // We need to be careful to only fix these inside string values, not in the JSON structure
        
        // First, let's try to parse and catch the specific error
        try {
          const parsed = JSON.parse(jsonString)
          result = {
            templateName: parsed.templateName || 'Cold Email Template',
            subject: parsed.subject || 'Nieuwe mogelijkheid voor uw bedrijf',
            body: parsed.body || claudeResponse,
            tone: parsed.tone || 'Professional',
            targetSegment: parsed.targetSegment || companyInfo.targetAudience,
          }
        } catch (initialError) {
          console.log('Initial parse failed, cleaning JSON string...')
          
          // Clean the JSON string by fixing newlines and control characters in string values
          // This regex finds string values and replaces control characters within them
          jsonString = jsonString.replace(/"([^"]+)":\s*"([^"]*(?:\\.[^"]*)*)"/g, (_match: string, key: string, value: string) => {
            // Fix control characters in the value
            const cleanValue = value
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
            return `"${key}": "${cleanValue}"`
          })
          
          console.log('Cleaned JSON string, attempting parse...')
          const parsed = JSON.parse(jsonString)
          
          result = {
            templateName: parsed.templateName || 'Cold Email Template',
            subject: parsed.subject || 'Nieuwe mogelijkheid voor uw bedrijf',
            body: parsed.body || claudeResponse,
            tone: parsed.tone || 'Professional',
            targetSegment: parsed.targetSegment || companyInfo.targetAudience,
          }
        }

        // Restore newlines in body for display
        if (result.body.includes('\\n')) {
          result.body = result.body.replace(/\\n/g, '\n')
        }

        console.log('Template generated:', {
          name: result.templateName,
          subjectLength: result.subject.length,
          bodyLength: result.body.length,
        })
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Attempted to parse:', claudeResponse.substring(0, 500))
      
      return new Response(
        JSON.stringify({
          error: 'AI response kon niet worden verwerkt. De AI heeft een ongeldig formaat teruggestuurd. Probeer het opnieuw.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in generate-cold-email-template function:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Onbekende fout'
    
    return new Response(
      JSON.stringify({
        error: `Template generatie mislukt: ${errorMessage}. Check Supabase logs voor meer details.`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
