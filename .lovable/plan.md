# Fix photo uploads (Device Diagnosis & Device Report)

## What I verified

- Both panels (`DiagnosisPhotos`, `DeviceReportPhotos`) upload to storage, then insert a row in `service_files`.
- Backend is healthy: buckets `diagnosis-photos` and `device-reports` exist, storage insert/read policies allow authenticated staff, and table grants/policies allow inserts. Uploads are still landing (1,059 diagnosis + 763 report rows, most recent a few minutes ago).
- So this is not a permissions outage — it's client-side handling that makes phone uploads fail, often silently.

## Root causes in the upload code

1. **5MB check runs before compression.** Modern phone photos are commonly 6-12MB, so they're rejected with "exceeds 5MB" even though the compressed result would be well under 1MB.
2. **Files with a blank/unknown MIME type are skipped with no message.** Some Android/iOS camera and file-picker flows report an empty `type` (or `image/heic`), so nothing uploads and no error appears — the user just sees nothing happen.
3. **One bad file aborts the whole batch.** The loop `throw`s on the first failure, so photos queued after it never upload even though they were fine.
4. **No feedback while uploading.** Large photos on shop Wi-Fi take a while with no per-photo progress, so technicians tap again and assume it's broken.
5. **Silent failures on compression.** If the canvas step returns a blank blob (large images on low-memory phones), the error message is a cryptic "blank canvas".
6. **Technicians cannot delete photos.** `service_files` DELETE is admin/management-only, so a technician's "remove" leaves an orphaned row and a broken thumbnail.

## The fix

Rework the shared upload logic in both `DiagnosisPhotos.tsx` and `DeviceReportPhotos.tsx`:

- Compress first, then enforce the size limit on the compressed result. Raise the accepted input size to ~25MB per photo and reject only if the compressed file is still oversized.
- Accept files by extension when the MIME type is missing, and convert HEIC/HEIF via the canvas path; if a file truly can't be read, show a named per-file error instead of skipping quietly.
- Make the batch resilient: upload each photo independently, keep going after a failure, and finish with a summary toast ("4 uploaded, 1 failed: IMG_2043.jpg — reason").
- Add one automatic retry for network/storage errors, plus a per-photo progress indicator ("Uploading 2 of 5…") and disabled buttons while in flight.
- Lower the compression target for very large images (max dimension 1600, quality 0.8) so mobile uploads are faster and canvas memory pressure drops.
- Add optimistic thumbnails so photos appear immediately rather than only after the refresh query.

Backend (one small migration):

- Allow the uploader to delete their own `service_files` row (`uploaded_by = auth.uid()`), keeping the existing admin/management delete policy. This makes "remove photo" work for technicians without widening access.

## Technical notes

- Extract the compress/upload/retry routine into a shared helper (e.g. `src/lib/photoUploads.ts`) used by both components so the two panels stay in sync.
- No changes to bucket configuration or to how `/track` reads photos (diagnosis photos stay publicly readable, device reports stay signed-URL only).
