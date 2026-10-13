-- 073: 채팅 2차 — 선생님용 — 보내기(solo_chat_post 다시 정의: 개별수업·숙제 모두)

create or replace function public.solo_chat_post(p_assignment uuid, p_body text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
  v_a public.solo_assignments;
  v_t public.homework_attempts;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if char_length(v_body) < 1 or char_length(v_body) > 200 then
    raise exception 'bad_body';
  end if;
  select * into v_a from public.solo_assignments where id = p_assignment and academy_id = v_academy;
  if v_a.id is not null then
    insert into public.solo_chat_messages (academy_id, assignment_id, student_id, sender, body)
    values (v_a.academy_id, v_a.id, v_a.student_id, 'teacher', v_body);
    return;
  end if;
  select t.* into v_t from public.homework_attempts t join public.homework_assignments h on h.id = t.assignment_id
   where t.id = p_assignment and h.academy_id = v_academy;
  if v_t.id is null then
    raise exception 'not_found';
  end if;
  insert into public.solo_chat_messages (academy_id, hw_attempt_id, student_id, sender, body)
  values (v_academy, v_t.id, v_t.student_id, 'teacher', v_body);
end $fn$;
