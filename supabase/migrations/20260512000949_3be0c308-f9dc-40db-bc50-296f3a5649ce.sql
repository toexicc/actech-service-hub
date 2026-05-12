
CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  staff_name text NOT NULL,
  log_date date NOT NULL,
  time_in timestamptz,
  time_out timestamptz,
  is_late boolean NOT NULL DEFAULT false,
  is_overtime boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, log_date)
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mgmt read all attendance"
ON public.attendance_logs FOR SELECT TO authenticated
USING (public.is_admin_or_management(auth.uid()) OR staff_id = auth.uid());

CREATE POLICY "Mgmt write attendance"
ON public.attendance_logs FOR ALL TO authenticated
USING (public.is_admin_or_management(auth.uid()))
WITH CHECK (public.is_admin_or_management(auth.uid()));

CREATE POLICY "Auth insert attendance"
ON public.attendance_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Auth update own attendance"
ON public.attendance_logs FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER attendance_logs_updated_at
BEFORE UPDATE ON public.attendance_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_attendance_logs_date ON public.attendance_logs(log_date DESC);
CREATE INDEX idx_attendance_logs_staff ON public.attendance_logs(staff_id, log_date DESC);
