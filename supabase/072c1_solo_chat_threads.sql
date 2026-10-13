-- 072: 채팅 — 선생님용 — 대화 목록(solo_chat_threads)

create or replace function public.solo_chat_threads()
returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.last_at desc)
      from (
        select a.id as assignment_id, s.id as student_id, s.name, l.name as lesson_name, s.class_id,
               (select count(*) from public.solo_chat_messages m where m.assignment_id = a.id and m.sender = 'student' and m.read_at is null) as unread,
               lm.body as last_body, lm.sender as last_sender, lm.created_at as last_at
          from public.solo_assignments a
          join public.students s on s.id = a.student_id
          join public.solo_lessons l on l.id = a.lesson_id
          join lateral (
            select m.body, m.sender, m.created_at
              from public.solo_chat_messages m
             where m.assignment_id = a.id
             order by m.id desc limit 1
          ) lm on true
         where a.academy_id = v_academy and lm.created_at > now() - interval '2 days'
      ) r
  ), '[]'::jsonb);
end $fn$;
