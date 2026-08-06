create or replace function public.staff_directory()
returns table (
  id uuid,
  name text,
  username text,
  department text,
  staff_id text,
  role text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.name,
         p.username,
         p.department,
         p.staff_id,
         (case
            when exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'admin') then 'Admin'
            when exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'management') then 'Management'
            when exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'technician') then 'Technician'
            else ''
          end)::text as role
  from public.profiles p
  where coalesce(p.status, 'active') <> 'deleted';
$$;

revoke all on function public.staff_directory() from public;
grant execute on function public.staff_directory() to authenticated, service_role;