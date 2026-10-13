-- 069 확인(읽기 전용): 함수가 있고 anon 이 실행할 수 있으면 둘 다 true
select
  (select count(*) from pg_proc where proname = 'student_game_template') = 1 as function_exists,
  has_function_privilege('anon', 'public.student_game_template(uuid, uuid)', 'execute') as anon_can_call;
