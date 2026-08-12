import { supabase } from "@/integrations/supabase/client";

/**
 * Shared photo-upload pipeline for service photo panels
 * (Device Diagnosis photos and Device Report photos).
 *
 * Key behaviours (mobile-first):
 *  - Compress FIRST, then enforce the size limit on the compressed result, so
 *    a 10MB phone photo is accepted instead of rejected up front.
 *  - Accept files whose MIME type is missing/unknown (common with some Android
 *    camera + file-picker flows) by falling back to the file extension.
 *  - Each file is uploaded independently: one failure never aborts the batch.
 *  - One automatic retry for transient network/storage errors.
 */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i;

// Accept large originals; the compressed output is what must stay small.
export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25MB per source photo
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB after compression
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export const looksLikeImage = (file: File): boolean => {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  // Unknown/blank MIME type — fall back to the filename.
  if (!type || type === "application/octet-stream") return IMAGE_EXT.test(file.name || "");
  return false;
};

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("This file could not be read on this device"));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "This photo format isn't supported by your browser. Try saving it as JPG and uploading again",
        ),
      );
    img.src = src;
  });

export const compressImage = async (file: File): Promise<File> => {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (!width || !height) throw new Error("This photo has no readable image data");

  if (width > height && width > MAX_DIMENSION) {
    height = Math.round((height * MAX_DIMENSION) / width);
    width = MAX_DIMENSION;
  } else if (height > MAX_DIMENSION) {
    width = Math.round((width * MAX_DIMENSION) / height);
    height = MAX_DIMENSION;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser ran out of memory while resizing this photo");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob || blob.size === 0) {
    throw new Error("This photo is too large for this device to process. Try a smaller photo");
  }

  const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
};

export interface UploadOptions {
  bucket: string;
  serviceId: string;
  kind: "diagnosis_photo" | "device_report";
  files: File[];
  /** Called before each file starts uploading (1-based index). */
  onProgress?: (current: number, total: number, fileName: string) => void;
}

export interface UploadResult {
  uploaded: number;
  failures: { name: string; reason: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const uploadOne = async (
  bucket: string,
  path: string,
  file: File,
  attempt = 0,
): Promise<void> => {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: "image/jpeg", upsert: false });
  if (!error) return;
  // One retry for transient network/storage errors.
  if (attempt === 0) {
    await sleep(800);
    return uploadOne(bucket, path, file, 1);
  }
  throw new Error(error.message || "Upload failed. Check your connection and try again");
};

export const uploadServicePhotos = async ({
  bucket,
  serviceId,
  kind,
  files,
  onProgress,
}: UploadOptions): Promise<UploadResult> => {
  const failures: UploadResult["failures"] = [];
  let uploaded = 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const total = files.length;
  let index = 0;

  for (const file of files) {
    index += 1;
    const label = file.name || `Photo ${index}`;
    onProgress?.(index, total, label);

    try {
      if (!looksLikeImage(file)) {
        throw new Error("Not a supported image file");
      }
      if (file.size > MAX_INPUT_BYTES) {
        throw new Error("Photo is larger than 25MB");
      }

      const compressed = await compressImage(file);
      if (compressed.size > MAX_UPLOAD_BYTES) {
        throw new Error("Photo is still too large after resizing");
      }

      const path = `${serviceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      await uploadOne(bucket, path, compressed);

      const { error: insErr } = await supabase.from("service_files").insert({
        service_id: serviceId,
        kind: kind as any,
        bucket,
        storage_path: path,
        filename: compressed.name,
        mime_type: "image/jpeg",
        size_bytes: compressed.size,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) {
        // Don't leave an orphaned object behind.
        await supabase.storage.from(bucket).remove([path]);
        throw new Error(insErr.message || "Could not save the photo record");
      }

      uploaded += 1;
    } catch (err: any) {
      failures.push({ name: label, reason: err?.message ?? "Upload failed" });
    }
  }

  return { uploaded, failures };
};

export const describeUploadResult = (result: UploadResult): { title: string; description: string; failed: boolean } => {
  const { uploaded, failures } = result;
  if (failures.length === 0) {
    return {
      title: "Uploaded",
      description: `${uploaded} photo${uploaded === 1 ? "" : "s"} saved`,
      failed: false,
    };
  }
  const detail = failures.map((f) => `${f.name} — ${f.reason}`).join("; ");
  if (uploaded === 0) {
    return { title: "Upload failed", description: detail, failed: true };
  }
  return {
    title: `${uploaded} uploaded, ${failures.length} failed`,
    description: detail,
    failed: true,
  };
};
