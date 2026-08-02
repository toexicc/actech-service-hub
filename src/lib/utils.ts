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
export function normalizeGoogleDrivePdfUrl(
  url: string,
  mode: "preview" | "embed" | "download" = "preview",
): string {
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

    if (mode === "download") {
      // Direct file URL (better for auto-print)
      return `https://drive.google.com/uc?export=download&id=${id}`;
    }

    // Use Drive preview which is iframe embeddable
    if (mode === "preview" || mode === "embed") {
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    return url;
  } catch {
    return url;
  }
}

// Normalize Google Drive links to an embeddable IMAGE URL
// Returns a direct view link suitable for <img src="..." />
export function normalizeGoogleDriveImageUrl(url: string): string {
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

    // Direct view link for images
    return `https://drive.google.com/uc?export=view&id=${id}`;
  } catch {
    return url;
  }
}


/**
 * Mask a staff name for printed documents: keeps the first letter of each word
 * and replaces the remaining letters with asterisks.
 * "Khaya Naranja" -> "K**** N******"
 * Handles comma-separated lists of names.
 */
export function maskStaffName(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) =>
      name
        .split(/\s+/)
        .map((word) =>
          word.length <= 1 ? word : word[0] + "*".repeat(word.length - 1),
        )
        .join(" "),
    )
    .join(", ");
}
