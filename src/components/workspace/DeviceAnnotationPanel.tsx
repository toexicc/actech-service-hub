import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getServiceImageDataUrl } from "@/lib/servicePdfStorage";
import { logTicketActivity } from "@/lib/activityLogger";
import { DeviceAnnotationCanvas } from "@/components/DeviceAnnotationCanvas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEMPLATE_TYPES = ["Laptop/Macbook", "IPad/Tablet", "IPhone/Mobile", "Apple Watch", "Computer/IMac"];

const guessTemplate = (raw: string) => {
  const t = (raw || "").toLowerCase();
  if (TEMPLATE_TYPES.includes(raw)) return raw;
  if (/watch/.test(t)) return "Apple Watch";
  if (/ipad|tablet|tab\b/.test(t)) return "IPad/Tablet";
  if (/iphone|mobile|phone|android/.test(t)) return "IPhone/Mobile";
  if (/imac|desktop|computer|\bpc\b|all.in.one/.test(t)) return "Computer/IMac";
  if (/laptop|macbook|notebook|mac/.test(t)) return "Laptop/Macbook";
  return "Laptop/Macbook";
};

interface Props {
  serviceId?: string;
  deviceType?: string;
  canEdit?: boolean;
}

/**
 * Collapsible view of the intake device annotation. Staff can draw new marks
 * on top of the existing drawing and update the notes; saving replaces the
 * stored version.
 */
export function DeviceAnnotationPanel({ serviceId, deviceType = "", canEdit = true }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [image, setImage] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(() => guessTemplate(deviceType));
  const [drawOnExisting, setDrawOnExisting] = useState(true);

  useEffect(() => setTemplate(guessTemplate(deviceType)), [deviceType]);

  useEffect(() => {
    setLoaded(false);
    setImage(undefined);
    setEditing(false);
    setPendingImage(undefined);
  }, [serviceId]);

  useEffect(() => {
    if (!open || loaded || !serviceId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("services")
        .select("device_annotation_path, device_annotation_notes, device_notes")
        .eq("service_id", serviceId)
        .maybeSingle();
      const row: any = data || {};
      const url = await getServiceImageDataUrl(serviceId, "annotation", row.device_annotation_path || undefined);
      if (cancelled) return;
      const n = row.device_annotation_notes || row.device_notes || "";
      setImage(url);
      setNotes(n);
      setSavedNotes(n);
      setLoaded(true);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setLoaded(true);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, loaded, serviceId]);

  const save = async () => {
    if (!serviceId) return;
    setSaving(true);
    try {
      const patch: Record<string, any> = { device_annotation_notes: notes || null };
      if (pendingImage) {
        const blob = await (await fetch(pendingImage)).blob();
        const path = `${serviceId}/${serviceId}_ann.png`;
        const { error: upErr } = await supabase.storage
          .from("annotations")
          .upload(path, blob, { upsert: true, contentType: "image/png" });
        if (upErr) throw new Error(upErr.message);
        patch.device_annotation_path = path;
      }
      const { error } = await supabase.from("services").update(patch as any).eq("service_id", serviceId);
      if (error) throw new Error(error.message);
      if (pendingImage) setImage(pendingImage);
      setPendingImage(undefined);
      setSavedNotes(notes);
      setEditing(false);
      logTicketActivity(serviceId, "Device annotation updated");
      toast({ title: "Device annotation saved" });
    } catch (e) {
      toast({
        title: "Could not save annotation",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const dirty = !!pendingImage || notes !== savedNotes;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span>Device Annotation</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {editing ? (
              <div className="space-y-3 overflow-x-auto rounded-lg border border-border/60 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Device type</span>
                  <Select
                    value={template}
                    onValueChange={(v) => {
                      setTemplate(v);
                      setDrawOnExisting(false);
                    }}
                  >
                    <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(pendingImage || image) && (
                    <Button
                      size="sm"
                      variant={drawOnExisting ? "default" : "outline"}
                      onClick={() => setDrawOnExisting((v) => !v)}
                    >
                      {drawOnExisting ? "Drawing on saved annotation" : "Use saved annotation"}
                    </Button>
                  )}
                </div>
                <DeviceAnnotationCanvas
                  deviceType={template}
                  backgroundUrl={drawOnExisting ? pendingImage || image : undefined}
                  onSave={(url) => {
                    setPendingImage(url);
                    setEditing(false);
                  }}
                />
              </div>
            ) : pendingImage || image ? (
              <img
                src={pendingImage || image}
                alt="Device annotation"
                className="w-full max-w-2xl rounded-lg border border-border/60 bg-background"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No annotation was drawn at intake.</p>
            )}

            {canEdit && !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                {image || pendingImage ? "Draw on annotation" : "Add annotation"}
              </Button>
            )}
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="mr-2 h-3.5 w-3.5" />
                Cancel drawing
              </Button>
            )}

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Annotation notes</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                readOnly={!canEdit}
                placeholder="e.g. Dent on the top-left corner."
              />
            </div>

            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                Save annotation
              </Button>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default DeviceAnnotationPanel;
