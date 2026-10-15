-- 081d: 선생님이 자기 계정만 바로 지운다(원장은 학원 삭제 요청을 쓴다).
-- 그 선생님이 만든 수업·단어장은 학원에 남고 만든 사람 표시만 비워진다.

create or replace function public.delete_my_teacher_account()
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'teacher') then
    raise exception '선생님 계정만 바로 삭제할 수 있어요. 원장님은 학원 삭제를 요청해 주세요.';
  end if;

  delete from public.support_tickets where user_id = v_uid;
  delete from public.announcement_reads where user_id = v_uid;
  delete from auth.users where id = v_uid;
end $$;

revoke execute on function public.delete_my_teacher_account() from public, anon;
grant execute on function public.delete_my_teacher_account() to authenticated;
