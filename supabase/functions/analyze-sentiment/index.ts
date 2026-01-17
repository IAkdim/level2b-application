// supabase/functions/analyze-sentiment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body first
    const { emailBody, emailSubject } = await req.json()

    if (!emailBody || !emailSubject) {
      return new Response(
        JSON.stringify({ error: 'Missing emailBody or emailSubject' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Processing sentiment analysis request...')

    // Call Claude API directly (no SDK needed)
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('CLAUDE_API_KEY') ?? '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Analyseer de sentiment van deze email reactie op een sales/outreach email.

Email onderwerp: ${emailSubject}
Email inhoud: ${emailBody}

Classificeer de sentiment in één van deze categorieën:

1. NEGATIVE - De persoon is duidelijk niet geïnteresseerd
2. NEUTRAL - De persoon twijfelt of toont beperkte interesse
3. POSITIVE - De persoon is duidelijk geïnteresseerd

Geef je antwoord in JSON format:
{
  "sentiment": "NEGATIVE" | "NEUTRAL" | "POSITIVE",
  "confidence": 0.0-1.0,
  "reasoning": "Korte uitleg waarom je deze classificatie hebt gekozen"
}`
        }]
      })
    })

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.status}`)
    }

    const claudeData = await claudeResponse.json()
    
    // Parse response
    const content = claudeData.content[0].text
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Map sentiment
    const sentimentMap: Record<string, string> = {
      NEGATIVE: 'negative',
      NEUTRAL: 'neutral',
      POSITIVE: 'positive',
    }

    const result = {
      sentiment: sentimentMap[parsed.sentiment] || 'neutral',
      confidence: parsed.confidence || 0.7,
      reasoning: parsed.reasoning || '',
    }

    // Log usage (without sensitive data)
    console.log(`Sentiment analyzed: ${result.sentiment} (${result.confidence})`)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        sentiment: 'doubtful',
        confidence: 0.5,
        reasoning: 'Error occurred during analysis',
      }),
      {
        status: 200, // Return 200 with fallback
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
