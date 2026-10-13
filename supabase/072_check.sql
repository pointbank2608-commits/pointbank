-- 072 확인(읽기 전용, a·b·c 를 다 실행한 뒤): 모두 true 여야 한다
select
  exists (select 1 from information_schema.columns where table_name = 'classes' and column_name = 'chat_mode') as class_chat_mode,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'solo_chat_messages') = 1 as table_ok,
  (select count(*) from pg_proc where proname in ('solo_chat_state', 'solo_chat_send', 'solo_chat_threads', 'solo_chat_thread', 'solo_chat_post', 'solo_chat_set_mode')) = 6 as functions_ok,
  not has_table_privilege('anon', 'public.solo_chat_messages', 'select') as table_hidden_from_anon,
  public.solo_chat_quick_ok('모르겠어요') as quick_ok,
  public.solo_chat_quick_ok('아무 말') = false as quick_rejects_others;
