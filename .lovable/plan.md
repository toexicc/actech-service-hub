# Unlock paid-out Service Breakdown with confirmation

## What changes (Completed Services → expanded ticket)
- The yellow "Paid out — locked" banner gets an **Unlock to edit** button (management only).
- Clicking it opens a confirmation dialog that explains the rule in plain words:
  - "This ticket's commission was already paid to [Technician] in [15th Salary - October 2026]."
  - "Why it's locked: that money has already left the fund and is on a payslip. Changing the split here will NOT change that payslip or its transaction."
  - "Typical case: a shared service (e.g. Kevin + Kenn) where the second technician still needs their share."
  - "What happens after you edit: the new amounts count toward the technicians' NEXT cut-off. If someone was overpaid, deduct it next cut-off."
  - Buttons: Cancel / "I understand, unlock".
- After confirming, Parts Cost, lines, Add Line and Save Breakdown become editable for that ticket only (until the page is closed). Banner changes to "Unlocked for correction — changes apply to the next cut-off."
- Saving logs an activity entry: "Edited paid-out breakdown (unlocked by X)", with old/new values.

## Not changing
- The already-disbursed salary record and transaction stay as they are (no double posting).
- Admins/technicians still see it locked with no unlock button.

## Technical details
- `ServiceBreakdownPanel.tsx`: add `canUnlock` prop, local `unlocked` state, AlertDialog; use `effectiveLocked = locked && !unlocked` everywhere `locked` is used now; log via existing activity logger on save when unlocked.
- `CompletedTransactions.tsx`: pass `canUnlock` when user role is management.
