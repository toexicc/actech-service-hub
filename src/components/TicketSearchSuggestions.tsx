import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface Match {
  serviceId: string;
  clientName: string;
  device: string;
  status: string;
}

interface Props {
  /** Current text in the search box. */
  term: string;
  /** Called with the chosen Service ID. */
  onPick: (serviceId: string) => void;
}

/**
 * Shows possible tickets while staff type a client name, a device or part of a
 * Service ID, so they no longer need the exact ticket number.
 */
export const TicketSearchSuggestions = ({ term, onPick }: Props) => {
  const debounced = useDebounce(term.trim(), 300);
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);

  const query = useMemo(() => debounced, [debounced]);

  useEffect(() => {
    let cancelled = false;
    if (query.length < 3) {
      setMatches([]);
      setOpen(false);
      return;
    }
    (async () => {
      const like = `%${query}%`;
      const { data } = await supabase
        .from("services")
        .select("service_id, client_name, brand, model, device_type, status")
        .or(
          [
            `service_id.ilike.${like}`,
            `client_name.ilike.${like}`,
            `model.ilike.${like}`,
            `brand.ilike.${like}`,
          ].join(","),
        )
        .order("created_at", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const rows: Match[] = (data ?? []).map((r: any) => ({
        serviceId: r.service_id ?? "",
        clientName: r.client_name ?? "",
        device: [r.brand, r.model, r.device_type].filter(Boolean).join(" "),
        status: r.status ?? "",
      }));
      setMatches(rows);
      setOpen(rows.length > 0 && !(rows.length === 1 && rows[0].serviceId === query));
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!open) return null;

  return (
    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border/60 bg-popover shadow-lg">
      {matches.map((m) => (
        <button
          key={m.serviceId}
          type="button"
          onClick={() => {
            setOpen(false);
            onPick(m.serviceId);
          }}
          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/60"
        >
          <span className="text-sm font-medium">
            {m.serviceId} — {m.clientName || "No name"}
          </span>
          <span className="text-xs text-muted-foreground">
            {[m.device, m.status].filter(Boolean).join(" · ")}
          </span>
        </button>
      ))}
    </div>
  );
};

export default TicketSearchSuggestions;
