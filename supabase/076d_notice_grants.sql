-- 076: 채팅 3차 — 반 전체 공지(4/4) 권한(마지막에 실행)

revoke all on function public.class_notice_set(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.solo_notice(uuid) from public, anon, authenticated;
revoke all on function public.hw_notice(uuid) from public, anon, authenticated;
grant execute on function public.class_notice_set(uuid, text, integer) to authenticated;
grant execute on function public.solo_notice(uuid) to anon, authenticated;
grant execute on function public.hw_notice(uuid) to anon, authenticated;
