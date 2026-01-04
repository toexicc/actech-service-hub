import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initOneSignal } from "./lib/onesignal";
import AppErrorBoundary from "@/components/AppErrorBoundary";

async function cleanupLegacyPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();

    const isLegacySw = (r: ServiceWorkerRegistration) => {
      const urls = [r.active?.scriptURL, r.waiting?.scriptURL, r.installing?.scriptURL].filter(
        Boolean,
      ) as string[];
      return urls.some((u) => u.includes("/sw.js"));
    };

    const legacyRegs = regs.filter(isLegacySw);
    if (legacyRegs.length === 0) return;

    await Promise.all(legacyRegs.map((r) => r.unregister()));

    // Best-effort cache cleanup (in case the old PWA SW cached assets)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn("Service worker cleanup skipped:", e);
  }
}

(async () => {
  // If a legacy PWA service worker was previously installed, unregister it.
  // This prevents the browser from repeatedly requesting /sw.js (now removed).
  await cleanupLegacyPwaServiceWorker();

  // Initialize OneSignal for push notifications
  initOneSignal();

  createRoot(document.getElementById("root")!).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
})();
