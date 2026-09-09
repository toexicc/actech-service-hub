CREATE OR REPLACE FUNCTION public.delete_service_permanently(_service_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service_id text := btrim(COALESCE(_service_id, ''));
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_deleted boolean := false;
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'management') THEN
    RAISE EXCEPTION 'Only management can permanently delete services';
  END IF;

  IF v_service_id = '' THEN
    RAISE EXCEPTION 'Service ID is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.services WHERE service_id = v_service_id) THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  SELECT COALESCE(NULLIF(btrim(name), ''), NULLIF(btrim(username), ''), 'Management')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = v_actor_id;

  DELETE FROM public.service_breakdowns WHERE service_id = v_service_id;
  DELETE FROM public.transactions WHERE service_id = v_service_id;
  DELETE FROM public.part_logs WHERE service_id = v_service_id;
  DELETE FROM public.part_requests WHERE service_id = v_service_id;
  DELETE FROM public.notifications WHERE service_id = v_service_id;
  DELETE FROM public.salary_deductions WHERE service_id = v_service_id;
  DELETE FROM public.client_inquiries WHERE service_id = v_service_id;
  DELETE FROM public.queue_entries WHERE service_id = v_service_id;
  DELETE FROM public.activity_logs WHERE entity_type = 'service' AND entity_id = v_service_id;
  DELETE FROM public.services WHERE service_id = v_service_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO public.activity_logs (actor_id, actor_name, action, entity_type, entity_id, changes)
  VALUES (
    v_actor_id,
    COALESCE(v_actor_name, 'Management'),
    'Permanently deleted service',
    'service_deletion',
    v_service_id,
    jsonb_build_object('service_id', v_service_id, 'permanent', true)
  );

  RETURN jsonb_build_object('deleted', v_deleted, 'service_id', v_service_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_service_permanently(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_service_permanently(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_permanently(text) TO service_role;