-- 076 확인(읽기 전용): 모두 true 여야 한다
select
  exists (select 1 from information_schema.columns where table_name = 'classes' and column_name = 'notice_text') as notice_text_col,
  exists (select 1 from information_schema.columns where table_name = 'classes' and column_name = 'notice_until') as notice_until_col,
  exists (select 1 from pg_proc where proname = 'class_notice_set') as set_fn,
  exists (select 1 from pg_proc where proname = 'solo_notice') as solo_fn,
  exists (select 1 from pg_proc where proname = 'hw_notice') as hw_fn,
  has_function_privilege('anon', 'public.solo_notice(uuid)', 'execute') as solo_anon,
  has_function_privilege('anon', 'public.hw_notice(uuid)', 'execute') as hw_anon,
  not has_function_privilege('anon', 'public.class_notice_set(uuid, text, integer)', 'execute') as set_not_anon;
