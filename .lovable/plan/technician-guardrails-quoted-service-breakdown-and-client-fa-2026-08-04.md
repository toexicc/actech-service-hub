# Technician guardrails, quoted service breakdown, and client-facing status labels

## 1. Technician status guardrails (reminder + tightening)

Today on /service-update the status dropdown blocks a fixed list of statuses (Pending Diagnosis — unless reverting from Confirmed Diagnosis, Waiting to Proceed, Proceed Repair, Done Repair - Advise Client, Completed, Backjob, RTO, Cancelled). Everything else is freely selectable, so a technician can jump from Pending Diagnosis straight to Done Repair - For Release.

Change to a strict "next step only" map. From the ticket's current saved status, a technician may pick only:

```text
Pending Diagnosis            -> Confirmed Diagnosis
Confirmed Diagnosis          -> Pending Diagnosis (revert only)
Waiting to Proceed           -> (none - admin gate)
Proceed Repair               -> Ongoing Service
Ongoing Service              -> Done Repair - Under Observation
Done Repair - Under Observation -> Done Repair - For Release
Done Repair - For Release    -> (none - admin/POS closes it)
everything else              -> (none)
```

Any other option is hidden/disabled with a short explanation of the allowed next step. Admin and management keep the current full dropdown on /manage-client.

## 2. Technician diagnosis / report move inside the AI containers

On /manage-client and /service-update:
- Move the "Technician Diagnosis" textarea inside the AI Diagnosis collapsible, directly above the action buttons.
- Move the "Technician Report" textarea inside the AI Report collapsible, directly above its action buttons.

On /service-update (technician view), replace the current "hide until stage" behaviour with "reveal once, then lock":
- AI Diagnosis block (with technician diagnosis inside) is editable only while the status is Pending Diagnosis; afterwards it stays visible but read-only.
- AI Report block (with technician report inside) is editable only while the status is Done Repair - Under Observation; afterwards it stays visible but read-only.
- Once a block has appeared it never disappears again, so technicians can re-read it at any stage.

## 3. Client-facing status labels on /track

Internal status stays unchanged; only the label the client sees changes.

| Internal | Shown on /track |
| --- | --- |
| Pending Diagnosis | Pending Diagnosis |
| Confirmed Diagnosis | Confirmed Diagnosis |
| Waiting to Proceed | Waiting to Proceed |
| Proceed Repair | Under Repair |
| Ongoing Service | Under Repair |
| Done Repair - Under Observation | Under Repair |
| Done Repair - For Release | Under Observation |
| Done Repair - Advise Client | For Release |
| Completed | Completed |
| RTO | Return to Owner |
| anything else | unchanged |

The tracker step chips collapse accordingly: Pending -> Confirmed -> Waiting (hidden when pre-approved) -> Under Repair -> Under Observation -> For Release -> Completed.

## 4. Remove Backjob

Drop "Backjob" from the status options and from every status list/branch that references it (service update dropdown, tracker off-path chips, done-repair stage list, reports/tracker filters). Existing tickets on Backjob, if any, keep displaying the raw text but it can no longer be selected.

## 5. Quoted service breakdown driven by the Approve button

On /manage-client, clicking Approve on the AI Diagnosis will, in addition to copying the SUMMARY into Service/s, parse the AI diagnosis "Service Breakdown" lines into an editable quoted-breakdown table rendered directly above Service Cost:

```text
[x] {Repair name}          Php {cost}
[x] {Repair name}          Php {cost}
Service Cost               Php {total of ticked lines}
```

- Each line has a checkbox, an editable name and an editable amount; lines can be added or removed.
- Service Cost is computed from the ticked lines (Final Cost keeps its existing Service Cost minus Discount math).
- The table is saved with the ticket on Update and used by the Service Quotation PDF's cost fields.

On /track, the approval checklist is replaced by this saved breakdown: the client sees each line with its price, can tick/untick, and the displayed service cost / total updates live. On submit, the approval edge function stores which lines were approved and recalculates the ticket's service cost, final cost and the Approval Remark (approved vs pending lines) exactly as it does today.

## 6. Terms and Conditions

Replace the bundled `AC_Tech_Terms_and_Condition.pdf` with the uploaded TERMS_AND_CONDITIONS_NOV_28.pdf so the intake/quotation PDF appendix and the /track "Terms and Conditions" document both serve the new version.

## Technical notes

- New `quoted_breakdown jsonb` column on `public.services` holding `[{ name, cost, selected }]`. This is separate from `service_breakdowns` (technician commission allocation) and is the source of truth for what the client sees and approves.
- `src/lib/serviceApproval.ts` gains helpers to parse/serialise the quoted breakdown and to total the selected lines; the `submit-client-approval` edge function reuses them so client-side and server-side totals cannot drift.
- Status labelling centralised in a `clientStatusLabel()` helper in `src/lib/serviceStatus.ts`, consumed by /track only.
- Technician transition map added to `src/lib/serviceStatus.ts` (`allowedNextStatuses(current, role)`) and consumed by /service-update.
