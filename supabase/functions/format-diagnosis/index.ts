import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

async function requireAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return null;
}


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

  const authResp = await requireAuth(req);
  if (authResp) return authResp;

  try {
    const { rawDiagnosis, customerName, deviceType, model, serviceId } = await req.json();
    if (!rawDiagnosis) {
      return new Response(JSON.stringify({ error: 'Raw diagnosis is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a professional technical diagnostician for AC Tech Repair PH.

You will reformat raw technician notes into a customer-friendly diagnosis report.

You MUST output the report using EXACTLY the template below, in the same order, with the same labels, and with the same blank lines between sections. Do NOT add any greeting, sign-off, headers, sections, or commentary that are not in the template. Do NOT change the wording of any label.

EXACT OUTPUT TEMPLATE (replace bracketed values, keep everything else verbatim):

Customer Name: <customerName>
Device Type: <deviceType>
Model: <model>
Service ID: <serviceId>

AC TECH DEVICE DIAGNOSIS

Findings:
<clear explanation of what was found during inspection>

Cause of Issue:
<simple explanation of the root cause>

Suggested Solution:
<specific repair actions needed>

Recommendations:
<professional advice for the customer>

Service Breakdown:
<Service Item 1> - Php [Enter Amount]
<Service Item 2> - Php [Enter Amount]

To proceed with the service, PROCEED or APPROVE to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions

SUMMARY: <one-line summary of the repair needed>

WRITING RULES:
Friendly, professional, and customer-oriented.
Straight to the point.
Use simple and easy-to-understand language.
Formal quotation style.
Plain text only.
No markdown formatting at all. Never output **, __, ##, backticks, asterisks, or any markdown.
No bullet points or numbered lists.
No em dashes. Use regular hyphens only.
No quotation marks unless necessary.
CRITICAL PRICING RULE: Never invent, estimate, or guess any monetary amount. For every Service Breakdown line item the price MUST be the literal placeholder "Php [Enter Amount]" so the technician fills it in. Do NOT output any numeric peso amount under any circumstance.
List every Service Breakdown item on its own line in the format "<Service Name> - Php [Enter Amount]".
Use the exact section labels and order shown in the template. Do not add or remove sections.`;

    const userPrompt = `customerName: ${customerName || ''}
deviceType: ${deviceType || ''}
model: ${model || ''}
serviceId: ${serviceId || ''}

Raw technician notes:
${rawDiagnosis}

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
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status} ${errorText}` }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return new Response(JSON.stringify({ error: 'No formatted diagnosis received' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formattedDiagnosis = stripMarkdown(raw);

    return new Response(JSON.stringify({ formattedDiagnosis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
