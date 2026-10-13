-- 073: 채팅 2차 — 학생용(숙제) — 대화 상태 읽기(hw_chat_state)

create or replace function public.hw_chat_state(p_token uuid, p_mark boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_t public.homework_attempts;
  v_mode text;
  v_academy uuid;
begin
  begin
    v_t := public.hw_attempt_for(p_token, true);
  exception when others then
    return jsonb_build_object('error', 'not_found');
  end;
  select a.academy_id, c.chat_mode into v_academy, v_mode
    from public.homework_assignments a join public.classes c on c.id = a.class_id where a.id = v_t.assignment_id;
  if coalesce(v_mode, 'off') = 'off' then
    return jsonb_build_object('mode', 'off');
  end if;
  if p_mark then
    update public.solo_chat_messages set read_at = now() where hw_attempt_id = v_t.id and sender = 'teacher' and read_at is null;
  end if;
  return jsonb_build_object(
    'mode', v_mode,
    'academy_id', v_academy,
    'thread', v_t.id,
    'unread', (select count(*) from public.solo_chat_messages where hw_attempt_id = v_t.id and sender = 'teacher' and read_at is null),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
        from (select * from public.solo_chat_messages where hw_attempt_id = v_t.id order by id desc limit 60) m
    ), '[]'::jsonb)
  );
end $fn$;
