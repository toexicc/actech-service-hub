import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadServicePhotos, describeUploadResult } from "@/lib/photoUploads";
import { PhotoGalleryDialog } from "@/components/PhotoGalleryDialog";

interface Props {
  serviceId: string;
  editable?: boolean;
  title?: string;
}

const BUCKET = "device-reports";
const MAX_PHOTOS = 9;

interface PhotoEntry {
  id: string;
  storagePath: string;
  bucket: string;
  signedUrl: string;
}


export const DeviceReportPhotos = ({
  serviceId,
  editable = false,
  title = "Device Report - Proof",
}: Props) => {
  const { toast } = useToast();
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
      const { data: sessionData } = await supabase.auth.getSession();

      // Public visitors (e.g. clients on /track) can't sign storage URLs, so a
      // public edge function resolves them server-side.
      if (!sessionData?.session) {
        const { data } = await supabase.functions.invoke("get-service-photos", {
          body: null,
          method: "GET" as any,
        } as any).catch(() => ({ data: null } as any));
        let list = (data as any)?.photos as { id: string; url: string }[] | undefined;
        if (!list) {
          const res = await fetch(
            `${(supabase as any).functionsUrl ?? ""}`,
          ).catch(() => null);
          void res;
        }
        if (!list) {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-service-photos?serviceId=${encodeURIComponent(
            serviceId,
          )}&kind=device_report`;
          const res = await fetch(url, {
            headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
          });
          const body = await res.json().catch(() => ({}));
          list = body?.photos ?? [];
        }
        setPhotos(
          (list ?? []).map((p) => ({
            id: p.id,
            storagePath: "",
            bucket: BUCKET,
            signedUrl: p.url,
          })),
        );
        return;
      }

      const { data: rows } = await supabase
        .from("service_files")
        .select("id, storage_path, bucket")
        .eq("service_id", serviceId)
        .eq("kind", "device_report" as any)
        .order("uploaded_at", { ascending: true });
      const entries: PhotoEntry[] = [];
      for (const r of rows ?? []) {
        const { data: signed } = await supabase.storage
          .from(r.bucket)
          .createSignedUrl(r.storage_path, 60 * 60);
        if (signed?.signedUrl)
          entries.push({ id: r.id, storagePath: r.storage_path, bucket: r.bucket, signedUrl: signed.signedUrl });
      }
      setPhotos(entries);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !editable) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast({ title: "Limit reached", description: `Max ${MAX_PHOTOS} photos`, variant: "destructive" });
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) return;

    setUploading(true);
    setProgress(`Uploading 1 of ${list.length}…`);
    try {
      const result = await uploadServicePhotos({
        bucket: BUCKET,
        serviceId,
        kind: "device_report",
        files: list,
        onProgress: (current, total) => setProgress(`Uploading ${current} of ${total}…`),
      });
      await refresh();
      const summary = describeUploadResult(result);
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
      await supabase.storage.from(entry.bucket).remove([entry.storagePath]);

      setPhotos((p) => p.filter((x) => x.id !== entry.id));
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message ?? "Try again", variant: "destructive" });
    }
  };

  if (!editable && !loading && photos.length === 0) return null;

  return (
    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          <Label className="text-lg font-semibold">{title}</Label>
        </div>
        <span className="text-sm text-muted-foreground">
          {photos.length}
          {editable ? `/${MAX_PHOTOS}` : ""} photos
        </span>
      </div>

      {editable && (
        <>
          <p className="text-sm text-muted-foreground">
            Upload the service report checklist as the first photo, then up to {MAX_PHOTOS - 1} device photos.
          </p>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading || photos.length >= MAX_PHOTOS}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Photos
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploading || photos.length >= MAX_PHOTOS}
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1"
            >
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
            <div
              key={p.id}
              className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer"
              onClick={() => setPreviewIndex(i)}
            >
              <img
                src={p.signedUrl}
                alt="Device report"
                loading="lazy"
                className="w-full h-full object-cover hover:opacity-80 transition-opacity"
              />
              {editable && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(p);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : editable ? (
        <p className="text-sm text-muted-foreground">No device report photos yet.</p>
      ) : null}

      <PhotoGalleryDialog
        photos={photos.map((p) => ({ id: p.id, url: p.signedUrl }))}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        title="Device Report Photo"
        alt="Device report"
      />
    </div>
  );
};
