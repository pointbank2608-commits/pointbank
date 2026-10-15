-- 082 확인(읽기 전용)
select
  to_regclass('public.platform_admin_emails') is not null as emails_table,
  (select count(*) from public.platform_admin_emails) as admin_emails,
  exists (select 1 from pg_proc where proname = 'admin_delete_academy') as delete_fn,
  pg_get_functiondef('public.is_platform_admin()'::regprocedure) like '%aal2%' as mfa_enforced;
