-- 076: 채팅 3차 — 반 전체 공지(3/4) 학생(숙제 열쇠)이 읽는 함수

create or replace function public.hw_notice(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_t public.homework_attempts;
  v_c public.classes;
begin
  select * into v_t from public.homework_attempts where token = p_token;
  if v_t.id is null then
    return null;
  end if;
  select c.* into v_c from public.students s join public.classes c on c.id = s.class_id where s.id = v_t.student_id;
  if v_c.id is null or v_c.notice_text is null or v_c.notice_until is null or v_c.notice_until <= now() then
    return null;
  end if;
  return jsonb_build_object('text', v_c.notice_text, 'until', v_c.notice_until);
end $fn$;
