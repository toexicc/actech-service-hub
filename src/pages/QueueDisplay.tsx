import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueueEntries, type QueueEntry } from "@/hooks/useQueueEntries";
import { Card } from "@/components/ui/card";
import { Clock, ArrowRight, CheckCircle2, ClipboardList, PackageCheck } from "lucide-react";
import acTechLogo from "@/assets/S_S_Marketing-2.png";

/**
 * One queue column. Styling stays intentionally simple (solid colors, no
 * backdrop filters or modern color functions) so the board renders correctly on
 * older TV browsers.
 */
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
  <div
    className={`rounded-2xl border-2 p-4 ${
      tone === "proceed" ? "border-emerald-300 bg-emerald-50" : "border-blue-300 bg-blue-50"
    }`}
  >
    <div className="flex items-center gap-2 mb-3">
      <div
        className={`h-9 w-9 rounded-xl grid place-items-center ${
          tone === "proceed" ? "bg-emerald-200 text-emerald-800" : "bg-blue-200 text-blue-800"
        }`}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-bold tracking-tight leading-none">{title}</h3>
        <p className="text-xs text-slate-600 mt-1">
          {entries.length} {entries.length === 1 ? "customer" : "customers"}
        </p>
      </div>
    </div>

    {entries.length === 0 ? (
      <div className="rounded-xl border-2 border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    ) : (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {entries.map((e) => {
          const isMine = highlightId === e.id;
          return (
            <div
              key={e.id}
              className={`rounded-xl border-2 p-3 text-center ${
                isMine
                  ? "border-blue-600 bg-blue-100"
                  : tone === "proceed"
                    ? "border-emerald-200 bg-white"
                    : "border-blue-200 bg-white"
              }`}
            >
              <div
                className={`text-3xl font-black tracking-tight tabular-nums ${
                  tone === "proceed" ? "text-emerald-700" : "text-blue-700"
                }`}
              >
                {e.display_code}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-700">{e.client_name}</div>
              <div className="truncate text-xs text-slate-500">
                {[e.brand, e.model].filter(Boolean).join(" ") || e.device_type || ""}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const Section = ({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card className="rounded-3xl border-2 border-slate-200 bg-white p-4 md:p-5 shadow-md">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white grid place-items-center">{icon}</div>
      <div>
        <h2 className="text-2xl font-black tracking-tight leading-none text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      </div>
    </div>
    <div className="grid gap-3 md:grid-cols-2">{children}</div>
  </Card>
);

const QueueDisplay = () => {
  const [params] = useSearchParams();
  const mine = params.get("entry");
  const { entries, loading, error } = useQueueEntries({ activeOnly: true });

  const groups = useMemo(() => {
    const byKind = (kind: string, status: string) =>
      entries.filter((e) => (e.kind ?? "intake") === kind && e.status === status);
    const my =
      (mine && entries.find((e) => e.display_code === mine || e.id === mine)) || null;
    return {
      intakeWaiting: byKind("intake", "waiting"),
      intakeProceed: byKind("intake", "proceed"),
      releaseWaiting: byKind("release", "waiting"),
      releaseProceed: byKind("release", "proceed"),
      myEntry: my,
    };
  }, [entries, mine]);

  const empty = (label: string) => (loading ? "Loading…" : label);

  return (
    <div className="min-h-screen bg-[#F5F8FF] p-3 md:p-6">
      <div className="mx-auto max-w-[1800px]">
        {error && (
          <div className="mb-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <img src={acTechLogo} alt="AC Tech Repair" className="h-12 object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-blue-700">Live Queue</h1>
              <p className="text-sm text-slate-600">
                Watch the board — you'll be called when your number moves to "Proceed to Front".
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-500">
            <div className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</div>
            <div>Auto-updating in real time</div>
          </div>
        </div>

        {groups.myEntry && (
          <Card className="mb-4 rounded-3xl border-2 border-blue-300 bg-blue-100 p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white grid place-items-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-blue-700 font-bold">
                  Your queue number
                </div>
                <div className="text-4xl font-black text-blue-700">{groups.myEntry.display_code}</div>
                <div className="text-sm text-slate-600 mt-1">
                  Status:{" "}
                  <span className="font-bold text-slate-900">
                    {groups.myEntry.status === "proceed" ? "Proceed to Front" : "Waiting"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <Section
            title="Intake"
            subtitle="Dropping off a device for repair"
            icon={<ClipboardList className="h-5 w-5" />}
          >
            <Column
              title="Waiting"
              tone="waiting"
              icon={<Clock className="h-5 w-5" />}
              entries={groups.intakeWaiting}
              emptyLabel={empty("No customers waiting")}
              highlightId={groups.myEntry?.id}
            />
            <Column
              title="Proceed to Front"
              tone="proceed"
              icon={<ArrowRight className="h-5 w-5" />}
              entries={groups.intakeProceed}
              emptyLabel={empty("No one called yet")}
              highlightId={groups.myEntry?.id}
            />
          </Section>

          <Section
            title="Release"
            subtitle="Picking up a completed device"
            icon={<PackageCheck className="h-5 w-5" />}
          >
            <Column
              title="Waiting"
              tone="waiting"
              icon={<Clock className="h-5 w-5" />}
              entries={groups.releaseWaiting}
              emptyLabel={empty("No customers waiting")}
              highlightId={groups.myEntry?.id}
            />
            <Column
              title="Proceed to Front"
              tone="proceed"
              icon={<ArrowRight className="h-5 w-5" />}
              entries={groups.releaseProceed}
              emptyLabel={empty("No one called yet")}
              highlightId={groups.myEntry?.id}
            />
          </Section>
        </div>
      </div>
    </div>
  );
};

export default QueueDisplay;
