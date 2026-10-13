-- 073: 채팅 2차 — 학생용(숙제) — 보내기(hw_chat_send)

create or replace function public.hw_chat_send(p_token uuid, p_body text, p_quick boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_t public.homework_attempts;
  v_mode text;
  v_academy uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  begin
    v_t := public.hw_attempt_for(p_token, true);
  exception when others then
    return jsonb_build_object('error', 'not_found');
  end;
  select a.academy_id, c.chat_mode into v_academy, v_mode
    from public.homework_assignments a join public.classes c on c.id = a.class_id where a.id = v_t.assignment_id;
  if coalesce(v_mode, 'off') = 'off' then
    return jsonb_build_object('error', 'disabled');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then
    return jsonb_build_object('error', 'bad_body');
  end if;
  if v_mode = 'quick' and not public.solo_chat_quick_ok(v_body) then
    return jsonb_build_object('error', 'quick_only');
  end if;
  if (select count(*) from public.solo_chat_messages where hw_attempt_id = v_t.id and sender = 'student' and created_at > now() - interval '1 minute') >= 6 then
    return jsonb_build_object('error', 'too_fast');
  end if;
  insert into public.solo_chat_messages (academy_id, hw_attempt_id, student_id, sender, body, quick)
  values (v_academy, v_t.id, v_t.student_id, 'student', v_body, coalesce(p_quick, false));
  return jsonb_build_object('ok', true);
end $fn$;
