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
}: {
  entry: QueueEntry;
  tone: "waiting" | "proceed";
  onMove: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) => (
  <div
    className={`rounded-2xl border p-4 backdrop-blur-md ${
      tone === "proceed"
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-blue-200 bg-blue-50/60"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div
          className={`text-2xl font-black leading-none ${
            tone === "proceed" ? "text-emerald-600" : "text-blue-600"
          }`}
        >
          {entry.display_code}
        </div>
        <div className="mt-1 text-sm font-medium">{entry.client_name}</div>
        <div className="text-xs text-muted-foreground">
          {[entry.device_type, entry.brand, entry.model].filter(Boolean).join(" • ") || "—"}
        </div>
        {entry.contact_number && (
          <div className="text-xs text-muted-foreground">📞 {entry.contact_number}</div>
        )}
        {entry.chief_complaint && (
          <div className="text-xs text-foreground/70 mt-2 line-clamp-2">
            "{entry.chief_complaint}"
          </div>
        )}
      </div>
      <Badge
        variant="outline"
        className={
          tone === "proceed"
            ? "border-emerald-400 text-emerald-700"
            : "border-blue-400 text-blue-700"
        }
      >
        {tone === "proceed" ? "Proceed" : "Waiting"}
      </Badge>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2">
      {tone === "waiting" ? (
        <Button size="sm" onClick={onMove} className="bg-emerald-600 hover:bg-emerald-700">
          <ArrowRight className="h-3.5 w-3.5 mr-1" /> Proceed
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onMove}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Waiting
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={onComplete}>
        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete Intake
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
        className="col-span-2 text-destructive hover:text-destructive"
      >
        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
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

  const waiting = filtered.filter((e) => e.status === "waiting");
  const proceed = filtered.filter((e) => e.status === "proceed");

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

  const doComplete = (id: string) => {
    // Send admin to the internal Client Intake Form pre-filled from the queue payload.
    navigate(`/service-form?queueId=${id}`);
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
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="intake">Intake</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-6">
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
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/60 bg-[hsl(var(--surface-glass))] backdrop-blur-xl shadow-[var(--shadow-elegant)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-blue-600" /> Waiting ({waiting.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {waiting.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No one is waiting."}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {waiting.map((e) => (
                        <Tile
                          key={e.id}
                          entry={e}
                          tone="waiting"
                          onMove={() => doMove(e.id, "proceed")}
                          onComplete={() => doComplete(e.id)}
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
                <CardContent>
                  {proceed.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No one called yet."}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {proceed.map((e) => (
                        <Tile
                          key={e.id}
                          entry={e}
                          tone="proceed"
                          onMove={() => doMove(e.id, "waiting")}
                          onComplete={() => doComplete(e.id)}
                          onCancel={() => doCancel(e.id)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="intake">
            <IntakeQueuePanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default QueueAdmin;
