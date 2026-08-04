/**
 * Helpers to keep PDFs rendering *inside* the app's viewer modal instead of
 * navigating the browser to an external URL (signed storage URLs, Google
 * Drive links, etc.).
 *
 * Strategy: always download the file bytes and hand the modal an object URL.
 * Object URLs render inline in every browser and can never redirect the
 * top-level window. Remote URLs are NEVER framed directly — Chrome blocks
 * framing storage responses ("blocked by Chrome"), so on failure the modal
 * shows an explicit open/download fallback instead.
 */

import { supabase } from "@/integrations/supabase/client";

const blobUrlCache = new Map<string, string>();

export const isInlineViewerUrl = (url: string | null | undefined) =>
  !!url && (url.startsWith("blob:") || url.startsWith("data:"));

export interface InlinePdfResult {
  /** Object URL for the PDF bytes, or null when the bytes couldn't be loaded. */
  url: string | null;
  ok: boolean;
}

/** Parse `bucket` + `path` out of a Supabase storage URL (signed or public). */
const parseStorageUrl = (url: string): { bucket: string; path: string } | null => {
  try {
    const u = new URL(url);
    const m = u.pathname.match(
      /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/,
    );
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
};

const toObjectUrl = (buf: ArrayBuffer): string => {
  const blob = new Blob([buf], { type: "application/pdf" });
  return URL.createObjectURL(blob);
};

/**
 * Load `url` as a local object URL.
 * Supabase storage links are downloaded through the storage client (works even
 * when the signed token has expired); everything else falls back to `fetch`.
 */
export const loadInlinePdf = async (
  url: string | null | undefined,
): Promise<InlinePdfResult> => {
  if (!url) return { url: null, ok: false };
  if (isInlineViewerUrl(url)) return { url, ok: true };

  const cached = blobUrlCache.get(url);
  if (cached) return { url: cached, ok: true };

  // 1) Supabase storage: authenticated download via the SDK.
  const storage = parseStorageUrl(url);
  if (storage) {
    try {
      const { data } = await supabase.storage.from(storage.bucket).download(storage.path);
      if (data) {
        const buf = await data.arrayBuffer();
        if (buf?.byteLength) {
          const objectUrl = toObjectUrl(buf);
          blobUrlCache.set(url, objectUrl);
          return { url: objectUrl, ok: true };
        }
      }
    } catch {
      /* fall through to plain fetch */
    }
  }

  // 2) Plain cross-origin fetch (public URLs, edge-function signed links).
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf?.byteLength) {
        const objectUrl = toObjectUrl(buf);
        blobUrlCache.set(url, objectUrl);
        return { url: objectUrl, ok: true };
      }
    }
  } catch {
    /* unreachable / CORS-blocked */
  }

  return { url: null, ok: false };
};

/** Backwards-compatible helper: returns the object URL or null. */
export const toInlinePdfUrl = async (
  url: string | null | undefined,
): Promise<string | null> => (await loadInlinePdf(url)).url;
