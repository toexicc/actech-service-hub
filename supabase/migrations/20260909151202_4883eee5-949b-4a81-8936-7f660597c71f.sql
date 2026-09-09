ALTER TYPE public.service_file_kind ADD VALUE IF NOT EXISTS 'receipt';
ALTER TYPE public.service_file_kind ADD VALUE IF NOT EXISTS 'warranty';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS warranty_terms jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE POLICY "Auth read pos document buckets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = ANY (ARRAY['receipts'::text, 'warranty-cards'::text]));

CREATE POLICY "Auth upload pos document buckets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = ANY (ARRAY['receipts'::text, 'warranty-cards'::text]));

CREATE POLICY "Auth update pos document buckets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = ANY (ARRAY['receipts'::text, 'warranty-cards'::text]));

CREATE POLICY "Auth delete pos document buckets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = ANY (ARRAY['receipts'::text, 'warranty-cards'::text])
  AND ((owner = auth.uid()) OR public.is_admin_or_management(auth.uid())));