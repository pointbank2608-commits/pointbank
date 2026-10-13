-- 072: 채팅 — 학생용 — 보내기(solo_chat_send)

create or replace function public.solo_chat_send(p_token uuid, p_assignment uuid, p_body text, p_quick boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_a public.solo_assignments;
  v_mode text;
  v_body text := btrim(coalesce(p_body, ''));
begin
  begin
    v_a := public.solo_assignment_for(p_token, p_assignment);
  exception when others then
    return jsonb_build_object('error', case when sqlerrm like '%expired%' then 'expired' else 'not_found' end);
  end;
  select c.chat_mode into v_mode from public.students s join public.classes c on c.id = s.class_id where s.id = v_a.student_id;
  if coalesce(v_mode, 'off') = 'off' then
    return jsonb_build_object('error', 'disabled');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then
    return jsonb_build_object('error', 'bad_body');
  end if;
  if v_mode = 'quick' and not public.solo_chat_quick_ok(v_body) then
    return jsonb_build_object('error', 'quick_only');
  end if;
  if (select count(*) from public.solo_chat_messages where assignment_id = v_a.id and sender = 'student' and created_at > now() - interval '1 minute') >= 6 then
    return jsonb_build_object('error', 'too_fast');
  end if;
  insert into public.solo_chat_messages (academy_id, assignment_id, student_id, sender, body, quick)
  values (v_a.academy_id, v_a.id, v_a.student_id, 'student', v_body, coalesce(p_quick, false));
  return jsonb_build_object('ok', true);
end $fn$;
