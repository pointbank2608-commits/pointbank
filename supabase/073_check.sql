-- 073 확인(읽기 전용): 모두 true 여야 한다
select
  exists (select 1 from information_schema.columns where table_name = 'solo_chat_messages' and column_name = 'hw_attempt_id') as hw_column,
  (select is_nullable = 'YES' from information_schema.columns where table_name = 'solo_chat_messages' and column_name = 'assignment_id') as assignment_nullable,
  exists (select 1 from pg_proc where proname = 'hw_chat_state') as state_fn,
  exists (select 1 from pg_proc where proname = 'hw_chat_send') as send_fn,
  (select count(*) from pg_proc where proname = 'solo_chat_threads') = 1 as one_threads_fn,
  has_function_privilege('anon', 'public.hw_chat_state(uuid, boolean)', 'execute') as anon_state,
  has_function_privilege('anon', 'public.hw_chat_send(uuid, text, boolean)', 'execute') as anon_send,
  not has_function_privilege('anon', 'public.solo_chat_threads()', 'execute') as threads_not_anon;
