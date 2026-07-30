## What I found (verified in code, not guessed)

The reload is **not** a service worker and **not** query refetching:

- There is no `vite-plugin-pwa`, no `sw.js`, and no registration in the app — `src/main.tsx` only *unregisters* legacy workers. The only worker is OneSignal's, which never claims/reloads clients.
- React Query is already cache-first globally in `src/App.tsx`: `refetchOnWindowFocus: false`, `refetchOnMount: false`, `refetchOnReconnect: false`.
- There is no `visibilitychange`, `focus`, or `location.reload()` handler anywhere in app code.

The actual trigger is the auth provider:

1. `src/hooks/useAuth.tsx:62` subscribes to `onAuthStateChange`. When you switch back to the tab, the auth client revalidates and fires `TOKEN_REFRESHED` (and sometimes `SIGNED_IN`) — even though the user never changed.
2. The handler treats **every** event as a fresh sign-in: line 68 sets `loading = true` and re-fetches profile + roles.
3. `src/components/ProtectedRoute.tsx:30` renders a full-screen spinner whenever `loading` is true, which **unmounts `children`**.
4. Children include the whole workbench shell and `WorkbenchOutlet`'s keep-alive tabs. Unmount/remount wipes tab state and scroll position — visually identical to a page reload.

So the "reload on tab switch" is a spinner-driven remount of the entire app tree.

## The fix

**1. `src/hooks/useAuth.tsx` — only show loading for real auth transitions**

- Track the hydrated user id in a ref. In the `onAuthStateChange` handler:
  - Always update `session` / `user` (tokens must stay fresh).
  - If the incoming user id equals the already-hydrated id (the `TOKEN_REFRESHED` / repeat `SIGNED_IN` case), **do not** touch `loading` and **do not** re-fetch profile/roles — the data is already in state.
  - Only set `loading = true` and hydrate when the user id actually changes (new sign-in / account switch) and only when profile/roles aren't already populated for that id.
- Handle `SIGNED_OUT` as today (clear profile/roles, `loading = false`).
- Keep the initial `getSession()` hydration path as the one place that legitimately shows the first-load spinner, guarded so it doesn't double-hydrate with the subscription.

**2. `src/components/ProtectedRoute.tsx` — never unmount an already-authenticated tree**

- Show the spinner only during *initial* auth resolution: when there is no `user` yet. If a `user` is already present, render `children` even if `loading` is momentarily true. This makes the route resilient to any future transient loading flip, so the app tree can't be torn down mid-session.

**3. Verify with a real refocus test**

- Drive the running app with a headless browser: sign in, open a couple of workbench tabs, type into a field, blur the page (background it), wait past a token refresh tick, refocus, then confirm the field value, active tab, and scroll position survive and that no spinner-only frame appears. Capture before/after screenshots as evidence.

## Notes

- Three hooks still use `refetchOnMount: "always"` (`useServices`, `useStaff`, `useClients`, `useClientInquiriesData`, `TransactionTracker`). Those are correct once the tree stops remounting — they only cost a fetch on genuine mount. Leaving them alone avoids stale operational data; I'll only revisit them if the browser test still shows loading skeletons on refocus.
- No database, backend, or business-logic changes are involved — this is auth-state and render-gating only.
