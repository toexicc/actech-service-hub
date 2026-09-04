# Flags, chips, flexible payments, smarter search, one customer = one ID

## 1. New toggles on Manage Client

Below the pre-approved diagnosis block, add two toggles:

- **Rush** — on/off by hand, and switched on automatically when the priority is Rush. Turning it on also ticks the existing "Rush Fee (Add 10% to Total Cost)" option so the 10% lands in the total; turning it off unticks it.
- **Released** — on/off by hand, and switched on automatically when the device is released through the release queue or a manual release.

Inside the Waiting for Parts container, above the Waiting for Parts row:

- **Pre-Order** — a simple flag saying this ticket has a pre-order.

**Waiting for Parts** stays visible to admins but only management can switch it (admins see the state and the parts note, read-only).

## 2. Chips on the two tracker views

- Add **Released** and **Pre-Order** chips alongside the existing Rush / Backjob / Waiting for Parts chips on Service Tracker and Service Tracking.
- Table view on both pages: replace the **Txn Status** column with a Flags column showing the same chips, so chips are visible in cards and table.
- Remove the "Within the Day" chip from the RTO filter view.

## 3. Point of Sale accepts payment before a final cost

Remove the block that stops a payment when the ticket has no final cost yet. Any amount (full, partial, deposit) can be recorded; it is treated as credit on the ticket and is deducted automatically once a final cost exists, so the balance shown reflects payments already made.

## 4. Search by name and device on Manage Client and Service Update

The search box accepts a ticket number, a customer name, or a device (brand/model). As you type, a dropdown lists matching tickets (ticket number, name, device, status); picking one loads it. Typing a full ticket number still loads directly.

## 5. One customer, one Client ID

- **Backlog clean-up:** merge duplicate customer records that are clearly the same person into a single Client ID and repoint their tickets. Matching rule (conservative, so unrelated people are never merged): normalised name is the same or a near match (spacing, casing, punctuation, middle initials) **and** the phone number or email matches, or the other record has no phone/email at all. Every merge is listed for review before it's applied.
- **Client Intake Form:** the Client ID search also searches by customer name, with a dropdown of matches to pick from.
- **Queue → Intake:** when a queued intake's name looks like an existing customer, show a "Link to existing customer" button with the likely matches so staff attach the intake to that Client ID instead of creating a new one.

## Technical notes

- Migration: add `services.is_released boolean not null default false`, `services.released_at timestamptz`, `services.has_pre_order boolean not null default false` (the legacy `pre_order` text column is left untouched). No new grants needed — `services` grants already exist.
- New toggles live in `src/components/workspace/TicketFlagsPanel.tsx` (Pre-Order + gated Waiting for Parts) and in `ManageClient.tsx` for Rush/Released, wired to the existing `rushFee` state so `calcFinal`/`calcVat` pick up the 10%. Release paths (`ReleaseQueuePanel.tsx`, manual release in `QueueAdmin.tsx`, `ConfirmReleaseModal.tsx`) set `is_released`/`released_at`.
- Management gate uses the existing role check already used elsewhere (`useAuth` role / `is_admin_or_management` semantics) — read-only rendering for admins, no DB policy change.
- Chips: extract a small shared `TicketFlagChips` component used by cards + table cells in `ServiceTracker.tsx` and `ServiceTracking.tsx`; `useServices`/list column sets extended with the two new fields.
- POS: drop the `parseCurrency(finalCostRaw) <= 0` early return in `PointOfSales.tsx`; keep the existing overpay guard only when a final cost exists.
- Search dropdown: debounced Supabase query on `services` (`service_id`, `client_name`, `brand`, `model`) limited to ~10 rows, reusing `useDebounce`; selection calls the existing `searchService(id)` path so the mismatch guard still works.
- Client merge: one-off SQL using normalised names plus phone/email agreement, updating `services.client_id` and deleting the emptied duplicate rows; run after the match list is reviewed.
- Intake linking: `ensureClient` in `src/hooks/useClients.ts` gains a name-similarity lookup helper used by the intake form search and the queue link button.
