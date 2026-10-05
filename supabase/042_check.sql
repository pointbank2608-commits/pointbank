-- 042 확인용(읽기만 함). 전체를 붙여 넣고 Run 한 번 — ok 칸이 모두 true 면 정상.
select item, expected, actual, expected = actual as ok
from (
  select 1 as n, '포인트 받음 칸' as item, '1' as expected,
         (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'homework_attempts' and column_name = 'rewarded_at')::text as actual
  union all
  select 2, '새 함수(hw_reward·student_report_extras)', '2',
         (select count(distinct proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('hw_reward', 'student_report_extras'))::text
  union all
  select 3, '학생(익명)이 새 함수를 실행할 수 있나', 'false',
         (has_function_privilege('anon', 'public.hw_reward(uuid, uuid, uuid[], date)', 'execute')
          or has_function_privilege('anon', 'public.student_report_extras(uuid, int)', 'execute'))::text
  union all
  select 4, '결과 함수에 포인트 받음 표시', 'true',
         (select bool_and(prosrc like '%''rewarded''%') from pg_proc where pronamespace = 'public'::regnamespace and proname = 'hw_assignment_summary')::text
) checks
order by n;
