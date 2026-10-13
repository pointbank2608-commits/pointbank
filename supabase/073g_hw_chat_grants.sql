-- 073: 채팅 2차 — 권한(마지막에 실행)

revoke all on function public.hw_chat_state(uuid, boolean) from public, anon, authenticated;
revoke all on function public.hw_chat_send(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.hw_chat_state(uuid, boolean) to anon, authenticated;
grant execute on function public.hw_chat_send(uuid, text, boolean) to anon, authenticated;

-- 다시 정의한 선생님 함수의 권한도 한 번 더 맞춘다
revoke all on function public.solo_chat_threads() from public, anon, authenticated;
revoke all on function public.solo_chat_thread(uuid) from public, anon, authenticated;
revoke all on function public.solo_chat_post(uuid, text) from public, anon, authenticated;
grant execute on function public.solo_chat_threads() to authenticated;
grant execute on function public.solo_chat_thread(uuid) to authenticated;
grant execute on function public.solo_chat_post(uuid, text) to authenticated;
