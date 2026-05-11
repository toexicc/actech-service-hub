CREATE OR REPLACE FUNCTION public.profiles_block_self_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role / privileged backend updates (no auth.uid())
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
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
$function$;