import { useEffect, useState } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logTicketActivity } from "@/lib/activityLogger";
import { TicketSearchSuggestions } from "@/components/TicketSearchSuggestions";
import ServicePreviewButton from "@/components/ServicePreviewButton";

interface Props {
  /** The ticket being viewed. */
  serviceId?: string | null;
  /** Only shown while the Backjob flag is on. */
  isBackjob?: boolean;
  /** Admin/management can link or unlink; technicians only read. */
  canEdit?: boolean;
}

/**
 * Links a backjob ticket to the previous repair it came back for, so staff can
 * jump straight to the earlier job. Shown on Manage Client (editable) and on
 * Service Update (read-only) while the Backjob flag is on.
 */
export function BackjobLinkRow({ serviceId, isBackjob, canEdit = false }: Props) {
  const { toast } = useToast();
  const [linked, setLinked] = useState<string>("");
  const [term, setTerm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLinked("");
    setTerm("");
    if (!serviceId || !isBackjob) return;
    (async () => {
      const { data } = await supabase
        .from("services")
        .select("linked_service_id")
        .eq("service_id", serviceId)
        .maybeSingle();
      if (!cancelled) setLinked(((data as any)?.linked_service_id || "").trim());
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId, isBackjob]);

  if (!serviceId || !isBackjob) return null;

  const save = async (next: string) => {
    if (saving) return;
    const value = next.trim().toUpperCase();
    if (value && value === serviceId.toUpperCase()) {
      toast({
        title: "Pick a different ticket",
        description: "A ticket cannot be linked to itself.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (value) {
        const { data: exists } = await supabase
          .from("services")
          .select("service_id")
          .eq("service_id", value)
          .maybeSingle();
        if (!exists) {
          toast({
            title: "Ticket not found",
            description: `No ticket matches ${value}.`,
            variant: "destructive",
          });
          return;
        }
      }
      const { error } = await supabase
        .from("services")
        .update({ linked_service_id: value || null, last_updated: new Date().toISOString() } as any)
        .eq("service_id", serviceId);
      if (error) throw new Error(error.message);
      setLinked(value);
      setTerm("");
      logTicketActivity(
        serviceId,
        value ? `Linked to previous ticket ${value}` : "Previous ticket link removed",
      );
      toast({ title: value ? `Linked to ${value}` : "Link removed" });
    } catch (e) {
      toast({
        title: "Could not save the link",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-purple-300/60 bg-purple-50/50 p-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Previous ticket (backjob)
      </p>

      {linked ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-border/60 bg-background/80 px-2 py-1 font-mono text-sm font-semibold">
            {linked}
          </span>
          <ServicePreviewButton serviceId={linked} />
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={saving}
              onClick={() => save("")}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2Off className="mr-1.5 h-3.5 w-3.5" />
              )}
              Unlink
            </Button>
          )}
        </div>
      ) : canEdit ? (
        <div className="relative space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search ticket ID, customer or device"
              className="sm:flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0 text-xs"
              disabled={saving || !term.trim()}
              onClick={() => save(term)}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Link ticket
            </Button>
          </div>
          <TicketSearchSuggestions term={term} onPick={(id) => save(id)} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No previous ticket linked yet.</p>
      )}
    </div>
  );
}

export default BackjobLinkRow;
