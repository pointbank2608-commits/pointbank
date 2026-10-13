-- 073: 채팅 2차 — 선생님용 — 한 대화 읽기(solo_chat_thread 다시 정의: 개별수업이면 수업 진행 id, 숙제면 숙제 진행 id)

create or replace function public.solo_chat_thread(p_assignment uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
  v_hw boolean;
begin
  v_hw := exists (select 1 from public.homework_attempts t join public.homework_assignments h on h.id = t.assignment_id where t.id = p_assignment and h.academy_id = v_academy);
  if not v_hw and not exists (select 1 from public.solo_assignments where id = p_assignment and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  if v_hw then
    update public.solo_chat_messages set read_at = now() where hw_attempt_id = p_assignment and sender = 'student' and read_at is null;
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
        from (select * from public.solo_chat_messages where hw_attempt_id = p_assignment order by id desc limit 100) m
    ), '[]'::jsonb);
  end if;
  update public.solo_chat_messages set read_at = now() where assignment_id = p_assignment and sender = 'student' and read_at is null;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.id)
      from (select * from public.solo_chat_messages where assignment_id = p_assignment order by id desc limit 100) m
  ), '[]'::jsonb);
end $fn$;
