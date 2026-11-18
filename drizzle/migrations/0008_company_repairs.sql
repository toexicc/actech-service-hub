CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  contact_number text,
  email text,
  billing_address text,
  tin text,
  vat_default boolean NOT NULL DEFAULT true,
  notes text,
  public_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX companies_public_token_idx ON public.companies(public_token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid())) WITH CHECK (public.is_admin_or_management(auth.uid()));
CREATE TRIGGER companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.company_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  received_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_batches TO authenticated;
GRANT ALL ON public.company_batches TO service_role;
ALTER TABLE public.company_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view batches" ON public.company_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage batches" ON public.company_batches FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid())) WITH CHECK (public.is_admin_or_management(auth.uid()));

CREATE TABLE public.company_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_no text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_ids text[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'combined',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_amount numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_quotations_company_idx ON public.company_quotations(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_quotations TO authenticated;
GRANT ALL ON public.company_quotations TO service_role;
ALTER TABLE public.company_quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view quotations" ON public.company_quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage quotations" ON public.company_quotations FOR ALL TO authenticated
  USING (public.is_admin_or_management(auth.uid())) WITH CHECK (public.is_admin_or_management(auth.uid()));

ALTER TABLE public.services
  ADD COLUMN company_id uuid,
  ADD COLUMN company_batch_id uuid,
  ADD COLUMN company_location text,
  ADD COLUMN needs_individual_quote boolean NOT NULL DEFAULT false,
  ADD COLUMN quotation_request_status text;
CREATE INDEX services_company_idx ON public.services(company_id) WHERE company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.public_company_portal(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
    'company', jsonb_build_object('name', c.name, 'contact_person', c.contact_person),
    'batches', coalesce((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'label', b.label) ORDER BY b.created_at DESC)
                         FROM company_batches b WHERE b.company_id = c.id), '[]'::jsonb),
    'services', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'service_id', s.service_id, 'batch_id', s.company_batch_id, 'location', s.company_location,
        'serial_number', s.serial_number, 'brand', s.brand, 'model', s.model,
        'issue', coalesce(s.chief_complaint, s.issue_description), 'status', s.status::text,
        'is_on_hold', s.is_on_hold, 'quotation_status', s.quotation_request_status,
        'total', CASE WHEN coalesce(s.final_cost,0) > 0 THEN s.final_cost ELSE s.service_cost END,
        'date_received', s.date_received, 'date_completed', s.date_completed) ORDER BY s.date_received DESC)
      FROM services s WHERE s.company_id = c.id), '[]'::jsonb),
    'quotations', coalesce((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'quotation_no', q.quotation_no,
        'service_ids', q.service_ids, 'payload', q.payload, 'final_amount', q.final_amount, 'created_at', q.created_at) ORDER BY q.created_at DESC)
      FROM company_quotations q WHERE q.company_id = c.id), '[]'::jsonb)
  ) END
  FROM (SELECT 1) d LEFT JOIN companies c ON c.public_token = btrim(_token) AND length(btrim(_token)) >= 20;
$$;
GRANT EXECUTE ON FUNCTION public.public_company_portal(text) TO anon, authenticated;