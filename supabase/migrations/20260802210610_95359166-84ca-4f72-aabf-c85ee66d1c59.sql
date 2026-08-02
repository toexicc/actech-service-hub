CREATE TABLE public.staff_leaves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL,
  staff_name text NOT NULL,
  leave_type text NOT NULL DEFAULT 'sick',
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'approved',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_leaves TO authenticated;
GRANT ALL ON public.staff_leaves TO service_role;

ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view leaves"
ON public.staff_leaves FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin or management can insert leaves"
ON public.staff_leaves FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_management(auth.uid()));

CREATE POLICY "Admin or management can update leaves"
ON public.staff_leaves FOR UPDATE TO authenticated
USING (public.is_admin_or_management(auth.uid()))
WITH CHECK (public.is_admin_or_management(auth.uid()));

CREATE POLICY "Admin or management can delete leaves"
ON public.staff_leaves FOR DELETE TO authenticated
USING (public.is_admin_or_management(auth.uid()));

CREATE TRIGGER staff_leaves_set_updated_at
BEFORE UPDATE ON public.staff_leaves
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX staff_leaves_staff_dates_idx ON public.staff_leaves (staff_id, start_date, end_date);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS approved_services text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pending_services text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approval_locked boolean NOT NULL DEFAULT false;