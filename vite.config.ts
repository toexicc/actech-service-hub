import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    legacy({
      targets: ["Chrome >= 49", "Safari >= 10", "Samsung >= 4"],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    VitePWA({
      strategies: "generateSW",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ["https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        globIgnores: ["**/OneSignalSDKWorker.js", "**/OneSignalSDKUpdaterWorker.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/OneSignalSDK/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "actech-navigations",
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: ({ sameOrigin, request, url }) =>
              sameOrigin &&
              ["script", "style", "font", "image"].includes(request.destination) &&
              /\.[a-f0-9]{8,}\./.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "actech-versioned-assets",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  // Smart TV browsers (Tizen / webOS / Android TV) run older Chromium builds.
  // Downlevel the output so the public /queue board renders there.
  build: {
    target: ["es2015", "chrome61", "safari11"],
  },
  esbuild: {
    target: "es2015",
  },
  optimizeDeps: {
    esbuildOptions: { target: "es2015" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
