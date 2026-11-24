import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { isClosedStatus } from "@/lib/serviceStatus";
import { isPartsLocked } from "@/lib/partRequests";
import { PartsUsedPanel } from "@/components/workspace/PartsUsedPanel";

interface TicketRow {
  service_id: string;
  client_name: string | null;
  brand: string | null;
  model: string | null;
  device_type: string | null;
  status: string | null;
  parts_used: string[] | null;
}

const TICKET_COLS = "service_id, client_name, brand, model, device_type, status, parts_used";

// PostgREST filter syntax uses commas and brackets, so keep only plain search text.
const cleanQuery = (q: string) => q.replace(/[,()*\\%"']/g, " ").replace(/\s+/g, " ").trim();

const deviceOf = (t: TicketRow) => [t.brand, t.model].filter(Boolean).join(" ") || t.device_type || "Device";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Part picked from a row's menu; it's added to the ticket's list ready to save. */
  initialPartId?: string | null;
  onSaved?: () => void;
}

/**
 * Inventory's "Assign to Ticket": find a ticket, then record parts on it directly (inventory staff).
 * Everyone else requests parts from the ticket's Parts section.
 */
export function AssignToTicketDialog({ open, onOpenChange, initialPartId, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const [results, setResults] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketRow | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTicket(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || ticket) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const q = cleanQuery(debounced);
      let req = (supabase as any).from("services").select(TICKET_COLS);
      if (q) req = req.or(`service_id.ilike.%${q}%,client_name.ilike.%${q}%`);
      const { data, error } = await req.order("date_received", { ascending: false }).limit(q ? 10 : 30);
      if (cancelled) return;
      const rows: TicketRow[] = error ? [] : (data ?? []);
      // With no search, suggest the latest tickets that are still open.
      setResults(q ? rows : rows.filter((r) => !isClosedStatus(r.status ?? "")).slice(0, 8));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, open, ticket]);

  // Load the ticket again when it's picked, so the parts shown (and saved on top of) are the latest.
  const pickTicket = async (t: TicketRow) => {
    setTicket(t);
    const { data } = await (supabase as any).from("services").select(TICKET_COLS).eq("service_id", t.service_id).maybeSingle();
    if (data) setTicket((cur) => (cur?.service_id === t.service_id ? (data as TicketRow) : cur));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-2xl flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Assign parts to a ticket</DialogTitle>
          <DialogDescription>
            {ticket
              ? "Add the parts and how many were used, then save. Stock goes down right away and the parts are added to the ticket."
              : "Find the ticket by its number or the client's name."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-1">
          {!ticket ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9"
                  placeholder="Ticket number (e.g. AC211126004) or client name"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {!cleanQuery(debounced) && (
                <p className="text-xs text-muted-foreground">Latest open tickets:</p>
              )}
              {loading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking for tickets…
                </div>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No tickets match.</p>
              ) : (
                <div className="space-y-1.5">
                  {results.map((t) => (
                    <button
                      key={t.service_id}
                      type="button"
                      onClick={() => pickTicket(t)}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{t.service_id}</p>
                        <p className="truncate text-sm">{t.client_name || "No client name"}</p>
                        <p className="truncate text-xs text-muted-foreground">{deviceOf(t)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">{t.status}</p>
                        {isPartsLocked(t.status) && <p className="text-[11px] font-medium text-warning">Parts locked</p>}
                        {(t.parts_used?.length ?? 0) > 0 && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{t.parts_used!.length} part(s) recorded</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-primary">{ticket.service_id}</p>
                  <p className="truncate text-sm">{ticket.client_name || "No client name"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {deviceOf(ticket)}
                    {ticket.status ? ` · ${ticket.status}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setTicket(null)}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Change ticket
                </Button>
              </div>
              <PartsUsedPanel
                serviceId={ticket.service_id}
                partsUsed={(ticket.parts_used ?? []).join(", ")}
                addPartId={initialPartId ?? undefined}
                status={ticket.status}
                onSaved={() => {
                  onSaved?.();
                  onOpenChange(false);
                }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
