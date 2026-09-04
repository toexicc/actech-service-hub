import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

interface Match {
  clientId: string;
  name: string;
  contactNumber: string;
  email: string;
}

interface Props {
  /** Current text in the search box. */
  term: string;
  /** Called with the chosen Client ID. */
  onPick: (clientId: string) => void;
}

/**
 * Shows possible customers while staff type a Client ID or name, so they can
 * pick the right record without knowing the exact ID.
 */
export const ClientSearchSuggestions = ({ term, onPick }: Props) => {
  const debounced = useDebounce(term.trim(), 300);
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (debounced.length < 3) {
      setMatches([]);
      setOpen(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("client_id, name, contact_number, email")
        .or(`client_id.ilike.%${debounced}%,name.ilike.%${debounced}%`)
        .order("created_at", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const rows: Match[] = (data ?? []).map((r: any) => ({
        clientId: r.client_id ?? "",
        name: r.name ?? "",
        contactNumber: r.contact_number ?? "",
        email: r.email ?? "",
      }));
      setMatches(rows);
      setOpen(rows.length > 0 && !(rows.length === 1 && rows[0].clientId === debounced));
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  if (!open) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-lg">
      {matches.map((m) => (
        <button
          key={m.clientId}
          type="button"
          onClick={() => {
            setOpen(false);
            onPick(m.clientId);
          }}
          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/60"
        >
          <span className="text-sm font-medium">
            {m.name || "No name"} — {m.clientId}
          </span>
          <span className="text-xs text-muted-foreground">
            {[m.contactNumber, m.email].filter(Boolean).join(" · ")}
          </span>
        </button>
      ))}
    </div>
  );
};

export default ClientSearchSuggestions;
