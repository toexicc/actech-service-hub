ALTER TABLE public.salary_disbursements
  ADD COLUMN IF NOT EXISTS overtime_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_allowance numeric NOT NULL DEFAULT 0;