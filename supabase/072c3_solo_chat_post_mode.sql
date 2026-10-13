-- 072: 채팅 — 선생님용 — 보내기·반 방식(solo_chat_post, solo_chat_set_mode)

create or replace function public.solo_chat_post(p_assignment uuid, p_body text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
  v_a public.solo_assignments;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into v_a from public.solo_assignments where id = p_assignment and academy_id = v_academy;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then
    raise exception 'bad_body';
  end if;
  insert into public.solo_chat_messages (academy_id, assignment_id, student_id, sender, body)
  values (v_a.academy_id, v_a.id, v_a.student_id, 'teacher', v_body);
end $fn$;

create or replace function public.solo_chat_set_mode(p_class uuid, p_mode text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if p_mode not in ('off', 'quick', 'free') then
    raise exception 'bad_mode';
  end if;
  update public.classes set chat_mode = p_mode where id = p_class and academy_id = v_academy;
end $fn$;
