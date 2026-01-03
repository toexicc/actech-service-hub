import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'OneSignalSDKUpdaterWorker.js'
      ],
      manifest: {
        name: 'ACTech Service Hub',
        short_name: 'ACTech Service Hub',
        description:
          'AC Tech Repair internal service management portal for tracking client device repairs and service requests',
        theme_color: '#1a1f4e',
        background_color: '#1a1f4e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        // Output the ONE service worker that OneSignal is configured to use
        swDest: 'OneSignalSDKWorker.js',
        // Avoid ESM output (importScripts + some SW libs expect classic scripts)
        rollupFormat: 'iife',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
