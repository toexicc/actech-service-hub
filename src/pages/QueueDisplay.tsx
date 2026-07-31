import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueueEntries, type QueueEntry } from "@/hooks/useQueueEntries";
import { Card } from "@/components/ui/card";
import { Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import acTechLogo from "@/assets/S_S_Marketing-2.png";

const Column = ({
  title,
  tone,
  icon,
  entries,
  emptyLabel,
  highlightId,
}: {
  title: string;
  tone: "waiting" | "proceed";
  icon: React.ReactNode;
  entries: QueueEntry[];
  emptyLabel: string;
  highlightId?: string | null;
}) => (
  <Card
    className={`rounded-3xl border p-6 bg-white/90 shadow-[var(--shadow-elegant)] ${
      tone === "proceed" ? "border-emerald-300/50" : "border-blue-300/50"
    }`}
  >
    <div className="flex items-center gap-3 mb-5">
      <div
        className={`h-11 w-11 rounded-2xl grid place-items-center ${
          tone === "proceed"
            ? "bg-emerald-500/15 text-emerald-600"
            : "bg-blue-500/15 text-blue-600"
        }`}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "customer" : "customers"}
        </p>
      </div>
    </div>

    {entries.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-border/50 py-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {entries.map((e) => {
          const isMine = highlightId === e.id;
          return (
            <div
              key={e.id}
              className={`rounded-2xl border p-4 text-center transition-all ${
                isMine
                  ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-400 scale-105"
                  : tone === "proceed"
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-blue-200 bg-blue-50/60"
              }`}
            >
              <div
                className={`text-3xl font-black tracking-tight ${
                  tone === "proceed" ? "text-emerald-600" : "text-blue-600"
                }`}
              >
                {e.display_code}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-foreground/80">
                {e.client_name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {[e.brand, e.model].filter(Boolean).join(" ") || e.device_type || ""}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </Card>
);

const QueueDisplay = () => {
  const [params] = useSearchParams();
  const mine = params.get("entry");
  const { entries, loading, error } = useQueueEntries({ activeOnly: true });

  const { waiting, proceed, myEntry } = useMemo(() => {
    const w = entries.filter((e) => e.status === "waiting");
    const p = entries.filter((e) => e.status === "proceed");
    const my =
      (mine && entries.find((e) => e.display_code === mine || e.id === mine)) ||
      null;
    return { waiting: w, proceed: p, myEntry: my };
  }, [entries, mine]);

  return (
    <div className="min-h-screen bg-[#F5F8FF] p-4 md:p-10">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <img src={acTechLogo} alt="AC Tech Repair" className="h-12 object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-blue-700">
                Live Queue
              </h1>
              <p className="text-sm text-muted-foreground">
                Please watch the board — you'll be called when your number moves to
                "Proceed to Front".
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="font-medium text-foreground">
              {new Date().toLocaleDateString()}
            </div>
            <div>Auto-updating in real time</div>
          </div>
        </div>

        {myEntry && (
          <Card className="mb-6 rounded-3xl border-blue-300 bg-blue-500/10 backdrop-blur-xl p-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white grid place-items-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <div className="text-sm uppercase tracking-wider text-blue-700 font-semibold">
                  Your queue number
                </div>
                <div className="text-4xl font-black text-blue-700">
                  {myEntry.display_code}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Status:{" "}
                  <span className="font-semibold text-foreground">
                    {myEntry.status === "proceed"
                      ? "Proceed to Front"
                      : "Waiting"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Column
            title="Waiting"
            tone="waiting"
            icon={<Clock className="h-5 w-5" />}
            entries={waiting}
            emptyLabel={loading ? "Loading…" : "No customers waiting"}
            highlightId={myEntry?.id}
          />
          <Column
            title="Proceed to Front"
            tone="proceed"
            icon={<ArrowRight className="h-5 w-5" />}
            entries={proceed}
            emptyLabel={loading ? "Loading…" : "No one called yet"}
            highlightId={myEntry?.id}
          />
        </div>
      </div>
    </div>
  );
};

export default QueueDisplay;
