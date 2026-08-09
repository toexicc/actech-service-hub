import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueueEntries, moveQueueEntry, type QueueEntry } from "@/hooks/useQueueEntries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IntakeQueuePanel } from "@/components/IntakeQueuePanel";
import { ReleaseQueuePanel } from "@/components/ReleaseQueuePanel";
import { CompleteIntakeModal } from "@/components/CompleteIntakeModal";
import { ConfirmReleaseModal } from "@/components/ConfirmReleaseModal";

import {
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
} from "lucide-react";

const Tile = ({
  entry,
  tone,
  onMove,
  onComplete,
  onCancel,
  completeTitle = "Complete intake",
}: {
  entry: QueueEntry;
  tone: "waiting" | "proceed";
  onMove: () => void;
  onComplete: () => void;
  onCancel: () => void;
  completeTitle?: string;
}) => (
  <div
    className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 ${
      tone === "proceed"
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-blue-200 bg-blue-50/60"
    }`}
  >

    <div
      className={`shrink-0 rounded-md px-2 py-1 text-sm font-black tabular-nums ${
        tone === "proceed"
          ? "bg-emerald-600/10 text-emerald-700"
          : "bg-blue-600/10 text-blue-700"
      }`}
    >
      {entry.display_code}
    </div>

    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium leading-tight">
        {entry.client_name}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {[entry.device_type, entry.brand, entry.model].filter(Boolean).join(" • ")}
        </span>
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {entry.service_id ? `${entry.service_id} — ` : ""}
        {entry.contact_number ? `📞 ${entry.contact_number}` : ""}
        {entry.chief_complaint ? `${entry.contact_number ? " — " : ""}${entry.chief_complaint}` : ""}
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        title={tone === "waiting" ? "Proceed to front" : "Back to waiting"}
        onClick={onMove}
      >
        {tone === "waiting" ? (
          <ArrowRight className="h-4 w-4 text-emerald-600" />
        ) : (
          <ArrowLeft className="h-4 w-4" />
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        title={completeTitle}
        onClick={onComplete}
      >
        <CheckCircle2 className="h-4 w-4 text-blue-600" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
        title="Cancel"
        onClick={onCancel}
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </div>
  </div>
);


const QueueAdmin = () => {
  const { entries, loading, error, refetch, realtimeState, realtimeMessage } =
    useQueueEntries({ activeOnly: true });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("queue");
  const [completing, setCompleting] = useState<QueueEntry | null>(null);
  const [releasing, setReleasing] = useState<QueueEntry | null>(null);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.display_code.toLowerCase().includes(q) ||
        e.client_name.toLowerCase().includes(q) ||
        (e.contact_number || "").toLowerCase().includes(q),
    );
  }, [entries, search]);

  const ofKind = (kind: "intake" | "release", status: "waiting" | "proceed") =>
    filtered.filter((e) => (e.kind ?? "intake") === kind && e.status === status);
  const waiting = ofKind("intake", "waiting");
  const proceed = ofKind("intake", "proceed");
  const releaseWaiting = ofKind("release", "waiting");
  const releaseProceed = ofKind("release", "proceed");

  const doMove = async (id: string, status: "waiting" | "proceed") => {
    const { error } = await moveQueueEntry(id, status);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    }
  };

  const doCancel = async (id: string) => {
    if (!confirm("Cancel this queue entry? It will be removed from the board.")) return;
    const { error } = await moveQueueEntry(id, "cancelled");
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cancelled", description: "Queue entry removed." });
    }
  };

  const doRelease = (entry: QueueEntry) => {
    // Confirm the hand-over in a modal so it lands in the ticket activity log.
    setReleasing(entry);
  };


  const doComplete = (entry: QueueEntry) => {
    // Finish the intake in a modal so the admin never leaves the console.
    setCompleting(entry);
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in pb-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-bold">Queue Console</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage the customer queue and turn public intake submissions into full services.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => window.open("/queue", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" /> Open Public Board
              </Button>
            </div>
          </CardHeader>
          {(realtimeMessage || error) && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                <span>{error ?? realtimeMessage}</span>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Refresh now
                </Button>
              </div>
            </CardContent>
          )}
        </Card>



        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="queue">Intake &amp; Release Queue</TabsTrigger>
            <TabsTrigger value="intake">Intake Records</TabsTrigger>
            <TabsTrigger value="release-records">Release Records</TabsTrigger>
          </TabsList>


          <TabsContent value="queue" className="space-y-6">
            <Tabs defaultValue="intake-board" className="space-y-6">
              <TabsList className="flex flex-wrap gap-1">
                <TabsTrigger value="intake-board">Intake</TabsTrigger>
                <TabsTrigger value="release-board">Release</TabsTrigger>
              </TabsList>

              <TabsContent value="intake-board" className="space-y-6">

            <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4">
              <div className="text-sm font-semibold text-blue-700">Intake Queue</div>
              <p className="text-xs text-muted-foreground">
                Customers who submitted the public /intake form to drop off their device. Call them
                to the front, then mark the entry served.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, number, phone"
                  className="pl-8 w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open("/intake", "_blank")}>
                <ExternalLink className="h-4 w-4 mr-1" /> Open Intake Kiosk
              </Button>
            </div>


            <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
              <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-blue-600" /> Waiting ({waiting.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  {waiting.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No one is waiting."}
                    </div>
                  ) : (
                    <div className="grid min-w-0 gap-3">
                      {waiting.map((e) => (
                        <Tile
                          key={e.id}
                          entry={e}
                          tone="waiting"
                          onMove={() => doMove(e.id, "proceed")}
                          onComplete={() => doComplete(e)}
                          onCancel={() => doCancel(e.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ArrowRight className="h-5 w-5 text-emerald-600" /> Proceed to Front (
                    {proceed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  {proceed.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No one called yet."}
                    </div>
                  ) : (
                    <div className="grid min-w-0 gap-3">
                      {proceed.map((e) => (
                        <Tile
                          key={e.id}
                          entry={e}
                          tone="proceed"
                          onMove={() => doMove(e.id, "waiting")}
                          onComplete={() => doComplete(e)}
                          onCancel={() => doCancel(e.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
              </TabsContent>

              <TabsContent value="release-board" className="space-y-6">

            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4">
              <div className="text-sm font-semibold text-emerald-700">Release Queue</div>
              <p className="text-xs text-muted-foreground">
                Customers who looked up their ticket on the public /release page to pick up their
                device. Call them to the front, then mark the entry released.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, number, phone"
                  className="pl-8 w-64"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open("/release", "_blank")}>
                <ExternalLink className="h-4 w-4 mr-1" /> Open Release Kiosk
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
              <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-blue-600" /> Waiting ({releaseWaiting.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  {releaseWaiting.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No one is waiting for release."}
                    </div>
                  ) : (
                    <div className="grid min-w-0 gap-3">
                      {releaseWaiting.map((e) => (
                        <Tile
                          key={e.id}
                          entry={e}
                          tone="waiting"
                          completeTitle="Mark released"
                          onMove={() => doMove(e.id, "proceed")}
                          onComplete={() => doRelease(e)}
                          onCancel={() => doCancel(e.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ArrowRight className="h-5 w-5 text-emerald-600" /> Proceed to Front (
                    {releaseProceed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  {releaseProceed.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No one called yet."}
                    </div>
                  ) : (
                    <div className="grid min-w-0 gap-3">
                      {releaseProceed.map((e) => (
                        <Tile
                          key={e.id}
                          entry={e}
                          tone="proceed"
                          completeTitle="Mark released"
                          onMove={() => doMove(e.id, "waiting")}
                          onComplete={() => doRelease(e)}
                          onCancel={() => doCancel(e.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
              </TabsContent>
            </Tabs>
          </TabsContent>


          <TabsContent value="intake">
            <IntakeQueuePanel />
          </TabsContent>

          <TabsContent value="release-records">
            <ReleaseQueuePanel />
          </TabsContent>
        </Tabs>

        <ConfirmReleaseModal
          entry={releasing}
          onOpenChange={(open) => !open && setReleasing(null)}
          onReleased={() => refetch()}
        />

        <CompleteIntakeModal
          queueId={completing?.id ?? null}
          displayCode={completing?.display_code}
          onOpenChange={(open) => !open && setCompleting(null)}
          onCompleted={() => {
            toast({ title: "Intake completed", description: "Service created and queue cleared." });
            refetch();
          }}
        />


      </div>
    </div>
  );
};

export default QueueAdmin;
