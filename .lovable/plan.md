# Admin access to Transaction Tracker + interim alert to Romar Badilles

## 1. Hide Transaction Tracker from Admin staff

Today admins open Point of Sales and see a second tab, "Transaction Tracker", listing all money records. Management keeps full access; admins keep the Point of Sale tab only.

- On the Point of Sales page, the Transaction Tracker tab (and its content) only renders for management. When an admin is signed in, the page shows just the sale form with no tab strip.
- The standalone Transaction Tracker page is restricted to management, so an admin reaching it by an old link or saved tab is sent back to the dashboard instead.
- Quick actions and the command palette already list it for management only, so nothing changes there.

## 2. Notify Romar Badilles when an interim ticket returns to Confirmed Diagnosis

New rule: when a ticket has an interim report and its status becomes **Confirmed Diagnosis**, Romar Badilles gets a notification directly (in-app plus push), on top of whatever normal status alerts already go out.

- Fires from both places a status can change: the technician's "Send back to Confirmed Diagnosis" action on Service Update, and a status change saved on Manage Client.
- Only fires when the ticket actually has an interim report (interim text present or the interim flag on), and only when the status changes into Confirmed Diagnosis — not on repeated saves at the same status.
- Message names the ticket, client and device, and says the interim findings are ready for review/quoting. Clicking it opens the ticket.
- If Romar's staff record can't be matched, the alert falls back to management so it is never silently dropped.

## Technical notes

- `src/pages/PointOfSales.tsx`: gate the `transactions` TabsTrigger/TabsContent on the management role (already reads `userRole`), force `activeTab` to `pos` for admins, hide the TabsList when only one tab remains.
- `src/components/workbench/workbenchRoutes.tsx`: `/transaction-tracker` uses `<ProtectedRoute roles={["management"]}>`.
- `src/lib/serviceNotifications.ts`: add `notifyInterimConfirmedDiagnosis(service, byName)` following the existing `PARTS_WATCHERS` pattern — resolve "Romar Badilles" via `fetchStaffList`/`findStaffByName`, fall back to `getManagementStaff`, send through `sendViaEdge` with `serviceId` so navigation works.
- Call it from `src/pages/ServiceUpdate.tsx` (same post-save notification block as `notifyInterimReportSubmitted`) and from the status-change notification path in `src/pages/ManageClient.tsx`, guarded by previous status !== "Confirmed Diagnosis" and an interim report existing.
