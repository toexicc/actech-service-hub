CREATE TABLE public.device_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('brand','model','color','storage')),
  value text NOT NULL,
  brand text,
  usage_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX device_catalog_unique_entry
  ON public.device_catalog (kind, lower(value), coalesce(lower(brand), ''));

CREATE INDEX device_catalog_kind_value ON public.device_catalog (kind, value);

GRANT SELECT, INSERT, UPDATE ON public.device_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_catalog TO anon;
GRANT ALL ON public.device_catalog TO service_role;

ALTER TABLE public.device_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the device catalogue"
  ON public.device_catalog FOR SELECT USING (true);

CREATE POLICY "Anyone can add catalogue entries"
  ON public.device_catalog FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update catalogue entries"
  ON public.device_catalog FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER device_catalog_set_updated_at
  BEFORE UPDATE ON public.device_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();