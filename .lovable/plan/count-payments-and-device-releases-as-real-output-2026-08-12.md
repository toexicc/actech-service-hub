# Count payments and device releases as real output

Right now the Reports "Who moves tickets" and "Output leaderboard" panels only count status transitions and ticket creation. Staff who take the payment or hand the device to the client don't get credited, even though both are logged.

## What changes

Two more kinds of activity get counted, both landing in the **Completed** column:

- **Payment processed** — the staff who recorded a payment on a ticket (POS entries).
- **Device released** — the staff who confirmed the device release (queue release and manual release).

Each of these also counts toward that person's **Moves** and **Tickets touched**, and toward **Driven end-to-end** when they had already moved the same ticket earlier. Voided transactions are not counted.

A ticket that gets both a payment and a release by the same person counts once in Completed for that ticket, so a single ticket can't inflate the number — the same de-duplication already used for status-based completions.

## Technical notes

- `src/lib/reportMetrics.ts`
  - `StatusLogEntry` gains an optional `event: "payment" | "release"` field.
  - `parseStatusLog` recognises the existing log wording: actions starting with `POS: Recorded ... Payment ...` become `event: "payment"`; actions matching `Device released to client` become `event: "release"`. `Voided transaction ...` stays unparsed.
  - `buildActorOutput`: include entries with an `event` in the `relevant` filter; for those, add to `moves`, `tickets`, and `completed` (guarded by `completedTickets` so payment + release on one ticket credits Completed once). Also feed them into the per-actor/ticket move tally used by `drivenEndToEnd`.
- `src/hooks/useServiceStatusLogs.ts` needs no change — it already fetches all `entity_type = 'service'` logs paginated.
- Turnaround/stage-timing metrics keep ignoring these entries (they have no `to` status), so average-time numbers are unaffected.
- Reports panel hint text updated so Completed reads as "closed, paid, or released".
