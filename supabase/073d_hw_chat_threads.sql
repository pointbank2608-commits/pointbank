-- 073: 채팅 2차 — 선생님용 — 대화 목록(개별수업 + 숙제, solo_chat_threads 다시 정의)
-- assignment_id 칸에는 개별수업이면 수업 진행 id, 숙제면 숙제 진행 id 가 들어간다(서로 겹치지 않는 uuid).

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
        select a.id as assignment_id, s.id as student_id, s.name, l.name as lesson_name, s.class_id, false as is_homework,
               (select count(*) from public.solo_chat_messages m where m.assignment_id = a.id and m.sender = 'student' and m.read_at is null) as unread,
               lm.body as last_body, lm.sender as last_sender, lm.created_at as last_at
          from public.solo_assignments a
          join public.students s on s.id = a.student_id
          join public.solo_lessons l on l.id = a.lesson_id
          join lateral (select m.body, m.sender, m.created_at from public.solo_chat_messages m where m.assignment_id = a.id order by m.id desc limit 1) lm on true
         where a.academy_id = v_academy and lm.created_at > now() - interval '2 days'
        union all
        select t.id, s.id, s.name, h.title, s.class_id, true,
               (select count(*) from public.solo_chat_messages m where m.hw_attempt_id = t.id and m.sender = 'student' and m.read_at is null),
               lm.body, lm.sender, lm.created_at
          from public.homework_attempts t
          join public.homework_assignments h on h.id = t.assignment_id
          join public.students s on s.id = t.student_id
          join lateral (select m.body, m.sender, m.created_at from public.solo_chat_messages m where m.hw_attempt_id = t.id order by m.id desc limit 1) lm on true
         where h.academy_id = v_academy and lm.created_at > now() - interval '2 days'
      ) r
  ), '[]'::jsonb);
end $fn$;
