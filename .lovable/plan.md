# Stop the recurring white screen

## What the investigation confirmed

The current startup has three failure paths that can leave an entirely empty page before React or the existing error screen appears:

1. **The app waits for offline-worker cleanup and registration before rendering.** On mobile Safari/PWA installs, those browser calls can stall, so the first screen is never mounted.
2. **The stale-file recovery can stop forever.** If a startup file fails after an update, the code requests one reload and then waits indefinitely. The one-reload flag is kept until startup succeeds, so another failure can remain white and clearing the browser cache becomes the only escape.
3. **The generated offline worker registers a precached `index.html` navigation handler before the intended network-first navigation handler.** The first matching handler wins, so the saved app shell can take precedence and continue referencing an older set of startup files after a release.

The live site's current HTML and worker are correctly marked `no-cache`, and the current project build is clean. This points to client-side startup/cache recovery rather than a present compile failure.

## Fix

### 1. Show a startup screen immediately
- Put a small dependency-free loading/recovery screen into the page before any dynamic app import.
- Replace it when the app mounts.
- If startup fails or takes too long, show **Retry** and **Reset saved app files** instead of leaving a white page.
- Keep the user signed in when resetting app files; remove only app-shell caches and worker registrations, not authentication or form/session data.

### 2. Render first; initialize optional services afterward
- Mount the main app and its error boundary before offline-worker maintenance, push notifications, or other non-essential setup.
- Run offline support and push setup in the background with time limits so a stalled browser API cannot block the interface.
- Keep push notifications and installability working; they simply cannot hold the screen hostage.

### 3. Make stale-version recovery self-healing
- Replace the infinite wait after a failed startup import with a bounded recovery flow.
- Detect failed JavaScript/module loads, clear only stale app-shell caches, update/unregister the app-shell worker as needed, and reload once with a versioned recovery marker.
- If the refreshed startup still fails, stop reloading and display the recovery screen with the captured error.
- Clear the recovery marker after a successful mount and expire abandoned markers so a past failure cannot trap later sessions.

### 4. Correct the offline cache strategy
- Do not precache `index.html` while also registering a separate network-first navigation strategy.
- Use one navigation rule: network first, with the last working shell only as an offline fallback.
- Keep fingerprinted JavaScript, CSS, fonts, and images cache-first because their filenames change with each release.
- Preserve the existing preview/iframe/local guards and the `?sw=off` emergency switch.
- Keep the combined OneSignal/app worker arrangement, while ensuring a push setup problem cannot prevent app startup.

### 5. Strengthen error capture
- Install bootstrap-level `error` and `unhandledrejection` handling before loading the app.
- Capture the failed file URL and startup stage without logging private user data.
- Let the existing in-app error boundary continue handling errors after React mounts.

## Verification

- Reproduce an old-release/new-release mismatch and confirm it repairs itself without manually clearing cache.
- Simulate failed and hanging service-worker APIs; the app must still render.
- Simulate a failed startup chunk; verify one safe recovery attempt, then a visible Retry/Reset screen rather than a reload loop or white page.
- Test normal browser and installed-app launches on mobile-sized Safari/Chromium profiles, including offline then back-online behavior.
- Confirm login remains intact after app-file reset, push notifications still register, public pages still open, and the production build remains clean.
