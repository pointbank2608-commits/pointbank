-- 081 확인(읽기 전용)
select
  to_regclass('public.academy_deletion_requests') is not null as requests_table,
  exists (select 1 from pg_proc where proname = 'request_academy_deletion') as request_fn,
  exists (select 1 from pg_proc where proname = 'cancel_academy_deletion') as cancel_fn,
  exists (select 1 from pg_proc where proname = 'my_deletion_request') as status_fn,
  exists (select 1 from pg_proc where proname = 'purge_due_deletions') as purge_fn,
  exists (select 1 from pg_proc where proname = 'delete_my_teacher_account') as teacher_fn;
