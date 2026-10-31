ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery';

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_on_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS on_hold_reason text;

CREATE TABLE public.interim_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL,
  round integer NOT NULL,
  interim_diagnosis text,
  ai_interim_report text,
  interim_warranty text,
  interim_summary text,
  interim_breakdown_text text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_by_name text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, round)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interim_reports TO authenticated;
GRANT ALL ON public.interim_reports TO service_role;
ALTER TABLE public.interim_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read interim" ON public.interim_reports FOR SELECT TO authenticated
  USING (public.is_admin_or_management(auth.uid()) OR public.has_role(auth.uid(),'technician'));
CREATE POLICY "staff write interim" ON public.interim_reports FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid()) OR public.has_role(auth.uid(),'technician'))
  WITH CHECK (public.is_admin_or_management(auth.uid()) OR public.has_role(auth.uid(),'technician'));
CREATE TRIGGER interim_reports_updated BEFORE UPDATE ON public.interim_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.interim_reports (service_id, round, interim_diagnosis, ai_interim_report, interim_warranty, interim_summary, interim_breakdown_text, status, decided_at, created_at)
SELECT service_id, 1, interim_diagnosis, ai_interim_report, interim_warranty, interim_summary, interim_breakdown_text,
  CASE WHEN interim_approved_at IS NOT NULL THEN 'approved' ELSE 'pending' END, interim_approved_at, coalesce(interim_created_at, now())
FROM public.services WHERE interim_needed = true OR ai_interim_report IS NOT NULL;

CREATE TABLE public.pickup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date date NOT NULL,
  kind text NOT NULL DEFAULT 'pickup',
  client_name text NOT NULL,
  service_id text,
  contact_number text,
  city text,
  address text,
  time_window text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled',
  reschedule_reason text,
  rescheduled_from date,
  completed_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_schedules TO authenticated;
GRANT ALL ON public.pickup_schedules TO service_role;
ALTER TABLE public.pickup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage pickups" ON public.pickup_schedules FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid())) WITH CHECK (public.is_admin_or_management(auth.uid()));
CREATE POLICY "delivery read pickups" ON public.pickup_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'delivery'));
CREATE POLICY "delivery update pickups" ON public.pickup_schedules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'delivery'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'delivery'));
CREATE TRIGGER pickup_schedules_updated BEFORE UPDATE ON public.pickup_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.public_service_snapshot_verified(_service_id text, _last4 text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v jsonb; sid text := upper(btrim(_service_id));
BEGIN
  IF public.public_track_pin_matches(_service_id, _last4) <> 'ok' THEN RETURN NULL; END IF;
  v := public.public_service_snapshot(sid);
  IF v IS NULL THEN RETURN NULL; END IF;
  RETURN v || jsonb_build_object(
    'is_on_hold', (SELECT is_on_hold FROM public.services WHERE service_id = sid),
    'interim_rounds', coalesce((SELECT jsonb_agg(jsonb_build_object('round', round, 'ai_interim_report', ai_interim_report,
       'interim_warranty', interim_warranty, 'interim_summary', interim_summary, 'interim_breakdown_text', interim_breakdown_text,
       'status', status, 'created_at', created_at, 'decided_at', decided_at) ORDER BY round)
     FROM public.interim_reports WHERE service_id = sid), '[]'::jsonb));
END $function$;