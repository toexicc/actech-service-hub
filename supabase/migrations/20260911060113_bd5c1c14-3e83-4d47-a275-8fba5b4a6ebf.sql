ALTER TABLE public.service_files
  DROP CONSTRAINT IF EXISTS service_files_uploaded_by_fkey;

ALTER TABLE public.service_files
  ADD CONSTRAINT service_files_uploaded_by_fkey
  FOREIGN KEY (uploaded_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;