-- 093b: 학생이 영상을 보는 동안 5초마다 부르는 함수.
-- 본 시간은 영상 길이와 "시작한 뒤 실제로 흐른 시간"을 넘지 못한다(건너뛰기 방지).
-- 영상 길이의 90% 이상을 보고 실제 시간도 80% 이상 흘렀을 때만 한 번 본 것으로 센다.

create or replace function public.hw_watch_report(p_token uuid, p_item_id uuid, p_view uuid, p_duration int, p_watched int)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_t public.homework_attempts;
  v_i public.homework_items;
  v_dur int := greatest(5, least(coalesce(p_duration, 0), 7200));
  v_row public.homework_watch_views;
  v_elapsed numeric;
  v_watched int;
  v_target int;
begin
  v_t := public.hw_attempt_for(p_token);
  select * into v_i from public.homework_items where id = p_item_id and assignment_id = v_t.assignment_id;
  if v_i.id is null or coalesce(v_i.config->>'watch', '') <> 'true' then
    raise exception 'not_found';
  end if;
  insert into public.homework_item_attempts (attempt_id, item_id) values (v_t.id, v_i.id) on conflict (attempt_id, item_id) do nothing;
  insert into public.homework_watch_views (attempt_id, item_id, view_key, duration_sec)
  values (v_t.id, v_i.id, p_view, v_dur) on conflict (attempt_id, item_id, view_key) do nothing;
  select * into v_row from public.homework_watch_views where attempt_id = v_t.id and item_id = v_i.id and view_key = p_view;
  v_dur := greatest(v_row.duration_sec, v_dur);
  v_elapsed := extract(epoch from (now() - v_row.started_at));
  v_watched := greatest(v_row.watched_sec, least(greatest(coalesce(p_watched, 0), 0), v_dur, floor(v_elapsed)::int + 6));
  update public.homework_watch_views
     set duration_sec = v_dur, watched_sec = v_watched, last_at = now(),
         completed_at = case when completed_at is null and v_watched >= 0.9 * v_dur and v_elapsed >= 0.8 * v_dur then now() else completed_at end
   where id = v_row.id;
  update public.homework_attempts set last_seen_at = now() where id = v_t.id;
  v_target := greatest(1, least(coalesce((v_i.config->>'targetViews')::int, 1), 10));
  return jsonb_build_object(
    'completed', exists (select 1 from public.homework_watch_views where id = v_row.id and completed_at is not null),
    'views', (select count(*) from public.homework_watch_views where attempt_id = v_t.id and item_id = v_i.id and completed_at is not null),
    'target', v_target);
end $fn$;
