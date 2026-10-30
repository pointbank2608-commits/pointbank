-- 093c: 학생 화면용 — 영상마다 목표 횟수와 "언제 봤는지" 목록(한국 시간 날짜).

create or replace function public.hw_watch_state(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_t public.homework_attempts;
begin
  v_t := public.hw_attempt_for(p_token, true);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'item_id', i.id,
      'target', greatest(1, least(coalesce((i.config->>'targetViews')::int, 1), 10)),
      'days', coalesce((
        select jsonb_agg(to_char(w.completed_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') order by w.completed_at)
          from public.homework_watch_views w
         where w.attempt_id = v_t.id and w.item_id = i.id and w.completed_at is not null), '[]'::jsonb)
    ) order by i.position)
    from public.homework_items i
   where i.assignment_id = v_t.assignment_id and coalesce(i.config->>'watch', '') = 'true'
  ), '[]'::jsonb);
end $fn$;
