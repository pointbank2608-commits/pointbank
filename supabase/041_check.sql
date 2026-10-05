-- 041 확인용(읽기만 함). 041_homework_v2.sql 을 실행한 뒤, 이 파일 전체를 붙여 넣고 Run 한 번.
-- 결과는 표 하나로 나온다: 항목마다 기대값·실제값·통과(ok) — ok 칸이 모두 true 면 정상.
select item, expected, actual, expected = actual as ok
from (
  select 1 as n, '새 표 수' as item, '5' as expected,
         (select count(*) from information_schema.tables where table_schema = 'public'
            and table_name in ('homework_assignment_targets', 'homework_items', 'homework_item_attempts', 'learning_events', 'student_hw_pins'))::text as actual
  union all
  select 2, '새 함수 수', '17',
         (select count(distinct p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and p.proname in ('hw_open', 'hw_login_name', 'hw_open_personal', 'hw_state', 'hw_submit', 'hw_progress', 'hw_finish',
                              'hw_create_v2', 'hw_reset_pin', 'hw_pin_status', 'hw_personal_links', 'hw_class_overview', 'hw_assignment_summary',
                              'student_learning_card', 'student_review_candidates', 'academy_homework_usage', 'hw_grade'))::text
  union all
  select 3, '지운 옛 함수(hw_login·hw_answer)', '0',
         (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('hw_login', 'hw_answer'))::text
  union all
  select 4, 'PIN 평문 남은 학생', '0', (select count(*) from public.students where hw_pin is not null)::text
  union all
  select 5, '선생님 브라우저가 PIN 해시 표를 읽을 수 있나', 'false', has_table_privilege('authenticated', 'public.student_hw_pins', 'select')::text
  union all
  select 6, '학생(익명)이 PIN 해시 표를 읽을 수 있나', 'false', has_table_privilege('anon', 'public.student_hw_pins', 'select')::text
  union all
  select 7, '활동이 없는 숙제', '0',
         (select count(*) from public.homework_assignments a where not exists (select 1 from public.homework_items i where i.assignment_id = a.id))::text
  union all
  select 8, '대상 학생이 없는 숙제', '0',
         (select count(*) from public.homework_assignments a where not exists (select 1 from public.homework_assignment_targets t where t.assignment_id = a.id))::text
  union all
  select 9, '활동이 연결 안 된 옛 답', '0', (select count(*) from public.homework_answers where item_id is null)::text
  union all
  select 10, '학생(익명)이 실행할 수 있는 숙제 함수',
         'hw_finish,hw_login_name,hw_open,hw_open_personal,hw_progress,hw_state,hw_submit',
         (select string_agg(distinct p.proname, ',' order by p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and (p.proname like 'hw\_%' or p.proname like 'student\_%' or p.proname = 'academy_homework_usage')
             and has_function_privilege('anon', p.oid, 'execute'))
  union all
  select 11, '숙제 열기 함수에 학생 명단이 없나', 'true',
         (select bool_and(prosrc not like '%''students''%') from pg_proc where proname = 'hw_open' and pronamespace = 'public'::regnamespace)::text
  union all
  select 12, '서버 채점(보기·틀린 보기·철자·순서·틀린 순서)', 'true,false,true,true,false',
         concat_ws(',',
           public.hw_grade('{"qtype":"choice","correct":2}', '2')::text,
           public.hw_grade('{"qtype":"choice","correct":2}', '1')::text,
           public.hw_grade('{"qtype":"text","correct":"color/colour"}', ' Colour. ')::text,
           public.hw_grade('{"qtype":"order","correct":["c","a","t"]}', '["c","a","t"]')::text,
           public.hw_grade('{"qtype":"order","correct":["c","a","t"]}', '["a","c","t"]')::text)
) checks
order by n;
