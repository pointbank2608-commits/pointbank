-- 071 확인(읽기 전용): 둘 다 true 여야 한다
select
  (select count(*) from pg_proc where proname = 'solo_live') = 1 as function_exists,
  not has_function_privilege('anon', 'public.solo_live(uuid, int)', 'execute') as anon_blocked;
