import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawDiagnosis } = await req.json();

    if (!rawDiagnosis) {
      return new Response(
        JSON.stringify({ error: 'Raw diagnosis is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Formatting diagnosis with OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: `You are a technical diagnosis formatter for AC Tech Repair PH.

CRITICAL OUTPUT RULES - YOU MUST FOLLOW EXACTLY:
1. Output ONLY plain text paragraphs - absolutely NO emojis, NO symbols, NO special characters
2. DO NOT add any labels or headers like "Customer Concern Reported:", "Technical Findings:", "Issue Diagnosis:", etc.
3. DO NOT include customer information (name, device type, model, service ID, technician) - this is already in the form
4. DO NOT use markdown formatting (no **, no ##, no bullets, no dashes)
5. DO NOT add footer text like "To proceed with the service" or "Professional Recommendations" or "SUMMARY"
6. Write in simple, continuous paragraphs separated by blank lines

Start directly with the diagnosis content. Write 2-3 clear paragraphs explaining:
- What is wrong with the device
- What repairs/services are needed
- Technical details and findings

Keep it professional, concise, and customer-friendly. Just plain text paragraphs, nothing else.` 
          },
          { 
            role: 'user', 
            content: `Raw diagnosis from technician:\n\n${rawDiagnosis}` 
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'OpenAI rate limit reached. Please wait and try again.' }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API quota exceeded. Please check your OpenAI account.' }),
          { 
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const formattedDiagnosis = data.choices[0].message.content;

    console.log('Successfully formatted diagnosis');

    return new Response(
      JSON.stringify({ formattedDiagnosis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in format-diagnosis function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
