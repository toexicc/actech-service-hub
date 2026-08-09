CREATE OR REPLACE FUNCTION public.public_release_summary(_service_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'service_id', s.service_id,
    'client_name', s.client_name,
    'contact_number', s.contact_number,
    'email', s.email,
    'device_type', s.device_type,
    'brand', s.brand,
    'model', s.model,
    'color', s.color,
    'memory', s.memory,
    'service', s.service,
    'status', s.status,
    'chief_complaint', s.chief_complaint,
    'repair_time_frame', s.repair_time_frame,
    'date_received', s.date_received,
    'service_date', s.service_date
  )
  from public.services s
  where s.service_id = btrim(_service_id)
  limit 1;
$function$;