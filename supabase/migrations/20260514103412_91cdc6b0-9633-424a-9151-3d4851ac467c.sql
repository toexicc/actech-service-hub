-- Add diagnosis_photo to service_file_kind enum
ALTER TYPE public.service_file_kind ADD VALUE IF NOT EXISTS 'diagnosis_photo';

-- Create private bucket for diagnosis photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagnosis-photos', 'diagnosis-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for diagnosis-photos bucket
CREATE POLICY "Auth read diagnosis photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'diagnosis-photos');

CREATE POLICY "Auth upload diagnosis photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'diagnosis-photos');

CREATE POLICY "Auth update diagnosis photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'diagnosis-photos');

CREATE POLICY "Auth delete diagnosis photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'diagnosis-photos');