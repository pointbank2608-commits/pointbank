-- 045 확인용(읽기만 함): 표 5개·함수 12개가 생기고, 학원마다 학생 코드가 채워졌는지, 학생·번호 표가 브라우저에서 막혔는지
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('private_config', 'student_guardian', 'student_sessions', 'student_login_failures')) as tables_4,
  (select count(*) from pg_proc where proname in ('student_login', 'student_home', 'student_logout', 'academy_student_code', 'academy_student_code_reset', 'student_guardian_status', 'student_guardian_set', 'student_guardian_reveal', 'student_guardian_clear')) as functions_9,
  (select count(*) from public.academies where student_code is null) as academies_without_code_0,
  not has_table_privilege('anon', 'public.student_guardian', 'select') as guardian_hidden_from_anon,
  not has_table_privilege('authenticated', 'public.private_config', 'select') as config_hidden;
