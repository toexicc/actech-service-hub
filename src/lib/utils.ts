import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normalize various Google Drive share links to an embeddable/printable preview URL
// Supports:
// - https://drive.google.com/file/d/FILE_ID/view?...
// - https://drive.google.com/file/d/FILE_ID/preview
// - https://drive.google.com/open?id=FILE_ID
// - https://drive.google.com/uc?id=FILE_ID&export=...
export function normalizeGoogleDrivePdfUrl(url: string, mode: "preview" | "embed" = "preview"): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (!/drive\.google\.com$|docs\.google\.com$/.test(host)) return url;

    let id = "";
    const fileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
      id = fileMatch[1];
    } else if (u.searchParams.get("id")) {
      id = String(u.searchParams.get("id"));
    }

    if (!id) return url;

    // Use Drive preview which is iframe embeddable
    if (mode === "preview" || mode === "embed") {
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    return url;
  } catch {
    return url;
  }
}

