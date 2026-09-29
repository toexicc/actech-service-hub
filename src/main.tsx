import { createRoot } from "react-dom/client";
import "./index.css";

const GLOBAL_ERROR_KEY = "actech:last_global_error";

function showBootstrapFailure(error: unknown) {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  const message = error instanceof Error ? error.message : "The app could not finish loading.";
  rootElement.innerHTML = `
    <main class="min-h-screen min-h-[100dvh] bg-background text-foreground p-6 flex items-center justify-center">
      <section class="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <h1 class="text-xl font-semibold">ACTech Hub couldn't open</h1>
        <p class="mt-2 text-sm text-muted-foreground">Reload the app to get the latest working version.</p>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button id="bootstrap-retry" class="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">Reload</button>
          <button id="bootstrap-reset" class="h-11 rounded-md border border-border bg-background px-5 text-sm font-medium">Reset saved app files</button>
        </div>
        <details class="mt-5 text-left text-xs text-muted-foreground">
          <summary>Loading details</summary>
          <p class="mt-2 break-words"></p>
        </details>
      </section>
    </main>`;

  const details = rootElement.querySelector("details p");
  if (details) details.textContent = message;
  rootElement.querySelector("#bootstrap-retry")?.addEventListener("click", () => window.location.reload());
  rootElement.querySelector("#bootstrap-reset")?.addEventListener("click", async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const appShellRegistrations = registrations.filter((registration) => {
          const urls = [
            registration.active?.scriptURL,
            registration.waiting?.scriptURL,
            registration.installing?.scriptURL,
          ].filter(Boolean) as string[];
          return urls.some((url) => new URL(url).pathname === "/sw.js");
        });
        await Promise.allSettled(appShellRegistrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        const appShellCaches = cacheNames.filter(
          (name) =>
            name === "actech-navigations" ||
            name === "actech-versioned-assets" ||
            /(^|-)precache-v\d+-|(^|-)runtime-/.test(name),
        );
        await Promise.allSettled(appShellCaches.map((name) => caches.delete(name)));
      }
    } finally {
      window.location.reload();
    }
  });
}

function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  const store = (kind: "error" | "unhandledrejection", err: unknown) => {
    try {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);

      const payload = {
        kind,
        message,
        href: window.location.href,
        ua: navigator.userAgent,
        at: new Date().toISOString(),
      };

      localStorage.setItem(GLOBAL_ERROR_KEY, JSON.stringify(payload));
      import("@/lib/activityLogger")
        .then((m) => m.logScreenError(message, { source: kind }))
        .catch(() => {});
      // Keep logs for remote debugging (esp. iOS Safari)
    } catch {
      // ignore
    }
  };

  window.addEventListener("error", (e) => store("error", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => store("unhandledrejection", e.reason));
}

(async () => {
  installGlobalErrorHandlers();

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    const error = new Error("ACTech Hub root element is missing");
    console.error(error);
    return;
  }

  // Keep the public TV board isolated from the authenticated application and
  // its heavier browser APIs. This is important for older Tizen/webOS engines.
  if (window.location.pathname.replace(/\/$/, "") === "/queue") {
    const { default: QueueRoot } = await import("./QueueRoot.tsx");
    createRoot(rootElement).render(<QueueRoot />);
    return;
  }

  const importWithRetry = async <T,>(load: () => Promise<T>): Promise<T> => {
    try {
      return await load();
    } catch {
      await new Promise((r) => setTimeout(r, 600));
      return await load();
    }
  };

  const [appModule, errorBoundaryModule] = await Promise.all([
    importWithRetry(() => import("./App.tsx")),
    importWithRetry(() => import("@/components/AppErrorBoundary")),
  ]);

  const App = appModule.default;
  const AppErrorBoundary = errorBoundaryModule.default;

  createRoot(rootElement).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );

  // Optional integrations must never delay the first usable screen.
  void import("@/lib/bridgeFetchInterceptor")
    .then((bridgeModule) => bridgeModule.installBridgeAuthInterceptor())
    .catch(() => undefined);
  void import("./lib/onesignal")
    .then((oneSignalModule) => oneSignalModule.initOneSignal())
    .catch(() => undefined);
})().catch((error) => {
  console.error(error);
  showBootstrapFailure(error);
});
