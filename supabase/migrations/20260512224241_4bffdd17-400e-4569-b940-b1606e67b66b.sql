DROP FUNCTION IF EXISTS public.get_staff_directory();

CREATE FUNCTION public.get_staff_directory()
RETURNS TABLE(id uuid, name text, username text, staff_id text, department text, status text, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.name, p.username, p.staff_id, p.department, p.status,
    COALESCE(
      (SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id
        ORDER BY CASE r.role WHEN 'admin' THEN 3 WHEN 'management' THEN 2 WHEN 'technician' THEN 1 ELSE 0 END DESC
        LIMIT 1), ''
    ) AS role
  FROM public.profiles p
  ORDER BY p.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO anon, authenticated;