CREATE OR REPLACE FUNCTION public.delete_service_permanently(_service_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service_id text := btrim(COALESCE(_service_id, ''));
  v_deleted_count integer := 0;
BEGIN
  IF v_service_id = '' THEN
    RAISE EXCEPTION 'Service ID is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.services WHERE service_id = v_service_id) THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

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
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('deleted', v_deleted_count > 0, 'service_id', v_service_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_service_permanently(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_permanently(text) TO service_role;