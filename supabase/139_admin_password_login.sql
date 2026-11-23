-- User-approved removal of the second-factor requirement across admin routes.
-- Apply after 138 and deploy the AdminLayout change in the same release.
begin;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false);
$$;
commit;
