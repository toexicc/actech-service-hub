/**
 * Helpers to keep PDFs rendering *inside* the app's viewer modal instead of
 * navigating the browser to an external URL (signed storage URLs, Google
 * Drive links, etc.).
 *
 * Strategy: download the file bytes and hand the modal an object URL. Object
 * URLs are same-origin-ish, render inline in every browser, and can never
 * redirect the top-level window. If the fetch fails (CORS on legacy Drive
 * links, offline, etc.) we fall back to the original URL.
 */

const blobUrlCache = new Map<string, string>();

export const isInlineViewerUrl = (url: string | null | undefined) =>
  !!url && url.startsWith("blob:");

/** Fetch `url` and return an object URL for the PDF bytes, or `url` on failure. */
export const toInlinePdfUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const cached = blobUrlCache.get(url);
  if (cached) return cached;

  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return url;
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength === 0) return url;
    const blob = new Blob([buf], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(blob);
    blobUrlCache.set(url, objectUrl);
    return objectUrl;
  } catch {
    return url;
  }
};
