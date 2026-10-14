-- 077 확인 — 읽기 전용
select
  to_regclass('public.remote_sessions') is not null as table_ok,
  exists(select 1 from pg_policies where tablename = 'remote_sessions' and policyname = 'remote_sessions_own') as policy_ok,
  exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'remote_sessions') as realtime_ok;
