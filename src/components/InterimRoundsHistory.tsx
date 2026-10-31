import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { canAddInterimRound, fetchInterimRounds, InterimRound, latestRound, startNextInterimRound } from "@/lib/interimRounds";

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "2-digit", day: "2-digit", year: "numeric" }) : "";

interface Props {
  serviceId: string;
  canAdd: boolean;
  /** Bumps when the parent saves, so the list re-reads. */
  refreshKey?: unknown;
  onStarted?: () => void;
}

export const InterimRoundsHistory = ({ serviceId, canAdd, refreshKey, onStarted }: Props) => {
  const { toast } = useToast();
  const [rounds, setRounds] = useState<InterimRound[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { fetchInterimRounds(serviceId).then(setRounds); }, [serviceId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const latest = latestRound(rounds);
  const earlier = rounds.filter((r) => r !== latest || r.status !== "pending");
  if (!rounds.length) return null;

  const start = async () => {
    if (!window.confirm(`Start Interim Report round ${(latest?.round || 0) + 1}? The editor below is cleared for the new findings; earlier rounds stay in history.`)) return;
    setBusy(true);
    try {
      await startNextInterimRound(serviceId, rounds);
      toast({ title: "New interim round started", description: "Fill in the findings, then send it for approval." });
      load();
      onStarted?.();
    } catch (e: any) {
      toast({ title: "Could not start a new round", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Interim report rounds</p>
        {canAdd && canAddInterimRound(rounds) && (
          <Button size="sm" variant="outline" disabled={busy} onClick={start}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Add another interim report
          </Button>
        )}
      </div>
      {earlier.map((r) => (
        <details key={r.round} className="rounded-md bg-muted/40 p-2 text-sm">
          <summary className="cursor-pointer">
            Round {r.round} · {fmt(r.created_at)} ·{" "}
            <Badge variant={r.status === "declined" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
            {r.decided_at && <span className="text-muted-foreground"> on {fmt(r.decided_at)}</span>}
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs">{r.ai_interim_report || r.interim_diagnosis || "(no report text)"}</pre>
          {r.decision_note && <p className="mt-1 text-xs text-destructive">Reason: {r.decision_note}</p>}
        </details>
      ))}
      {latest?.status === "pending" && <p className="text-xs text-muted-foreground">Round {latest.round} is open in the editor below.</p>}
    </div>
  );
};
