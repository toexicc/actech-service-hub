// Endpoint of the Lovable Cloud data-bridge edge function used by the legacy
// action-style fetch callsites (searchService, getServiceLogs, etc.).
// All data is read from and written to the Lovable Cloud database.
const SUPABASE_PROJECT_ID =
  (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID || "zpryngvwbybpshsfeqaz";

export const DATA_BRIDGE_URL =
  `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/sheets-bridge`;
