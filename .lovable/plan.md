## Confirmed cause

`AC010826002` was reused by three separate queue completions on August 1: Keihl James Valencia, Charlene Aquino, and Isaiah John Verdejo. The database has a unique constraint on `services.service_id`, but historical creation logic updated/upserted the existing row, so Isaiah’s identity fields replaced Keihl’s while Keihl’s diagnosis, payment, and documents remained attached.

The current frontend now uses a plain insert for new tickets, but ID allocation is still client-side and ticket creation remains split across multiple write paths. Queue history also currently allows multiple entries to reference the same service ID.

## Recovery and permanent fix

1. **Recover the affected records**
   - Preserve `AC010826002` as Keihl James Valencia’s completed iPhone 14 Pro Max service.
   - Rebuild Keihl’s intake identity fields from queue entry `Q-0015`, while retaining his existing diagnosis, Php 3,800 transaction, quotation, diagnosis photos, and other correctly timed files.
   - Keep Charlene Aquino on `AC010826999` and reconcile her queue/document references to that ticket.
   - Keep Isaiah John Verdejo on his separate existing ticket `AC010826809`, merge only Isaiah-owned files/details into it, and remove Isaiah data from Keihl’s ticket.
   - Update all affected queue, file, transaction, breakdown, notification, and log references consistently rather than changing only the visible service row.

2. **Move ticket creation into one atomic backend operation**
   - Add an authenticated database function that allocates a collision-safe service ID and inserts the service in the same transaction.
   - Lock a queue entry while completing it so one intake cannot be converted twice.
   - Make queue completion idempotent: reopening or double-clicking the same queue entry returns its already-created service instead of creating or overwriting another one.
   - Retain the existing `AC + date + suffix` display format while making suffix allocation concurrency-safe.

3. **Remove unsafe creation paths**
   - Replace client-side “check then insert” allocation in the intake form with the atomic backend function.
   - Ensure every new-service path uses insert-only semantics; retain update calls only for explicit editing of a known ticket.
   - Align the legacy bridge creation path with the same backend allocator so it cannot independently reuse an ID.
   - Remove the remaining service creation upsert branch.

4. **Add database guardrails**
   - Make `services.service_id` immutable after creation.
   - Add a unique constraint/index preventing multiple completed queue entries from pointing to the same service ID after the corrupted references are repaired.
   - Keep all existing role-based access controls and grant only the minimum authenticated function permissions required.

5. **Validate the repair**
   - Verify `AC010826002` shows Keihl across `/track`, `/manage-client`, `/service-update`, tracker, PDFs, photos, logs, and POS payment history.
   - Verify Charlene and Isaiah remain isolated on their own IDs and documents.
   - Test simultaneous submissions and repeated completion of one queue entry to prove no existing service can be overwritten.
   - Confirm newly created tickets appear in dashboards and trackers without reload.