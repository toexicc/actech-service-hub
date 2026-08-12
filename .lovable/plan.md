# Make the Reports output numbers trustworthy

I replayed the real activity log against the aggregation code. The log data itself is complete and correctly worded — the numbers look "too low" because of how Completed is counted, and there are three genuine accuracy bugs in how actors are identified.

## What I verified in the log

- Payment logs: 137 rows (`POS: Recorded … Payment …`) across 124 tickets, every row has an actor and a ticket ID. 143 payment transactions exist, so a handful predate logging or were voided.
- Release logs: 33 rows (`Device released to client…`) across 32 tickets — matches the 32 completed release-queue entries plus one manual release.
- No duplicate log rows. Status transitions and "New service created" logs parse correctly.

Last 30 days, per person (raw log counts vs. what the leaderboard shows in Completed):

```text
Actor                      status→Completed  payments  releases  Completed shown
Charles Westley Anonuevo         20            33        17           46
Khaye Naranja                     5            38         2           39
Jewel Mae Arinabo                 4            23         0           25
John Paul Espedido                7             9        12           23
Romar Badilles                   10             7         0           13
```

## Why Completed is lower than the activity count

Completed counts **distinct tickets** a person closed, not events. If the same person moves a ticket to Completed, takes the payment, and hands over the device, that is 3 log entries but 1 ticket — so it credits Completed once (deliberate, to stop one ticket inflating the score). Charles has 70 closing activities on 46 distinct tickets, which is exactly the 46 shown.

Fix for the confusion: keep Completed as tickets closed, and add explicit **Paid** and **Released** columns showing the event counts, so the panel shows both the ticket count and the activity count instead of one number that looks wrong.

## Accuracy bugs to fix

1. **System actors are treated as staff.** `System (Auto-Complete)`, `System (Notifications)`, `System (Client Approval)`, `System (Quotation Sync)` all appear as people in the leaderboard and "Who moves tickets" — Auto-Complete in particular is credited with completing tickets. Exclude any actor starting with `System` / equal to `System`.
2. **Split identities.** The same person appears under multiple names, so their output is spread across rows: `Regil Badilles - Management` vs `Regil Badilles`, `Khaye` vs `Khaye Naranja`, and login-email actors (`ebaclayon-admin@actech.com`, `ebaclayon-tech@actech.com`). Normalise by stripping a trailing ` - <role>` suffix, resolving emails against the staff directory (username/email match), and merging a short name into a directory full name when it is an unambiguous prefix. Unresolvable actors stay as-is rather than being dropped.
3. **Voided payments still credit the actor.** `Voided transaction TXN…` rows exist. If a payment was later voided for that ticket, don't count that payment event (releases and status moves are unaffected).

## Also worth knowing (no change unless you want it)

- Down payments count the same as full payments toward Completed. Say the word if only full payments should count.
- Turnaround/stage-time metrics ignore payment and release entries (they have no target status), so those averages are unchanged by any of this.

## Technical notes

- `src/lib/reportMetrics.ts`
  - Add a `SYSTEM_ACTOR_RE` guard in `buildActorOutput`'s `relevant` filter.
  - Add a `canonicalActor(name, staff)` helper (suffix strip, email/username lookup, prefix merge) used for the accumulator key and display name.
  - `parseStatusLog` recognises `Voided transaction …` as `event: "void"`; `buildActorOutput` drops payment events for `(actor, ticket)` pairs that have a matching void.
  - `ActorOutput` gains `paid` and `released` (event) counts; Completed stays ticket-deduped.
- `src/pages/Reports.tsx`: add Paid and Released columns to the Output leaderboard, and adjust the hint text to explain Completed = distinct tickets closed.
- No schema or backend changes; everything is derived from existing `activity_logs`.
