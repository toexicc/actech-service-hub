/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};

// Workbox lifecycle
self.skipWaiting();
clientsClaim();

// Precache Vite build assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Keep prior runtime caching behavior for Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
  })
);

// OneSignal push handling (must be in the active SW controlling '/')
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
