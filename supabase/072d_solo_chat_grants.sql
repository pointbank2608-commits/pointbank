-- 072: 채팅 — 권한(마지막에 실행)

-- ---------- 권한 ----------
do $do$
declare
  f text;
begin
  foreach f in array array[
    'public.solo_chat_quick_ok(text)', 'public.solo_chat_state(uuid, uuid, boolean)', 'public.solo_chat_send(uuid, uuid, text, boolean)',
    'public.solo_chat_threads()', 'public.solo_chat_thread(uuid)', 'public.solo_chat_post(uuid, text)', 'public.solo_chat_set_mode(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $do$;
grant execute on function public.solo_chat_state(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.solo_chat_send(uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function public.solo_chat_threads() to authenticated;
grant execute on function public.solo_chat_thread(uuid) to authenticated;
grant execute on function public.solo_chat_post(uuid, text) to authenticated;
grant execute on function public.solo_chat_set_mode(uuid, text) to authenticated;
