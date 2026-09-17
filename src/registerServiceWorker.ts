import { registerSW } from "virtual:pwa-register";

const APP_SW_PATH = "/sw.js";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

function shouldRefuseServiceWorker() {
  if (!import.meta.env.PROD) return true;
  if (!("serviceWorker" in navigator)) return true;
  if (window.self !== window.top) return true;
  if (isPreviewHost(window.location.hostname)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppShellServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => {
        const urls = [registration.active?.scriptURL, registration.waiting?.scriptURL, registration.installing?.scriptURL].filter(
          Boolean,
        ) as string[];
        const controlsAppShell = urls.some((url) => url.endsWith(APP_SW_PATH));
        return controlsAppShell ? registration.unregister() : Promise.resolve(false);
      }),
    );
  } catch {
    // Best-effort cleanup only.
  }
}

export async function registerAppServiceWorker() {
  if (shouldRefuseServiceWorker()) {
    await unregisterAppShellServiceWorkers();
    return;
  }

  registerSW({ immediate: true });
}