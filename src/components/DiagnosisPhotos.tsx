import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadServicePhotos, describeUploadResult } from "@/lib/photoUploads";
import { logTicketActivity } from "@/lib/activityLogger";
import { PhotoGalleryDialog } from "@/components/PhotoGalleryDialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface DiagnosisPhotosProps {
  serviceId: string;
  editable?: boolean;
  title?: string;
  /**
   * Which photo set this panel manages. Interim report photos share the same
   * public bucket so /track can display them without signing.
   */
  kind?: "diagnosis_photo" | "interim_photo";
  /** Helper line shown above the upload buttons. */
  hint?: string;
  /** Wrap the panel in a collapsible whose header acts as the trigger. */
  collapsible?: boolean;
  /** Initial open state when collapsible (defaults to false = minimized). */
  defaultOpen?: boolean;
}

const BUCKET = "diagnosis-photos";
const MAX_PHOTOS = 9;

interface PhotoEntry {
  id: string;
  storagePath: string;
  signedUrl: string;
}

export const DiagnosisPhotos = ({
  serviceId,
  editable = false,
  title = "Device Diagnosis - Photos",
  kind = "diagnosis_photo",
  hint,
  collapsible = false,
  defaultOpen = false,
}: DiagnosisPhotosProps) => {
  const isInterim = kind === "interim_photo";
  const label = isInterim ? "Interim report" : "Diagnosis";
  const { toast } = useToast();
  const [collapsibleOpen, setCollapsibleOpen] = useState(defaultOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: rows } = await supabase
        .from("service_files")
        .select("id, storage_path, bucket")
        .eq("service_id", serviceId)
        .eq("kind", kind as any)
        .order("uploaded_at", { ascending: true });
      if (rows && rows.length > 0) {
        const signed = await Promise.all(
          rows.map(async (r) => {
            const { data } = await supabase.storage.from(r.bucket || BUCKET).createSignedUrl(r.storage_path, 60 * 60);
            return { id: r.id, storagePath: r.storage_path, bucket: r.bucket, signedUrl: data?.signedUrl ?? "" };
          }),
        );
        setPhotos(signed.filter((s) => s.signedUrl));
      } else {
        setPhotos([]);
      }
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId, kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (list.length === 0) {
      toast({ title: "Photo limit reached", description: `Max ${MAX_PHOTOS} photos.` });
      return;
    }
    setUploading(true);
    try {
      const result = await uploadServicePhotos({
        bucket: BUCKET,
        serviceId,
        kind,
        files: list,
        onProgress: (current, total) => setProgress(`Uploading ${current} of ${total}…`),
      });
      await refresh();
      const summary = describeUploadResult(result);
      const uploaded = result.uploaded;
      if (uploaded > 0) {
        logTicketActivity(serviceId, `${label} photos uploaded (${uploaded})`, { count: uploaded, kind });
      }
      toast({
        title: summary.title,
        description: summary.description,
        variant: summary.failed ? "destructive" : undefined,
      });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message ?? "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const remove = async (entry: PhotoEntry) => {
    if (!editable) return;
    if (!window.confirm("Remove this photo?")) return;
    try {
      const { error } = await supabase.from("service_files").delete().eq("id", entry.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([entry.storagePath]);
      setPhotos((p) => p.filter((x) => x.id !== entry.id));
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message ?? "Try again", variant: "destructive" });
    }
  };

  if (!editable && !loading && photos.length === 0) return null;

  const header = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5" />
        <Label className="text-lg font-semibold">{title}</Label>
      </div>
      <span className="text-sm text-muted-foreground">{photos.length}{editable ? `/${MAX_PHOTOS}` : ""} photos</span>
    </div>
  );

  const body = (
    <>
      {editable && (
        <>
          <p className="text-sm text-muted-foreground">
            {hint ??
              (isInterim
                ? "Upload photos of the new findings found during the ongoing repair (shown to the client with the interim report)."
                : "Upload photos taken during initial device diagnosis (visible to admins from Confirmed Diagnosis onward).")}
          </p>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            <Button type="button" variant="outline" disabled={uploading || photos.length >= MAX_PHOTOS} onClick={() => fileInputRef.current?.click()} className="flex-1">
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Photos
            </Button>
            <Button type="button" variant="outline" disabled={uploading || photos.length >= MAX_PHOTOS} onClick={() => cameraInputRef.current?.click()} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          </div>
          {progress && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress} Keep this page open until it finishes.
            </p>
          )}
        </>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((p, i) => (
            <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setPreviewIndex(i)}>
              <img src={p.signedUrl} alt="Diagnosis" loading="lazy" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
              {editable && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); remove(p); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : editable ? (
        <p className="text-sm text-muted-foreground">No {label.toLowerCase()} photos yet.</p>
      ) : null}
    </>
  );

  const gallery = (
    <PhotoGalleryDialog
      photos={photos.map((p) => ({ id: p.id, url: p.signedUrl }))}
      index={previewIndex}
      onIndexChange={setPreviewIndex}
      title={`${label} Photo`}
      alt={label}
    />
  );

  if (collapsible) {
    return (
      <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {header}
            <span className="text-xs ml-2">{collapsibleOpen ? "▼" : "▶"}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {body}
        </CollapsibleContent>
        {gallery}
      </Collapsible>
    );
  }

  return (
    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
      {header}
      {body}
      {gallery}
    </div>
  );
};
