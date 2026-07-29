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
    .replace(/[""]/g, "")
    .replace(/['']/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/\r\n/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

// Clamp to at most 3 sentences.
const clampToThreeSentences = (s: string): string => {
  const matches = s.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) return s;
  return matches.slice(0, 3).join(" ").trim();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authResp = await requireAuth(req);
  if (authResp) return authResp;

  try {
    const { rawComplaint } = await req.json();
    if (!rawComplaint || typeof rawComplaint !== 'string') {
      return new Response(JSON.stringify({ error: 'rawComplaint is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an intake-note formatter for a device repair shop.

Rewrite the customer's chief complaint into a short, professional intake note that also helps the technician.

STRUCTURE (in order, plain text, one paragraph):
- Sentence 1: concise professional restatement of the complaint (no greeting, no labels).
- Sentence 2: brief likely context or probable cause, hedged with "Likely" or "Possibly". Do not diagnose with certainty.
- Sentence 3 (optional, only when clearly applicable): a first troubleshooting or repair direction, phrased as "Suggested check: ...".

STRICT RULES:
- Output ONLY the note. No headings, labels, bullets, numbering, greeting, or sign-off.
- Maximum 3 sentences total. Skip sentence 3 if not clearly helpful.
- Plain text only. No markdown, no quotes, no emoji.
- Do not invent model numbers, part numbers, prices, or symptoms the customer did not mention.
- Keep the original meaning. Neutral third-person phrasing.
- No em dashes; use regular hyphens.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Raw complaint:\n${rawComplaint}\n\nRewrite it now following the rules exactly.` },
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
      return new Response(JSON.stringify({ error: 'No formatted complaint received' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formatted = clampToThreeSentences(stripMarkdown(raw));

    return new Response(JSON.stringify({ formattedComplaint: formatted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
