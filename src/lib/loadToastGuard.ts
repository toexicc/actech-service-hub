/**
 * Several ticket pages stay mounted in the background (keep-alive), so each one
 * used to announce the same "service loaded" confirmation and the alerts piled
 * up. This guard lets only the page the user is actually on announce a load,
 * and only once per ticket within a short window.
 */
const lastAnnounced = new Map<string, number>();
const WINDOW_MS = 4000;

export const announceServiceLoad = (
  serviceId: string,
  routePrefix: string,
  show: () => void,
): void => {
  if (!serviceId) return;
  // Background/cached pages must stay quiet.
  if (typeof window !== "undefined" && !window.location.pathname.startsWith(routePrefix)) return;

  const now = Date.now();
  const previous = lastAnnounced.get(serviceId);
  if (previous && now - previous < WINDOW_MS) return;
  lastAnnounced.set(serviceId, now);
  show();
};
