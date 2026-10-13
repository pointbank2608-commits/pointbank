-- 072: 채팅 — 학생용 — 대화 상태 읽기(solo_chat_state)

create or replace function public.solo_chat_state(p_token uuid, p_assignment uuid, p_mark boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_a public.solo_assignments;
  v_mode text;
begin
  begin
    v_a := public.solo_assignment_for(p_token, p_assignment);
  exception when others then
    return jsonb_build_object('error', case when sqlerrm like '%expired%' then 'expired' else 'not_found' end);
  end;
  delete from public.solo_chat_messages where created_at < now() - interval '30 days';
  select c.chat_mode into v_mode from public.students s join public.classes c on c.id = s.class_id where s.id = v_a.student_id;
  if coalesce(v_mode, 'off') = 'off' then
    return jsonb_build_object('mode', 'off');
  end if;
  if p_mark then
    update public.solo_chat_messages set read_at = now() where assignment_id = v_a.id and sender = 'teacher' and read_at is null;
  end if;
  return jsonb_build_object(
    'mode', v_mode,
    'academy_id', v_a.academy_id,
    'unread', (select count(*) from public.solo_chat_messages where assignment_id = v_a.id and sender = 'teacher' and read_at is null),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
        from (select * from public.solo_chat_messages where assignment_id = v_a.id order by id desc limit 60) m
    ), '[]'::jsonb)
  );
end $fn$;
