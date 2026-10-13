-- 070 확인(읽기 전용): 둘 다 true 여야 한다
select
  (select count(*) from pg_proc where proname = 'solo_help_done') = 1 as function_exists,
  has_function_privilege('anon', 'public.solo_help_done(uuid, uuid)', 'execute') as anon_can_call;
