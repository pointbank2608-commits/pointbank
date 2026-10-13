-- 072: 채팅 — 선생님용 — 한 대화 읽기(solo_chat_thread)

create or replace function public.solo_chat_thread(p_assignment uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.solo_assignments where id = p_assignment and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  update public.solo_chat_messages set read_at = now() where assignment_id = p_assignment and sender = 'student' and read_at is null;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
      from (select * from public.solo_chat_messages where assignment_id = p_assignment order by id desc limit 100) m
  ), '[]'::jsonb);
end $fn$;
