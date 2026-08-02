## Goal

Right now `/manage-client` and `/service-update` load a ticket once into local form state (sheet data merged over the database row) and never learn about later changes, so staff must reload manually and can't tell when something moved. Add a live watcher that (a) shows a clear "this ticket changed" indicator and (b) auto-refreshes when it's safe to do so.

## Approach

### 1. New hook: `src/hooks/useServiceLiveWatch.ts`

- Subscribes to realtime `postgres_changes` on `public.services` with filter `service_id=eq.<id>` inside `useEffect`, torn down on unmount / id change (realtime is already enabled on `services`).
- Keeps the latest remote row and derives:
  - `hasRemoteChange` — remote `last_updated` is newer than the snapshot the page loaded.
  - `changedFields` — small diff (status, technician, service cost, diagnosis, approval fields) for the message text.
- Ignores echoes of the page's own save: the page calls `markSaved(newLastUpdated)` after a successful update so its own write doesn't trigger the banner.
- Also re-checks once on window focus (cheap `select` by `service_id`) as a fallback if the socket dropped.

### 2. Auto-reload vs. indicator (both pages)

- Each page tracks a `isDirty` flag: whether the current form values differ from the snapshot loaded from the server (compare the page's editable fields).
- **Not dirty** → silently re-run the existing load path (`searchService(id)` / the auto-search routine) and show a brief toast: "Ticket refreshed — status is now X".
- **Dirty** (someone is mid-edit) → do NOT overwrite. Show a sticky indicator instead, so nothing typed is lost.

### 3. Indicator UI

- An amber inline banner rendered above the ticket hero: "This ticket was updated elsewhere (Status → Ongoing Service)" with a **Reload ticket** button (discards local edits after a confirm when dirty) and a **Dismiss** link.
- A subtle "Live" dot in the hero next to the Service ID showing the realtime connection is active, plus "Updated <relative time>".

### 4. Status-change specialization

Because status drives the whole status-first field visibility, a remote **status** change always surfaces the banner even when dismissed earlier, and auto-reloads immediately when the form is clean — this is the case that causes wrong fields to show today.

## Technical notes

- Files touched: new `src/hooks/useServiceLiveWatch.ts`; `src/pages/ManageClient.tsx` and `src/pages/ServiceUpdate.tsx` (wire hook, dirty check, banner); optionally a small `src/components/workspace/RemoteUpdateBanner.tsx` shared by both.
- Reuses each page's existing loader, so the sheet→Supabase merge and PDF/photo hydration behaviour stays identical.
- One channel per open ticket tab; the keep-alive workbench outlet keeps hidden tabs mounted, so the hook pauses using `useIsTabActive()` and re-checks on becoming active to avoid idle socket traffic.
- No schema or edge-function changes.
