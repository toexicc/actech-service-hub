import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
    mode === "development" && componentTagger(),
    // PWA plugin disabled to prioritize OneSignal push notifications
    // OneSignal's service worker (OneSignalSDKWorker.js) now controls the site
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
