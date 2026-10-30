-- 093e: 권한. 학생 함수 둘은 열쇠(token)로만, 선생님 함수는 로그인한 선생님만 부른다.

revoke all on function public.hw_watch_report(uuid, uuid, uuid, int, int) from public, anon, authenticated;
revoke all on function public.hw_watch_state(uuid) from public, anon, authenticated;
revoke all on function public.hw_watch_summary(uuid) from public, anon, authenticated;
grant execute on function public.hw_watch_report(uuid, uuid, uuid, int, int) to anon, authenticated;
grant execute on function public.hw_watch_state(uuid) to anon, authenticated;
grant execute on function public.hw_watch_summary(uuid) to authenticated;
