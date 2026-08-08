import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, CheckCircle2, PackageCheck } from "lucide-react";
import acTechLogo from "@/assets/S_S_Marketing-2.png";

interface ReleaseSummary {
  service_id: string;
  client_name: string;
  contact_number: string | null;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  memory: string | null;
  service: string | null;
  status: string | null;
  chief_complaint: string | null;
  repair_time_frame: string | null;
  date_received: string | null;
}

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-sm font-medium break-words">{value?.trim() ? value : "—"}</p>
  </div>
);

/**
 * Public /release kiosk — a customer looks up their ticket, confirms the details
 * and joins the Release queue. Staff handle the actual release in-app.
 */
const PublicRelease = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState<ReleaseSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queueCode, setQueueCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!queueCode) return;
    setCountdown(12);
    const id = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(id);
          setQueueCode(null);
          setSummary(null);
          setQuery("");
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [queueCode]);

  const doSearch = async () => {
    const sid = query.trim().toUpperCase();
    if (!sid) return;
    setSearching(true);
    setSummary(null);
    try {
      const { data, error } = await supabase.rpc("public_release_summary" as any, {
        _service_id: sid,
      });
      if (error) throw new Error(error.message);
      if (!data) {
        toast({
          title: "Ticket not found",
          description: "Please check the Service ID on your receipt.",
          variant: "destructive",
        });
        return;
      }
      setSummary(data as unknown as ReleaseSummary);
    } catch (e) {
      toast({
        title: "Search failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const confirmRelease = async () => {
    if (!summary) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("queue_entries")
        .insert({
          kind: "release",
          client_name: summary.client_name,
          contact_number: summary.contact_number,
          device_type: summary.device_type,
          brand: summary.brand,
          model: summary.model,
          chief_complaint: summary.chief_complaint,
          service_id: summary.service_id,
          form_payload: summary as any,
        } as any)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setQueueCode((data as any).display_code);
    } catch (e) {
      toast({
        title: "Could not join the queue",
        description: e instanceof Error ? e.message : "Please approach the front desk.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (queueCode) {
    return (
      <div className="min-h-screen bg-[#F5F8FF] grid place-items-center p-6">
        <Card className="w-full max-w-md rounded-3xl border-emerald-300 bg-white/95 text-center shadow-[var(--shadow-elegant)]">
          <CardContent className="p-10 space-y-4">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <p className="text-sm uppercase tracking-wider font-semibold text-emerald-700">
              You're in the release queue
            </p>
            <div className="text-6xl font-black tracking-tight text-emerald-700">{queueCode}</div>
            <p className="text-sm text-muted-foreground">
              Please watch the queue board — you'll be called when your number moves to
              "Proceed to Front".
            </p>
            <p className="text-xs text-muted-foreground">Resetting in {countdown}s…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FF] p-4 md:p-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <img src={acTechLogo} alt="AC Tech Repair" className="h-12 object-contain" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-blue-700">Device Release</h1>
            <p className="text-sm text-muted-foreground">
              Enter your Service ID to confirm your details and join the release queue.
            </p>
          </div>
        </div>

        <Card className="rounded-3xl border-border/60 bg-white/95 shadow-[var(--shadow-elegant)]">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="release-sid">Service ID</Label>
              <div className="flex gap-2">
                <Input
                  id="release-sid"
                  placeholder="e.g. AC010826356"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  className="h-12 text-lg"
                />
                <Button className="h-12" onClick={doSearch} disabled={searching}>
                  <Search className="h-4 w-4 mr-1" />
                  {searching ? "Searching…" : "Search"}
                </Button>
              </div>
            </div>

            {summary && (
              <div className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Ticket</p>
                  <p className="text-xl font-bold text-blue-700">{summary.service_id}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Row label="Client" value={summary.client_name} />
                  <Row label="Contact" value={summary.contact_number} />
                  <Row
                    label="Device"
                    value={[summary.device_type, summary.brand, summary.model].filter(Boolean).join(" · ")}
                  />
                  <Row
                    label="Storage & Color"
                    value={[summary.memory, summary.color].filter(Boolean).join(" · ")}
                  />
                  <Row label="Service" value={summary.service} />
                  <Row label="Status" value={summary.status} />
                </div>

                <Button className="w-full h-12 text-base" onClick={confirmRelease} disabled={submitting}>
                  <PackageCheck className="h-5 w-5 mr-2" />
                  {submitting ? "Joining queue…" : "Confirm and join release queue"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicRelease;
