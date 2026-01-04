import { useEffect } from "react";

const isSafari = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;

  // iOS Safari or macOS Safari (exclude Chrome/Firefox on iOS which still include Safari in UA)
  const isAppleWebKit = /AppleWebKit/i.test(ua);
  const isSafariLike = /Safari/i.test(ua);
  const isChromeLike = /CriOS|Chrome|Chromium/i.test(ua);
  const isFirefoxLike = /FxiOS|Firefox/i.test(ua);

  return isAppleWebKit && isSafariLike && !isChromeLike && !isFirefoxLike;
};

export default function BrowserFlags() {
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (isSafari()) {
        root.dataset.browser = "safari";
      } else {
        // Avoid persisting stale flags across navigations
        if (root.dataset.browser === "safari") delete root.dataset.browser;
      }
    } catch {
      // ignore
    }
  }, []);

  return null;
}
