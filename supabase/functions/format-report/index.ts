import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const apiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripMarkdown = (s: string): string =>
  String(s ?? "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[“”]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { technicianReport, customerName, deviceType, model, serviceId, finalCost, serviceCost } = await req.json();
    if (!technicianReport) {
      return new Response(JSON.stringify({ error: 'Technician report is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const costToDisplay = finalCost || serviceCost || '0';

    const systemPrompt = `You are formatting a service report for AC Tech Repair PH.

You will reformat raw technician notes into a customer-friendly service report.

You MUST output the report using EXACTLY the template below, in the same order, with the same labels, and with the same blank lines between sections. Do NOT add any greeting, sign-off, headers, sections, or commentary that are not in the template. Do NOT change the wording of any label.

EXACT OUTPUT TEMPLATE (replace bracketed values, keep everything else verbatim):

Customer Name: <customerName>
Device Type: <deviceType>
Model: <model>
Service ID: <serviceId>

AC TECH SERVICE REPORT

Work Performed:
<clear description of repairs and services completed>

Technical Findings:
<detailed technical observations and results>

Final Status:
<current condition of the device>

Recommendations:
<professional advice for device maintenance and care>

Service Cost: Php <serviceCost>

WRITING RULES:
Friendly, professional, and customer-oriented.
Straight to the point.
Use simple and easy-to-understand language.
Formal service report style.
Plain text only.
No markdown formatting at all. Never output **, __, ##, backticks, asterisks, or any markdown.
No bullet points or numbered lists.
No em dashes. Use regular hyphens or commas instead.
No quotation marks unless necessary.
Use the exact section labels and order shown in the template. Do not add or remove sections.
The Service Cost line must read exactly: Service Cost: Php <amount> (use a plain number).`;

    const userPrompt = `customerName: ${customerName || ''}
deviceType: ${deviceType || ''}
model: ${model || ''}
serviceId: ${serviceId || ''}
serviceCost: ${costToDisplay}

Raw technician report:
${technicianReport}

Produce the report now using the EXACT template. Do not include this instruction in your output.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const formattedReport = stripMarkdown(data.choices?.[0]?.message?.content || "");

    return new Response(JSON.stringify({ formattedReport }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
