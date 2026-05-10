
CREATE TABLE IF NOT EXISTS public.service_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL,
  service_name text NOT NULL DEFAULT '',
  technician_id uuid,
  technician_name text NOT NULL DEFAULT '',
  cost numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_breakdowns_service_id ON public.service_breakdowns(service_id);
CREATE INDEX IF NOT EXISTS idx_service_breakdowns_technician_id ON public.service_breakdowns(technician_id);

ALTER TABLE public.service_breakdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read breakdowns"
ON public.service_breakdowns FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Mgmt write breakdowns"
ON public.service_breakdowns FOR ALL
TO authenticated
USING (public.is_admin_or_management(auth.uid()) OR created_by = auth.uid())
WITH CHECK (public.is_admin_or_management(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER set_service_breakdowns_updated_at
BEFORE UPDATE ON public.service_breakdowns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
