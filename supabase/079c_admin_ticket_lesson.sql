-- 079c: 선생님이 문의에 직접 첨부한 수업만 읽기 전용 요약으로 본다(열람은 조치 기록에 남는다)

create or replace function public.admin_ticket_lesson(p_ticket uuid)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_lesson uuid;
  v_academy uuid;
  v_out json;
begin
  if not public.is_platform_admin() then
    return null;
  end if;

  select attached_lesson_id, academy_id into v_lesson, v_academy
    from public.support_tickets where id = p_ticket;
  if v_lesson is null then
    return null;
  end if;

  select json_build_object(
           'name', l.name,
           'level', l.level,
           'word_list', (select w.name from public.word_lists w where w.id = l.word_list_id),
           'updated_at', l.updated_at,
           'slides', coalesce((
             select json_agg(json_build_object(
                      'kind', coalesce(e.value ->> 'kind', e.value ->> 'gameType', '?'),
                      'title', left(coalesce(e.value ->> 'title', e.value ->> 'name', ''), 60)))
               from jsonb_array_elements(case when jsonb_typeof(l.playlist) = 'array' then l.playlist else '[]'::jsonb end) e
           ), '[]'::json))
    into v_out
    from public.curriculum_lessons l where l.id = v_lesson;

  insert into public.admin_actions (academy_id, action, detail)
  values (v_academy, 'view_ticket_lesson', json_build_object('ticket', p_ticket, 'lesson', v_lesson)::jsonb);

  return v_out;
end $$;

revoke execute on function public.admin_ticket_lesson(uuid) from public;
grant execute on function public.admin_ticket_lesson(uuid) to authenticated;
