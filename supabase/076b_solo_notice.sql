-- 076: 채팅 3차 — 반 전체 공지(2/4) 학생(학생 포털 열쇠)이 읽는 함수

create or replace function public.solo_notice(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_sid uuid;
  v_c public.classes;
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return null;
  end;
  select c.* into v_c from public.students s join public.classes c on c.id = s.class_id where s.id = v_sid;
  if v_c.id is null or v_c.notice_text is null or v_c.notice_until is null or v_c.notice_until <= now() then
    return null;
  end if;
  return jsonb_build_object('text', v_c.notice_text, 'until', v_c.notice_until);
end $fn$;
