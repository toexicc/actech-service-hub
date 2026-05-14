-- Phase 1 & 3: Add missing intake/diagnosis fields to services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS device_password TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS memory TEXT,
  ADD COLUMN IF NOT EXISTS device_notes TEXT,
  ADD COLUMN IF NOT EXISTS technician_report TEXT,
  ADD COLUMN IF NOT EXISTS final_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parts_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_date DATE,
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS acknowledgements JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signature_path TEXT,
  ADD COLUMN IF NOT EXISTS device_annotation_path TEXT,
  ADD COLUMN IF NOT EXISTS device_annotation_notes TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Phase 10: salary deductions ledger for refunds and other adjustments
CREATE TABLE IF NOT EXISTS public.salary_deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL,
  staff_name TEXT NOT NULL,
  service_id TEXT,
  transaction_id TEXT,
  reason TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  applied_to_period TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mgmt read salary deductions"
  ON public.salary_deductions FOR SELECT TO authenticated
  USING (is_admin_or_management(auth.uid()) OR staff_id = auth.uid());

CREATE POLICY "Mgmt write salary deductions"
  ON public.salary_deductions FOR ALL TO authenticated
  USING (is_admin_or_management(auth.uid()))
  WITH CHECK (is_admin_or_management(auth.uid()));

CREATE TRIGGER set_salary_deductions_updated_at
  BEFORE UPDATE ON public.salary_deductions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();