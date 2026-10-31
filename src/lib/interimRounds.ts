import { supabase } from "@/integrations/supabase/client";

export type InterimRoundStatus = "pending" | "approved" | "declined";
export interface InterimRound {
  id?: string;
  round: number;
  status: string;
  interim_diagnosis?: string | null;
  ai_interim_report?: string | null;
  interim_warranty?: string | null;
  interim_summary?: string | null;
  interim_breakdown_text?: string | null;
  created_at?: string;
  decided_at?: string | null;
  decision_note?: string | null;
}

/** A new round may start only once every earlier round has a decision. */
export const canAddInterimRound = (rounds: readonly InterimRound[]): boolean =>
  rounds.length > 0 && !rounds.some((r) => r.status === "pending");

export const nextRound = (rounds: readonly InterimRound[]): number =>
  Math.max(0, ...rounds.map((r) => Number(r.round) || 0)) + 1;

export const latestRound = (rounds: readonly InterimRound[]): InterimRound | undefined =>
  [...rounds].sort((a, b) => b.round - a.round)[0];

export const fetchInterimRounds = async (serviceId: string): Promise<InterimRound[]> => {
  const { data } = await supabase.from("interim_reports").select("*").eq("service_id", serviceId).order("round");
  return (data || []) as InterimRound[];
};

interface Values { findings?: string; report?: string; warranty?: string; summary?: string; breakdown?: string }

/** Mirror the editor's content into the open (pending) round, creating round 1 if none exists. */
export const syncLatestInterimRound = async (serviceId: string, v: Values, approvedNow: boolean) => {
  const hasContent = !!(v.report || v.findings || v.breakdown || "").trim();
  const rounds = await fetchInterimRounds(serviceId);
  const open = rounds.find((r) => r.status === "pending");
  const payload = {
    interim_diagnosis: v.findings || null,
    ai_interim_report: v.report || null,
    interim_warranty: v.warranty || null,
    interim_summary: v.summary || null,
    interim_breakdown_text: v.breakdown || null,
    ...(approvedNow ? { status: "approved", decided_at: new Date().toISOString() } : {}),
  };
  if (open?.id) {
    await supabase.from("interim_reports").update(payload).eq("id", open.id);
  } else if (!rounds.length && hasContent) {
    const { data: me } = await supabase.rpc("get_my_name");
    await supabase.from("interim_reports").insert({ service_id: serviceId, round: 1, created_by_name: me, ...payload } as never);
  }
};

/** Start a fresh round: new pending row, and reset the ticket's working interim fields. */
export const startNextInterimRound = async (serviceId: string, rounds: InterimRound[]) => {
  const { data: me } = await supabase.rpc("get_my_name");
  const now = new Date().toISOString();
  const { error } = await supabase.from("interim_reports").insert({ service_id: serviceId, round: nextRound(rounds), status: "pending", created_by_name: me } as never);
  if (error) throw error;
  const { error: e2 } = await supabase.from("services").update({
    interim_needed: true, interim_diagnosis: null, ai_interim_report: null, interim_warranty: null,
    interim_summary: null, interim_breakdown_text: null, interim_approved_at: null, interim_created_at: now,
    approval_locked: false, last_updated: now,
  } as never).eq("service_id", serviceId);
  if (e2) throw e2;
};
