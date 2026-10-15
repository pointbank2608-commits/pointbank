-- 078b: 앱이 오류를 보내는 함수(로그인 전 화면에서 난 오류도 받는다)
-- 같은 사람·같은 오류는 1분에 한 번만 쌓고, 14일 지난 것은 가끔 지운다.

create or replace function public.report_client_error(
  p_fingerprint text,
  p_message text,
  p_stack text default null,
  p_page text default null,
  p_user_agent text default null
) returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_fingerprint is null or length(p_fingerprint) = 0 then
    return;
  end if;

  if v_uid is not null and exists (
    select 1 from public.client_errors
     where fingerprint = left(p_fingerprint, 80)
       and user_id = v_uid
       and created_at > now() - interval '1 minute'
  ) then
    return;
  end if;

  insert into public.client_errors (fingerprint, message, stack, page, user_agent, academy_id, user_id)
  values (
    left(p_fingerprint, 80),
    left(coalesce(p_message, ''), 500),
    left(p_stack, 2000),
    left(p_page, 300),
    left(p_user_agent, 300),
    case when v_uid is null then null else public.my_academy_id() end,
    v_uid
  );

  if random() < 0.02 then
    delete from public.client_errors where created_at < now() - interval '14 days';
  end if;
end $$;

revoke execute on function public.report_client_error(text, text, text, text, text) from public;
grant execute on function public.report_client_error(text, text, text, text, text) to anon, authenticated;
