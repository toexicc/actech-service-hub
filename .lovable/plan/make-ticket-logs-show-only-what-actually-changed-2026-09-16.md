# Make ticket logs show only what actually changed

## What's happening now

Both edit pages already build the log from a field-by-field comparison, but the comparison is too literal, so unchanged fields still look changed:

- **Service Breakdown** is compared as raw text of the whole list. When the same three services are saved again, the fields come back in a different internal order (`cost, name, required, selected` vs `name, cost, selected, required`), so it counts as a change and the whole list gets dumped into the log as raw code — exactly the entry in the screenshot.
- **Money and number fields** compare as text, so `16500` vs `16500.00` (or a blank vs `0`) reads as a change.
- **Lists** (technicians, services, parts, approved/pending services) and **dates** compare as text too, so a re-order or a different date spelling counts as a change.
- Long text fields (diagnosis, reports, notes) count as changed on invisible differences like trailing spaces or line-break style.
- Even when a change is real, the summary line repeats a lot of the content, so a simple status change reads like a wall of text.

Result: "I only changed the status" produces a log line naming five or six fields.

## What we'll change

1. **Compare values by meaning, not by text.** Numbers compare as numbers, yes/no as yes/no, lists as sets of items regardless of order, dates as calendar dates, and long text after normalising spacing — so unchanged fields drop out of the log entirely.
2. **Service Breakdown logs in plain words.** Instead of raw code, the log names only what moved: `Added "Battery Replacement" ₱6,500`, `Removed "Touch Bar Replacement"`, `"LCD Screen Panel Replacement" ₱16,800 → ₱15,000`, `"Battery Replacement" now selected`. If nothing moved, nothing is logged.
3. **Keep the headline short.** The one-line summary lists the changed field names with short values (status stays spelled out as `Status: A → B` so the turnaround-time clock keeps working). Full before/after values stay under "Details".
4. **Skip empty saves.** If a save changes nothing, no log entry is written at all, instead of an entry with a bogus field list.
5. Same rules applied on **Manage Client** and **Service Update**, including parts used and photo counts.

Old log entries stay as they are; this only affects entries written from now on.

## Technical notes

- Extend `diffFields` in `src/lib/activityLogger.ts` with an optional per-field comparator/kind (`number`, `bool`, `list`, `date`, `text`) and default-equality that trims/collapses whitespace; add `diffBreakdown(before, after)` producing human-readable add/remove/price/selection lines from `quoted_breakdown` items keyed by normalised name.
- `src/pages/ManageClient.tsx` (~line 1484) and `src/pages/ServiceUpdate.tsx` (~line 1099): tag each field with its kind, replace the `JSON.stringify(quotedBreakdown)` entry with `diffBreakdown`, and keep the guard that only logs when `changes.length > 0`.
- Preserve the `Status: <from> → <to>` substring in `action` — `STATUS_RE` / `parseStatusLog` in `src/lib/reportMetrics.ts` depends on it for duration and report metrics.
- No schema change; `ActivityTimeline` rendering stays as is.
