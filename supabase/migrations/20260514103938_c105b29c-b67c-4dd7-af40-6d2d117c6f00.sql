-- Make diagnosis-photos bucket public so /track can display photos to clients
UPDATE storage.buckets SET public = true WHERE id = 'diagnosis-photos';

-- Allow anonymous read on service_files for diagnosis_photo rows only
CREATE POLICY "Public read diagnosis photo files"
ON public.service_files FOR SELECT
TO anon
USING (kind = 'diagnosis_photo');