import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawDiagnosis, customerName, deviceType, model, serviceId, technician } = await req.json();

    if (!rawDiagnosis) {
      return new Response(
        JSON.stringify({ error: 'Raw diagnosis is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            content: `You are a professional technician at AC Tech Repair PH. Write a clear, concise diagnostic report in a formal quotation style.

Format your report using this EXACT structure:

AC TECH DEVICE DIAGNOSIS

Findings:
[1-2 sentences - specific technical issues found]

Cause of Issue:
[1 sentence - why it failed]

Suggested Solution:
[1-2 sentences - repair needed and outcome]

Recommendations:
[1 sentence - professional advice]

---

To proceed with the service, please reply "YES" to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions

---

SUMMARY: [One clear sentence that condenses the Suggested Solution - state exactly what repair/service will be done]

IMPORTANT RULES:
- Be concise, professional, and customer-friendly
- Maximum 1-2 sentences per section
- Use technical terms but keep it understandable
- NO emojis or special symbols
- Do NOT include customer name, device, model, service ID, or technician
- Do NOT include "Customer Concern Reported" section
- Focus on clarity and professionalism
- The SUMMARY must be a condensed version of the Suggested Solution
- ALWAYS include the terms/conditions footer and summary exactly as shown above`
          },
          {
            role: 'user',
            content: `Raw diagnosis from technician:\n\n${rawDiagnosis}`
          }
        ],
        max_completion_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit reached. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API quota exceeded' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const formattedDiagnosis = data.choices?.[0]?.message?.content;

    if (!formattedDiagnosis) {
      return new Response(
        JSON.stringify({ error: 'No formatted diagnosis received' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build complete diagnosis with customer info
    const completeReport = [
      `Customer Name: ${customerName || ''}`,
      `Device Type: ${deviceType || ''}`,
      `Model: ${model || ''}`,
      `Service ID: ${serviceId || ''}`,
      `Technician: ${technician || 'Not assigned'}`,
      '',
      formattedDiagnosis
    ].join('\n');

    console.log('Successfully formatted diagnosis');

    return new Response(
      JSON.stringify({ formattedDiagnosis: completeReport }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in format-diagnosis function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
