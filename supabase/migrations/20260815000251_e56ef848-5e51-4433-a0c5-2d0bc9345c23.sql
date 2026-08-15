CREATE POLICY "Public read device report files"
ON public.service_files
FOR SELECT
TO anon
USING (kind = 'device_report'::service_file_kind);