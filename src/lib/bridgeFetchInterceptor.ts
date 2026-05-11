// Globally inject the current Supabase auth token on any fetch() call to the
// sheets-bridge edge function. This lets the edge function enforce JWT auth
// without requiring every legacy fetch() callsite to be rewritten.
import { supabase } from "@/integrations/supabase/client";

const BRIDGE_PATH = "/functions/v1/sheets-bridge";
const PUSH_PATH = "/functions/v1/send-push-notification";
const FORMAT_DIAG_PATH = "/functions/v1/format-diagnosis";
const FORMAT_REPORT_PATH = "/functions/v1/format-report";
const STATUS_WEBHOOK_PATH = "/functions/v1/sheet-status-webhook";

const PROTECTED_PATHS = [
  BRIDGE_PATH,
  PUSH_PATH,
  FORMAT_DIAG_PATH,
  FORMAT_REPORT_PATH,
  STATUS_WEBHOOK_PATH,
];

let installed = false;

export const installBridgeAuthInterceptor = () => {
  if (installed || typeof window === "undefined" || !window.fetch) return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;

      if (PROTECTED_PATHS.some((p) => url.includes(p))) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          init = { ...(init ?? {}), headers };
        }
      }
    } catch {
      // best-effort; let request proceed
    }
    return original(input as any, init);
  };
};
