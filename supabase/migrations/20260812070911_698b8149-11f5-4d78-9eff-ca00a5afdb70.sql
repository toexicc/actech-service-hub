update public.services
set status = 'Completed', payment_status = 'Paid', date_completed = now()
where service_id = 'AC120826022' and status <> 'Completed';

insert into public.activity_logs (actor_name, action, entity_type, entity_id, changes)
values ('System (Auto-Complete)', 'Status auto-changed to Completed (service fully paid)', 'service', 'AC120826022',
 jsonb_build_object('Status', jsonb_build_object('from','Pending Diagnosis','to','Completed'), 'Amount due','7000','Total paid','7000','Triggered by','payment backfill'));