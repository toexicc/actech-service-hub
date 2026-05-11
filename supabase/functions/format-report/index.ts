import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const apiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { technicianReport, customerName, deviceType, model, serviceId, finalCost, serviceCost } = await req.json();

    if (!technicianReport) {
      return new Response(
        JSON.stringify({ error: 'Technician report is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const costToDisplay = finalCost || serviceCost || '0';

    const systemPrompt = `You are formatting a service report for AC Tech Repair PH.

Format the following information into a customer-friendly service report.

STRICT FORMAT:

Customer Name: [name]
Device Type: [type]
Model: [model]
Service ID: [id]

AC TECH SERVICE REPORT

Work Performed:
[Clear description of repairs and services completed]

Technical Findings:
[Detailed technical observations and results]

Final Status:
[Current condition of the device]

Recommendations:
[Professional advice for device maintenance and care]

Service Cost: Php [serviceCost]

To finalize the service, please reply PROCEED to confirm your approval and kindly review our Terms and Conditions:
bit.ly/actech-termsnconditions

WRITING RULES:
- Friendly, professional, and customer-oriented
- Straight to the point
- Use simple and easy-to-understand language
- Formal service report style
- Plain text only
- No markdown formatting (no **, no __, no #)
- No bullet points
- No em dashes, use regular hyphens or commas instead
- No quotation marks unless necessary
- Use clear section labels`;

    const userPrompt = `Customer: ${customerName}
Device: ${deviceType} (${model})
Service ID: ${serviceId}
Service Cost: Php ${costToDisplay}

Raw Service Report:
${technicianReport}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const formattedReport = String(data.choices[0].message.content || "")
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/^#+\s*/gm, "")
      .replace(/—/g, "-");

    return new Response(
      JSON.stringify({ formattedReport }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in format-report function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
