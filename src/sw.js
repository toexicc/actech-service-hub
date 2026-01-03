/* eslint-disable no-undef */
/// <reference lib="webworker" />

// OneSignal must run inside the *active* service worker.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// PWA precache (manifest injected at build time by vite-plugin-pwa)
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('message', (event) => {
  // Allow the app to trigger immediate SW activation
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
