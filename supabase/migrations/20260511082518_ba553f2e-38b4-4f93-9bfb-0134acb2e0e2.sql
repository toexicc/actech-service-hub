
-- 1. PROFILES
DROP POLICY IF EXISTS "Anyone authenticated can read profiles" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admin/management read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin_or_management(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile (limited)"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.profiles_block_self_sensitive_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_or_management(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.salary IS DISTINCT FROM OLD.salary
     OR NEW.salary_type IS DISTINCT FROM OLD.salary_type
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only admins or management can change name, staff_id, department, salary, salary_type, or status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_sensitive_changes_tr ON public.profiles;
CREATE TRIGGER profiles_block_self_sensitive_changes_tr
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_block_self_sensitive_changes();

CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  staff_id text,
  department text,
  status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, username, staff_id, department, status
  FROM public.profiles
  ORDER BY name;
$$;

REVOKE ALL ON FUNCTION public.get_staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated;

-- 2. READ RECEIPTS
DROP POLICY IF EXISTS "Auth read receipts" ON public.read_receipts;

CREATE POLICY "Members read receipts"
ON public.read_receipts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = read_receipts.message_id
      AND public.is_thread_member(m.thread_id, auth.uid())
  )
);

-- 3. STORAGE: chat attachments private
DROP POLICY IF EXISTS "Auth read service buckets" ON storage.objects;
DROP POLICY IF EXISTS "Auth read chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Members read chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth write chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat attachments" ON storage.objects;

CREATE POLICY "Auth read service buckets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN (
    'intake-forms',
    'quotation-forms',
    'signatures',
    'annotations',
    'device-reports',
    'expense-receipts'
  )
);

CREATE POLICY "Members read chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.attachment_path = storage.objects.name
      AND public.is_thread_member(m.thread_id, auth.uid())
  )
);

CREATE POLICY "Auth upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- 4. Restrict definer helpers from anon role
REVOKE EXECUTE ON FUNCTION public.is_thread_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_management(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_name() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_service_id() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_thread_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_management(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_name() TO authenticated;
