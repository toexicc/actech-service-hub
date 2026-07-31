CREATE OR REPLACE FUNCTION public.is_assigned_technician(_technicians text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(_technicians, ARRAY[]::text[])) AS t(name)
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE btrim(COALESCE(t.name, '')) <> ''
      AND (
        lower(btrim(t.name)) = lower(btrim(COALESCE(p.name, '')))
        OR lower(btrim(t.name)) = lower(btrim(COALESCE(p.username, '')))
      )
  );
$$;

DROP POLICY IF EXISTS "Technicians read assigned services" ON public.services;
DROP POLICY IF EXISTS "Technicians update assigned services" ON public.services;

CREATE POLICY "Technicians read assigned services"
ON public.services FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'technician'::app_role) AND public.is_assigned_technician(technicians));

CREATE POLICY "Technicians update assigned services"
ON public.services FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'technician'::app_role) AND public.is_assigned_technician(technicians))
WITH CHECK (has_role(auth.uid(), 'technician'::app_role));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services','part_requests','inventory_parts','fast_moving_parts','transactions','expenses','client_inquiries'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;