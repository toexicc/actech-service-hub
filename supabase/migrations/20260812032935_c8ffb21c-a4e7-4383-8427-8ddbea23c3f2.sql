CREATE POLICY "Uploaders delete own service files"
ON public.service_files
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());