-- 068 확인(읽기 전용): 함수가 있으면 1
select count(*) as student_stamps_exists
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'student_stamps';
