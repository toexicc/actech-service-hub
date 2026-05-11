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
    const { rawDiagnosis, customerName, deviceType, model, serviceId } = await req.json();

    if (!rawDiagnosis) {
      return new Response(
        JSON.stringify({ error: 'Raw diagnosis is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a professional technical diagnostician for AC Tech Repair PH.

Format the following information into a customer-friendly diagnosis report.

STRICT FORMAT:

Customer Name: [name]
Device Type: [type]
Model: [model]
Service ID: [id]

AC TECH DEVICE DIAGNOSIS

Findings:
[Clear explanation of what was found during inspection]

Cause of Issue:
[Simple explanation of the root cause]

Suggested Solution:
[Specific repair actions needed]

Recommendations:
[Professional advice for the customer]

Service Breakdown:
[List every service item on a separate line.
Always use this exact price format: Php {Enter Amount}

Example:
LCD Replacement - Php {Enter Amount}
Battery Replacement - Php {Enter Amount}]

To proceed with the service, please reply PROCEED to confirm your approval and kindly review our Terms and Conditions:
bit.ly/actech-termsnconditions

SUMMARY: [One-line summary of the repair needed]

WRITING RULES:
- Friendly, professional, and customer-oriented
- Straight to the point
- Use simple and easy-to-understand language
- Formal quotation style
- Plain text only
- No markdown formatting (no **, no __, no #)
- No bullet points
- No em dashes, use regular hyphens only
- No quotation marks unless necessary
- Use clear section labels`;

    const userPrompt = `Customer: ${customerName || ''}
Device: ${deviceType || ''} (${model || ''})
Service ID: ${serviceId || ''}

Raw Notes:
${rawDiagnosis}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Strip any stray markdown the model may have produced
    const clean = String(formattedDiagnosis)
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/^#+\s*/gm, "")
      .replace(/—/g, "-");

    return new Response(
      JSON.stringify({ formattedDiagnosis: clean }),
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
