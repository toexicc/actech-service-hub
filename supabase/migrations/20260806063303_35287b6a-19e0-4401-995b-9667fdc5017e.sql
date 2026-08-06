create or replace function public.public_service_snapshot(_service_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.public_service_snapshot(text) from public;
grant execute on function public.public_service_snapshot(text) to anon, authenticated;

create or replace function public.public_client_services(_client_id text)
returns table(service_id text, status text, service text, target_date date, service_cost numeric, final_cost numeric)
language sql
stable
security definer
set search_path = public
as $$
  select s.service_id, s.status::text, s.service, s.target_date, s.service_cost, s.final_cost
  from public.services s
  where nullif(btrim(_client_id), '') is not null
    and lower(btrim(s.client_id)) = lower(btrim(_client_id))
  order by s.date_received desc;
$$;

revoke all on function public.public_client_services(text) from public;
grant execute on function public.public_client_services(text) to anon, authenticated;