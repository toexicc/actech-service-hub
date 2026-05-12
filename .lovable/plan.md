
# Plan

Four independent tasks. Items 1–3 are fixes; item 4 is a new feature with two pages plus DB.

## 1. Salary "Deduct From" — show balance and block insufficient funds

**File:** `src/pages/SalaryDisbursement.tsx`

- In the Deduct From `<SelectItem>`, render fund name + current balance (e.g. `Money In Bank — Php 12,500.00`).
- Show the selected fund's available balance below the dropdown.
- If `selectedFundBalance < totalDisbursed` (or `< 0`), disable the **Submit Transaction** button and show a red "Insufficient funds" message.
- Reverts the prior change that explicitly hid the balance.

## 2. Parts used by a technician — deduct inventory + log as parts cost (not expense)

**Problem today:** when a technician marks parts used on a service, the inventory quantity is not decremented and there is no entry in parts cost — so it surfaces only as a generic expense in POS / Completed Transactions.

**Files:**
- `src/pages/ServiceUpdate.tsx` (or wherever parts get added to a service — verify on implementation)
- `src/hooks/useInventory.ts` / `inventory_parts` table
- `supabase/functions/sheets-bridge/index.ts` (Sheets backend Parts Cost column)
- `src/pages/PointOfSales.tsx` and `src/pages/CompletedTransactions.tsx` (read-side: ensure parts pulled from service `parts_used` are categorized as **Parts Cost**, not generic expense)

**Changes:**
- On save of a service with `parts_used` change:
  - Decrement `inventory_parts.quantity` for each added Part ID; increment when a Part ID is removed (return) or service deleted.
  - Write a `part_logs` row: action = `Used` / `Returned`, with `service_id`, `quantity`, `performed_by`.
  - Record a parts-cost line tied to the service so POS and Completed Transactions read it as **Parts Cost**, not as a standalone expense.
- Ensure idempotency: only diff between previous and new `parts_used` is applied (avoid double-decrementing on edit).

## 3. Logout button not clearing session

**Files:** `src/components/DashboardLayout.tsx`, `src/hooks/useAuth.tsx`

- `handleLogout` currently does `sessionStorage.clear(); navigate("/")` but never calls `supabase.auth.signOut()`. The Supabase session in `localStorage` survives reload and `onAuthStateChange` re-hydrates the previous user.
- Fix: call `await supabase.auth.signOut()` first, then clear `sessionStorage`, then `navigate("/", { replace: true })`.
- Also clear any cached React Query state (`queryClient.clear()`).

## 4. Biometric attendance system

### 4a. New page `/attendance` (public, accessible from login screen or menu)

- Dropdown of all active staff (from `profiles`).
- Password input.
- Two buttons: **Time In** / **Time Out**.
- On submit:
  - Verify password by calling `supabase.auth.signInWithPassword` against the staff's email/username — on success, immediately sign back out so this does not establish a session.
  - Insert into new `attendance_logs` table.
  - Time In: tag `late = true` if `time > 10:00 AM` local (Asia/Manila).
  - Time Out: tag `overtime = true` if `time > 7:00 PM`.
  - Show a confirmation toast with name + timestamp.

### 4b. New management page `/attendance-overview`

- Table per day: Employee, Time In, Late?, Time Out, Overtime?, Total Hours.
- Date range filter, employee filter, CSV export.
- Visible only to `admin` / `management` (sidebar entry under Admin Portal).

### 4c. Salary Disbursement integration

- In `SalaryDisbursement.tsx`, auto-fill `daysPresent[staff.staffId]` from `attendance_logs` count for the active period (Mon–Sat, with at least one valid Time In).
- Keep the existing input editable so management can override.

### Database (`supabase--migration`)

```sql
CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,        -- profiles.id
  staff_name text NOT NULL,
  log_date date NOT NULL,
  time_in timestamptz,
  time_out timestamptz,
  is_late boolean DEFAULT false,
  is_overtime boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, log_date)
);
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
-- Anyone authenticated can insert their own row via password check (or via edge fn)
-- Mgmt/admin can read all; staff can read own.
```

RLS policies:
- `Mgmt read all`: `is_admin_or_management(auth.uid())`
- `Self read own`: `staff_id = auth.uid()`
- Insert/update via SECURITY DEFINER edge function `record-attendance` so we can verify password without leaving an active session on the kiosk.

### Routing & nav
- `src/App.tsx`: add `/attendance` (public) and `/attendance-overview` (protected: admin/management).
- `src/components/DashboardLayout.tsx`: add "Attendance Overview" to Admin Portal.
- Add "Time In/Out" link on Login page footer for kiosk access.

---

## Suggested order of execution
1. Logout fix (smallest, unblocks user testing).
2. Salary Deduct From balance gating.
3. Attendance DB + kiosk page + overview page + Salary integration.
4. Parts inventory deduction + Parts Cost logging.
