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
    const { technicianReport, customerName, deviceType, model, serviceId, technician } = await req.json();

    if (!technicianReport) {
      return new Response(
        JSON.stringify({ error: 'Technician report is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Formatting service report with OpenAI...');

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
            content: `You are a professional technician at AC Tech Repair PH. Write a clear, concise service report for device release.

Format your report using this EXACT structure:

Customer Name: [name]
Device Type: [type]
Model: [model]
Service ID: [id]
Technician: [technician]

AC TECH DEVICE REPORT | READY FOR RELEASE

Service Performed:
[1-2 sentences - what was done to fix the device]

Recommendation:
[1 sentence - professional advice for the customer]

IMPORTANT RULES:
- Be concise, professional, and customer-friendly
- Maximum 1-2 sentences per section
- Use technical terms but keep it understandable
- NO emojis or special symbols
- Focus on clarity and professionalism` 
          },
          { 
            role: 'user', 
            content: `Customer Name: ${customerName}
Device Type: ${deviceType}
Model: ${model}
Service ID: ${serviceId}
Technician: ${technician}

Raw technician report:
${technicianReport}` 
          }
        ],
        max_completion_tokens: 1500,
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
    const formattedReport = data.choices[0].message.content;

    console.log('Successfully formatted service report');

    return new Response(
      JSON.stringify({ formattedReport }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in format-report function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
