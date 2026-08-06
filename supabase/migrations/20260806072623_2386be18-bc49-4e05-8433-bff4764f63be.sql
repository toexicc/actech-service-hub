ALTER TABLE public.services ADD COLUMN IF NOT EXISTS repair_time_frame text;

CREATE OR REPLACE FUNCTION public.public_service_snapshot(_service_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'service_id', s.service_id,
    'client_id', s.client_id,
    'client_name', s.client_name,
    'username', s.username,
    'contact_number', s.contact_number,
    'email', s.email,
    'device_type', s.device_type,
    'brand', s.brand,
    'model', s.model,
    'serial_number', s.serial_number,
    'color', s.color,
    'memory', s.memory,
    'conditions', s.conditions,
    'device_notes', s.device_notes,
    'chief_complaint', s.chief_complaint,
    'issue_description', s.issue_description,
    'service', s.service,
    'status', s.status,
    'priority', s.priority,
    'diagnosis', s.diagnosis,
    'ai_report', s.ai_report,
    'technician_report', s.technician_report,
    'quoted_breakdown', s.quoted_breakdown,
    'service_cost', s.service_cost,
    'discount', s.discount,
    'vat_requested', s.vat_requested,
    'final_cost', s.final_cost,
    'total_cost', s.total_cost,
    'parts_cost', s.parts_cost,
    'estimated_cost', s.estimated_cost,
    'initial_payment', s.initial_payment,
    'payment_status', s.payment_status,
    'target_date', s.target_date,
    'estimated_completion', s.estimated_completion,
    'repair_time_frame', s.repair_time_frame,
    'service_date', s.service_date,
    'date_received', s.date_received,
    'date_completed', s.date_completed,
    'client_approved_at', s.client_approved_at,
    'auto_approve_diagnosis', s.auto_approve_diagnosis,
    'approved_services', s.approved_services,
    'pending_services', s.pending_services,
    'approval_locked', s.approval_locked,
    'internal_admin_notes', s.internal_admin_notes,
    'client_type', s.client_type,
    'drive_folder_url', s.drive_folder_url,
    'device_report_folder_url', s.device_report_folder_url,
    'last_updated', s.last_updated
  )
  from public.services s
  where s.service_id = btrim(_service_id)
  limit 1;
$function$;