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
Format the following raw diagnosis from a technician into a clear, professional service report.

CRITICAL FORMATTING RULES:
- Output PLAIN TEXT ONLY - no markdown, no bold, no italics, no headers with # symbols
- DO NOT use any emojis or special characters
- DO NOT include metadata headers like "Customer Concern Reported:", "Technical Findings:", "Device Type:", etc.
- DO NOT repeat customer information, device details, or service ID that's already in the form
- Start directly with the diagnosis content

Structure your response with simple text sections:
1. Issue Diagnosis: Brief explanation of what's wrong with the device
2. Recommended Service: List of specific services/repairs needed
3. Service Report: Detailed technical notes and findings

Keep language professional but customer-friendly. Be concise and actionable.
Use simple line breaks to separate sections. Use dashes (-) for lists if needed.` 
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
