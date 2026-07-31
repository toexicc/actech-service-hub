ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS technician_diagnosis text,
  ADD COLUMN IF NOT EXISTS client_approved_at timestamp with time zone;

DROP POLICY IF EXISTS "Technicians read assigned services" ON public.services;
DROP POLICY IF EXISTS "Technicians update assigned services" ON public.services;

CREATE POLICY "Technicians read assigned services"
ON public.services FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM unnest(technicians) AS t(name)
    WHERE lower(btrim(t.name)) = lower(btrim(coalesce(public.get_my_name(), '')))
      AND btrim(coalesce(public.get_my_name(), '')) <> ''
  )
);

CREATE POLICY "Technicians update assigned services"
ON public.services FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM unnest(technicians) AS t(name)
    WHERE lower(btrim(t.name)) = lower(btrim(coalesce(public.get_my_name(), '')))
      AND btrim(coalesce(public.get_my_name(), '')) <> ''
  )
);