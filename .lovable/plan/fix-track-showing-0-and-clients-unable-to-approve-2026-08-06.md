# Fix /track showing ₱0 and clients unable to approve

## What's actually wrong

Verified in the backend:

- The quotation data is correct in the database. Example ticket `AC050826016` stores `Screen Assembly Replacement — 29,500` and `Internal Cleaning — 1,500`, both marked required/selected, with a service cost of 31,000.
- The `services` table has **no read policy for anonymous (not-signed-in) visitors** — only signed-in admins/management/technicians can read it.
- `/track` looks the ticket up in Google Sheets first, then tries to enrich it from the database. For a public visitor that database read silently returns nothing, so the page falls back to the old Sheets copy:
  - no `quoted_breakdown` → the approval list is rebuilt by parsing the diagnosis text, which has no amounts → every line shows **₱0** and **Optional** instead of Required
  - `service_cost`, `discount`, VAT flag, approved-services and lock state are all missing too

That also explains "cannot approve": the shared approval rules reject any ticked line whose amount is 0, so clients get "Please fix the highlighted service lines" / "select at least one service" no matter what they tick. Staff pages work because they read the database while signed in.

## The fix

1. **Add a public, read-only snapshot function in the backend** (security definer, callable by anonymous visitors) that takes a Service ID and returns only tracking-safe fields: status, service, diagnosis/report text, quoted breakdown, service cost, discount, VAT flag, target date / time frame, approved + pending services, approval lock, auto-approve flag, approval remark, completion dates, device info shown on /track. No staff-only or sensitive columns.
2. **Make /track database-first**: look the ticket up through this function, and only use Google Sheets as a fallback when the database has no record. Apply the same for the "search by Client ID" list so costs and statuses there match.
3. **Keep amounts trustworthy in the checklist**: when a stored breakdown exists it is used as-is (correct amounts, Required/Optional badges, pre-ticked lines, chosen options). Remove the silent "parse names out of the diagnosis with ₱0" fallback for the approval checklist — if the shop hasn't published a priced breakdown, show a short "the shop is still finalising your quote" note instead of an unapprovable ₱0 list.
4. **Guard the approve action** so a genuine failure gives a clear reason (e.g. "This quote is not ready for approval yet — please contact the shop") rather than the generic highlight message.
5. Verify end-to-end on a real Waiting-to-Proceed ticket in a signed-out browser session: amounts render, Required badges show, approval submits and the ticket advances.

## Technical notes

- New SQL migration: `public.public_service_snapshot(_service_id text)` returning JSON, `security definer`, `set search_path = public`, `grant execute to anon, authenticated`. Existing table policies stay untouched, so no broadening of table access.
- `src/pages/ServiceTracking.tsx`: replace the `from("services").select("*")` merge with an `supabase.rpc("public_service_snapshot", …)` call; reorder `handleSearch` to try the snapshot first and Sheets second; drop the `parseServiceBreakdownItems` fallback used for `quotedLines`.
- No change needed in `src/lib/serviceApproval.ts` or the `submit-client-approval` function — they already recost from the stored breakdown once the data arrives.
