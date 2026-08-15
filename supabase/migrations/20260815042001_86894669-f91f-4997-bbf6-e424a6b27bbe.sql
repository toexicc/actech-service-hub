CREATE TABLE public.kiosk_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  purpose text NOT NULL DEFAULT 'attendance',
  token_hash text NOT NULL,
  allowed_ip text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone,
  last_seen_ip text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_devices TO authenticated;
GRANT ALL ON public.kiosk_devices TO service_role;

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view kiosk devices"
  ON public.kiosk_devices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can update kiosk devices"
  ON public.kiosk_devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'management'))
  WITH CHECK (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Management can delete kiosk devices"
  ON public.kiosk_devices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'management'));

CREATE TRIGGER kiosk_devices_set_updated_at
  BEFORE UPDATE ON public.kiosk_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();