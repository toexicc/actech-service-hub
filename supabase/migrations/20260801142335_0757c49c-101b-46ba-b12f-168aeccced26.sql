-- Replace admin-only delete policy with admin + management
DROP POLICY IF EXISTS "Admins delete services" ON public.services;

CREATE POLICY "Admins or management delete services"
ON public.services
FOR DELETE
TO authenticated
USING (public.is_admin_or_management(auth.uid()));

-- Allow removing dependent rows so deletes don't fail on FKs
DROP POLICY IF EXISTS "Admins or management delete service files" ON public.service_files;
CREATE POLICY "Admins or management delete service files"
ON public.service_files
FOR DELETE
TO authenticated
USING (public.is_admin_or_management(auth.uid()));

-- service_files.service_id -> services.service_id : cascade on delete
ALTER TABLE public.service_files
  DROP CONSTRAINT IF EXISTS service_files_service_id_fkey;

ALTER TABLE public.service_files
  ADD CONSTRAINT service_files_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(service_id) ON DELETE CASCADE;