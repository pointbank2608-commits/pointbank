-- 040 확인용(읽기만 함): 표 3개·함수 6개가 생기고, 학생마다 PIN 이 채워졌는지
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('homework_assignments', 'homework_attempts', 'homework_answers', 'homework_pin_failures')) as tables_4,
  (select count(*) from pg_proc where proname in ('hw_create', 'hw_open', 'hw_login', 'hw_state', 'hw_answer', 'hw_finish')) as functions_6,
  (select count(*) from public.students where hw_pin is null) as students_without_pin_0;
