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

// Deterministically strip any monetary amount the model invents inside the
// Service Breakdown section and replace it with the fill-in placeholder.
const stripDecor = (s: string) => s.replace(/[*_#>`]/g, "").trim();

const OTHER_SECTION =
  /^(to proceed|summary|recommendations?|findings?|cause of issue|cause|suggested solutions?|solution|note|notes|disclaimer|warranty)\b/i;

const AMOUNT_PLACEHOLDER = "Php {Enter Amount}";
const WARRANTY_PLACEHOLDER = "{Enter Warranty Duration}";

const isOptionLine = (s: string) => /^option\s+[a-z]\b/i.test(stripDecor(s));

const enforceAmountPlaceholders = (text: string): string => {
  const lines = String(text ?? "").split("\n");
  let inBreakdown = false;

  const out = lines.map((line, idx) => {
    const bare = stripDecor(line);

    // Enter the breakdown section on any heading mentioning it
    if (/^service breakdown\b/i.test(bare)) {
      inBreakdown = true;
      // Heading may carry the first item inline
      return line.replace(
        /(?:php|₱|p)?\s*\[?\{?\s*[\d,]+(?:\.\d{1,2})?\s*\}?\]?\s*$/i,
        AMOUNT_PLACEHOLDER,
      );
    }

    if (!inBreakdown) return line;

    if (bare === "") return line; // keep blank lines, stay in section
    if (OTHER_SECTION.test(bare)) {
      inBreakdown = false;
      return line;
    }

    let out = line;
    // Any currency-tagged amount -> placeholder
    out = out.replace(
      /(?:php|₱|p)\s*\[?\{?\s*[\d,]+(?:\.\d{1,2})?\s*\}?\]?/gi,
      AMOUNT_PLACEHOLDER,
    );
    // Bracketed placeholder variants
    out = out.replace(/php\s*[\[\(]\s*enter amount\s*[\]\)]/gi, AMOUNT_PLACEHOLDER);
    out = out.replace(/\{?\s*enter amount\s*\}?/gi, "{Enter Amount}");
    // Any remaining bare number anywhere on the line (e.g. "Screen replacement - 5,000"
    // or "Screen replacement 5000 pesos")
    out = out.replace(
      /(?<!\{)\b\d[\d,]*(?:\.\d{1,2})?\b\s*(?:php|pesos)?(?!\s*\})/gi,
      AMOUNT_PLACEHOLDER,
    );
    // Collapse duplicated placeholders and normalise prefix
    out = out.replace(/(?:Php\s*)?\{Enter Amount\}(?:\s*(?:Php\s*)?\{Enter Amount\})+/g, AMOUNT_PLACEHOLDER);
    out = out.replace(/(?<!Php )\{Enter Amount\}/g, AMOUNT_PLACEHOLDER);

    // A parent service line that is followed by Option lines carries no amount.
    if (!isOptionLine(line)) {
      let next = idx + 1;
      while (next < lines.length && stripDecor(lines[next]) === "") next++;
      const nextBare = next < lines.length ? stripDecor(lines[next]) : "";
      if (nextBare && !OTHER_SECTION.test(nextBare) && isOptionLine(nextBare)) {
        return out
          .replace(/(?:Php\s*)?\{Enter Amount\}/g, "")
          .replace(/[\s\-–:]+$/, "")
          .trimEnd();
      }
    }

    if (!out.includes(AMOUNT_PLACEHOLDER)) {
      out = `${out.replace(/[\s\-–:]+$/, "")} - ${AMOUNT_PLACEHOLDER}`;
    }
    return out;
  });

  return out.join("\n");
};

// Guarantee a "Warranty:" block right after the Service Breakdown block, with
// one line per quoted service: "<Service Name> - {Enter Warranty Duration}".
const breakdownServiceNames = (lines: string[]): string[] => {
  const idx = lines.findIndex((l) => /^service breakdown\b/i.test(stripDecor(l)));
  if (idx === -1) return [];
  const names: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const bare = stripDecor(lines[i]);
    if (bare === "") continue;
    if (OTHER_SECTION.test(bare)) break;
    if (/^option\s+[a-z]\b/i.test(bare)) continue;
    const name = bare
      .split(/\s+-\s*php/i)[0]
      .replace(/[-:]\s*$/, "")
      .trim();
    if (name) names.push(name);
  }
  return names;
};

const enforceWarrantyLine = (text: string): string => {
  const lines = String(text ?? "").split("\n");
  const names = breakdownServiceNames(lines);
  const block = [
    "Warranty:",
    ...(names.length ? names : ["Service"]).map((n) => `${n} - ${WARRANTY_PLACEHOLDER}`),
  ];

  // Drop whatever warranty block the model produced.
  const cleaned: string[] = [];
  let inWarranty = false;
  for (const line of lines) {
    const bare = stripDecor(line);
    if (/^warranty\s*:?/i.test(bare)) {
      inWarranty = true;
      continue;
    }
    if (inWarranty) {
      if (bare === "") continue;
      if (OTHER_SECTION.test(bare) && !/^warranty\b/i.test(bare)) inWarranty = false;
      else continue;
    }
    cleaned.push(line);
  }

  const headingIdx = cleaned.findIndex((l) => /^service breakdown\b/i.test(stripDecor(l)));
  if (headingIdx === -1) return cleaned.join("\n");

  let end = headingIdx + 1;
  while (end < cleaned.length) {
    const bare = stripDecor(cleaned[end]);
    if (bare === "") break;
    if (OTHER_SECTION.test(bare)) break;
    end++;
  }
  cleaned.splice(end, 0, "", ...block);
  return cleaned.join("\n");
};




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
<Service Item 1> - Php {Enter Amount}
<Service Item 2 with part grade choices>
Option A - OEM: Php {Enter Amount}
Option B - Original: Php {Enter Amount}


Warranty:
<Service Item 1> - {Enter Warranty Duration}
<Service Item 2> - {Enter Warranty Duration}



To proceed with the service, PROCEED or APPROVE to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions
Note: The quoted price excludes 12% VAT.

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
CRITICAL PRICING RULE: Never invent, estimate, or guess any monetary amount. For every Service Breakdown line item the price MUST be the literal placeholder "Php {Enter Amount}" so the technician fills it in. Do NOT output any numeric peso amount under any circumstance.
List every Service Breakdown item on its own line in the format "<Service Name> - Php {Enter Amount}".
When a service can be done with different part grades or variants (for example a battery or screen available as OEM and Original), write the service name alone on its line, then list each variant on the following lines in the exact format "Option A - <Variant>: Php {Enter Amount}", "Option B - <Variant>: Php {Enter Amount}". Never put an amount on the parent service line in that case.
Immediately after the Service Breakdown items output a "Warranty:" heading, then one line per quoted service in the exact format "<Service Name> - {Enter Warranty Duration}". Never invent a warranty duration.
After the "To proceed with the service..." line, always add the literal line "Note: The quoted price excludes 12% VAT." on its own line.

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

    let formattedDiagnosis = stripMarkdown(raw);
    formattedDiagnosis = enforceAmountPlaceholders(formattedDiagnosis);
    formattedDiagnosis = enforceWarrantyLine(formattedDiagnosis);

    return new Response(JSON.stringify({ formattedDiagnosis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
