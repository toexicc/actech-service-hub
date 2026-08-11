# Segmented AI diagnosis, PDF spacing, /track approval gate, technician field

## 1. Split the AI diagnosis into separate fields

Today "Format with AI" writes one long block into a single AI Diagnosis field, and every consumer (quotation PDF, /track, breakdown parser) re-parses that text with regexes. That re-parsing is the source of the recurring drift. Change the AI step to fill distinct fields instead.

New fields on a ticket:

- **AI Diagnosis** — header lines (Customer Name, Device Type, Model, Service ID), `AC TECH DEVICE DIAGNOSIS`, then Findings, Cause of Issue, Suggested Solution, Recommendations. Nothing else.
- **Service Breakdown** — the existing structured quotation lines (service, optional Option A/B with prices). Filled from the AI output instead of parsed from prose.
- **Warranty** — one line per service: `Service name: {duration}`, editable.
- **Other Notes** — free text, manual only, never written by AI.
- **Summary** — one-line generated summary, editable.
- **Disclaimer** — fixed, non-editable, not stored:
  "To proceed with the service, please review the diagnosis and click APPROVE to confirm your acceptance. Kindly ensure that you have also reviewed our Terms and Conditions before submitting your approval." plus "Note: The quoted price is exclusive of 12% VAT."

Where each appears:

- Quotation PDF "Technician Diagnosis" panel: AI Diagnosis + Warranty + Other Notes + Disclaimer (Summary excluded — it already prints in Service Summary; breakdown already prints in Service Breakdown).
- /track AI Diagnosis card: same set, Summary excluded (shown separately), breakdown rendered as the approval checklist.
- /manage-client and /service-update: each field gets its own editable box inside the AI Diagnosis container, in the order above, with the disclaimer shown read-only.

Formatting with AI overwrites AI Diagnosis, Warranty, Summary and the breakdown lines; Other Notes is left untouched. Existing tickets keep working: when the new fields are empty, the current text is split on load so nothing looks broken.

## 2. Quotation PDF spacing (screenshot 1)

Cause found in the generator: the diagnosis panel is shrunk to fit the left column of page 1 by scaling the font down in steps all the way to 0.3 (about 2pt), and the last step is applied even when it still does not fit. At that size the text is unreadable and the word spaces visually collapse, which is exactly the jammed "Uponinspection,thekeyboard" block in the screenshot.

Fix:

- Stop scaling at a readable floor (no smaller than ~85% of the base size).
- When the content does not fit at that floor, let it flow into the next region / page (the panel flow already supports pagination) instead of squeezing.
- Draw each wrapped line at an explicit line height rather than handing the whole array to one text call, so line spacing stays even.
- Apply the same floor to the Summary / Breakdown pair so those panels cannot be squeezed either.
- Segmenting the diagnosis (part 1) also removes the mixed heading/paragraph guesswork that produced the uneven gaps.

## 3. "Quote is not ready for approval" on /track (screenshot 2, AC100826027)

Cause: /track only treats a quote as ready when the ticket has saved structured breakdown lines. If the ticket reaches Waiting to Proceed while the breakdown table has not been saved yet (amounts typed only into the diagnosis text), the page shows the red "not ready" banner and blocks Approve, even though the client can see prices in the text.

Fix:

- When no saved breakdown exists but the diagnosis text carries priced lines, use those priced lines for the checklist so the client can approve.
- Only show "not ready" when there is genuinely no price anywhere (all amounts still placeholders / zero).
- On /manage-client, block moving a ticket to Waiting to Proceed until the breakdown is saved with real amounts, with a clear message — so this state cannot be created again.

Once the diagnosis is segmented, the breakdown is always a real saved field and this gate becomes a formality.

## 4. Technician not showing in the technician field

Checked the data: every ticket from the last week has an assigned technician, so nothing was lost on save. The cause is display-side: the technician dropdowns hide technicians who have no Time In for the day or are on approved leave. A ticket assigned to someone who is absent today therefore renders with an empty technician field, and re-saving the ticket can drop the name.

Fix:

- Always include the technicians already assigned to the open ticket in the options, marked "currently unavailable", regardless of attendance/leave.
- Never clear an assignment because the assignee is missing from the options list.
- Show the assigned names as read-only text when the field is not editable, so it is never blank.

## Technical notes

- New columns on `public.services`: `diagnosis_warranty text`, `diagnosis_other_notes text`, `diagnosis_summary text` (breakdown stays in `quoted_breakdown`).
- `format-diagnosis` returns a JSON object (`diagnosis`, `breakdown[]`, `warranty`, `summary`) instead of a single string; the existing placeholder/warranty enforcement moves into the structured fields. `submit-client-approval` keeps reading `quoted_breakdown` and needs no change.
- Files: `supabase/functions/format-diagnosis/index.ts`, `src/lib/aiFormatters.ts`, `src/lib/serviceApproval.ts` (legacy-text splitter for old tickets), `src/pages/ManageClient.tsx`, `src/pages/ServiceUpdate.tsx`, `src/pages/ServiceTracking.tsx`, `src/lib/quotationPdfGenerator.ts`, `src/lib/serviceRecordShape.ts`.
