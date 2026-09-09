# Intake straight to the ticket, with Backjob / Rush / Pre-Order

## 1. Three new toggles on the staff intake form

Just above the Client Acknowledgement section, a small flags block with three switches (default off):

- **Rush** — carried to the ticket as Rush, and the 10% rush fee is applied to the ticket right away.
- **Backjob** — carried to the ticket as the Backjob flag.
- **Pre-Order** — carried to the ticket as the Pre-Order flag.

They appear on the staff intake form and on the Complete Intake form used in the queue console — but not on the public form clients fill in themselves. The same chips then show up everywhere flags already show (ticket page, Service Tracker, Service Tracking), because they are the same ticket flags.

Since Rush is available here as a toggle, nothing changes about the priority list (Rush was already removed from it).

## 2. After submitting, go straight to the ticket

On a successful staff submission, instead of just showing the success message and clearing the form, the page opens the new ticket on Manage Client with that ticket number already loaded — no searching. The success message still names the ticket number, and the intake PDF still generates as it does today.

The public form keeps its current behaviour. The queue "Complete Intake" window closes as it does today and the console shows the finished entry.

## 3. Pre-Order tickets open the payment window with a down payment ready

When Pre-Order was switched on during intake, the ticket page opens and the payment window opens with it:

- Transaction type pre-selected as **Down Payment**.
- Amount pre-filled with 50% of the Estimated Cost entered on the intake form, editable. If no estimate was entered, the amount is left blank for staff to type.

Closing the window leaves the ticket loaded as normal. Nothing is charged until staff press record.

## Technical notes

- `create_service_atomic` gains `is_backjob` and `has_pre_order` in its insert list, read from the payload the same way `rush_fee` already is (migration; `rush_fee` needs no change).
- `ServiceForm.tsx`: three new boolean fields on the zod schema/defaults (`isRush`, `isBackjob`, `hasPreOrder`), rendered as switches in a flags card before Client Acknowledgement, gated on `!isPublic`. `servicePayload` sets `rush_fee: data.isRush`, `is_backjob`, `has_pre_order`. Also appended to the sheets `formData` for parity.
- Post-submit navigation: after `form.reset()`, when not `isPublic` and not `embedded`, `navigate(\`/manage-client?serviceId=${finalServiceId}${data.hasPreOrder ? \`&pos=1&posType=Down%20Payment&posAmount=${(estimatedCost/2).toFixed(2)}\` : ""}\`)`. Embedded (queue) submissions keep calling `onCompleted` only.
- `ManageClient.tsx`: the existing `searchParams` effect (auto-search on `serviceId`) additionally reads `pos`, `posType`, `posAmount`; after the ticket loads it sets `paymentModalOpen` and passes the presets down.
- `TicketPaymentModal.tsx`: new optional `presetType` / `presetAmount` props used when the modal opens (its open-effect currently resets `type` to "Full Payment" and `amount` to ""), so the editable service lines, warranty block and validation all stay untouched.
