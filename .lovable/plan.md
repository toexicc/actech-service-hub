## Scope note
All intake-form changes apply **only to the internal `/service-form`**. The public `/intake` form is left exactly as it is today.

## Client Intake Form (`/service-form` only)

**1. Chief Complaint — AI Formatter button**
- Add a small "Format with AI" button beside the Chief Complaint label (rendered only when `!isPublic`).
- Calls the existing `format-diagnosis` edge function (or a new brief mode) with a strict system prompt: "Rewrite the following into a concise 1–2 sentence chief complaint. No headings, no bullets, plain prose, max 2 sentences."
- Replaces the textarea value with the returned text. Loading spinner + toast on error.

**2. Technician assignment — auto round-robin by department**
- Remove the technician `MultiSelect` from the internal form.
- Replace it with a `MultiSelect` of **Technician Departments** (from `DEPARTMENTS` in `src/lib/constants.ts`, filtered by the departments that handle the selected device type — same rule already used to filter techs).
- On submit, for each selected department:
  - Fetch active technicians in that department.
  - Count each tech's active-service load from `services` (excluding Completed / Cancelled / RTO) where `technicians` array contains their name.
  - Pick the tech with the **lowest** count; tie-break alphabetically for determinism → fair sequential rotation across submissions.
- Store the resolved technician names in `services.technicians` and their departments in `services.technician_departments` exactly as today, so downstream code is unchanged.
- Show a read-only preview under the department picker: "Will be assigned to: {tech name}" that updates live.
- Public `/intake` form keeps its current behavior (no technician field there today either).

**3. Priority — add "Within The Day"** (internal form only)
- Add `"Within The Day"` to `PRIORITY_OPTIONS` in `src/lib/constants.ts` and to the Priority `<Select>` in `/service-form`. Placed at the top.
- Public `/intake` priority UI unchanged.

**4. Client Type — new options** (internal form only)
- On `/service-form`, replace the current three options with:
  - New Client - Walk In
  - New Client - Pickup
  - Returning Client - Walk In
  - Returning Client - Pickup
  - Backjob
- Update the existing "Returning Client" auto-set on client lookup (line 246) to default to `Returning Client - Walk In`.
- Public `/intake` client-type UI unchanged.

## Service Tracker (`/service-tracker`) — new tabs

Add new tabs to the top strip (kept alongside existing Ongoing / Completed / Cancelled-RTO-On Hold):
- **All** — every service.
- **Within the Day** — `priority === "Within The Day"`.
- **Walk In** — `clientType` contains `"Walk In"` (matches both New and Returning walk-ins).
- **Intake** — services created via the public `/intake` form (`source === "intake"`; column already exists).

Filtering hooks into the current in-memory filter pipeline; no data model changes.

## Technical notes
- No schema migration required; `source`, `priority`, `client_type`, `technicians`, `technician_departments` already exist.
- Auto-assign load query: single `supabase.from("services").select("technicians,status").not("status","in","(Completed,Cancelled,RTO)")` at submit time, counted client-side.
- AI formatter uses the existing Lovable AI gateway via an edge function; no new secret.
- Frontend-only + one edge function tweak.
