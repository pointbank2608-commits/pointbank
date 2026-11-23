-- The memory plan and its optional game homework share one approval transaction.
begin;

alter table public.wm_plans add column game_assignment_id uuid unique
  references public.homework_assignments(id) on delete set null;

create function public.wm_project_assign_with_games(
  p_request_id uuid, p_class_id uuid, p_title text, p_cards jsonb, p_source jsonb,
  p_student_ids uuid[], p_daily_mode text, p_study_days int, p_review_days int,
  p_games jsonb, p_new_word_limit int default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  source jsonb;
  result jsonb;
  plan uuid;
  recipients uuid[];
  homework public.homework_assignments;
begin
  perform public.wm_staff_academy();
  if jsonb_typeof(p_games) is distinct from 'array' then raise exception 'bad_games'; end if;
  if jsonb_array_length(p_games) not between 1 and 13 or exists (
    select 1 from jsonb_array_elements(p_games) g
    where g->>'kind' is distinct from 'game' or coalesce(g#>>'{config,game}', '') not in
      ('matchup','anagram','spelling','whack','fish','balloon','hangman','monster','claw','maze','plane','group','cross')
  ) then raise exception 'bad_games'; end if;
  -- Bind the exact game questions to the existing idempotent approval.
  source := coalesce(p_source, '{}'::jsonb) || jsonb_build_object('game_items_hash', md5(p_games::text));
  if p_new_word_limit is null then
    result := public.wm_project_assign(p_request_id,p_class_id,p_title,p_cards,source,p_student_ids,p_daily_mode,p_study_days,p_review_days);
  else
    result := public.wm_project_assign_adaptive(p_request_id,p_class_id,p_title,p_cards,source,p_student_ids,p_daily_mode,p_study_days,p_review_days,p_new_word_limit);
  end if;
  plan := (result->>'plan_id')::uuid;
  if plan is null or (result->>'duplicate')::boolean then return result; end if;
  select array_agg(student_id) into strict recipients from public.wm_targets where plan_id = plan;
  if recipients is null then raise exception 'no_students'; end if;
  homework := public.hw_create_v2(p_class_id, concat_ws(' · ',p_title,p_games->0->>'title'),p_games,recipients,null,'selected',null,null);
  update public.wm_plans set game_assignment_id = homework.id where id = plan;
  update public.homework_assignment_targets set token_expires_at = greatest(token_expires_at,
    now() + make_interval(days => p_study_days + p_review_days + 7)) where assignment_id = homework.id;
  return result;
end $$;

revoke all on function public.wm_project_assign_with_games(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int,jsonb,int) from public,anon;
grant execute on function public.wm_project_assign_with_games(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int,jsonb,int) to authenticated;

create or replace function public.wm_open(p_access text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_t public.wm_targets := public.wm_target_for(p_access);
  v_p public.wm_plans;
  v_day int;
  project jsonb;
begin
  select * into v_p from public.wm_plans where id = v_t.plan_id;
  v_day := greatest(public.wm_today() - v_p.start_date, 0);
  if v_p.rule_version = 'wm-v2' then
    project := public.wm_project_status(v_t.id, v_p.start_date + v_p.study_days + v_p.review_days);
  end if;
  return jsonb_build_object(
    'game_access', (select g.access_token from public.homework_assignment_targets g join public.homework_assignments h on h.id = g.assignment_id
      where g.assignment_id = v_p.game_assignment_id and g.student_id = v_t.student_id and h.closed_at is null
        and (g.token_expires_at is null or g.token_expires_at > now())),
    'title', v_p.title, 'student_name', (select name from public.students where id = v_t.student_id),
    'daily_mode', v_p.daily_mode, 'day_index', v_day, 'study_days', v_p.study_days, 'review_days', v_p.review_days,
    'phase', case when (project->>'completed')::boolean then 'ended'
                  when project is not null then 'study' when v_day < v_p.study_days then 'study' when v_day < v_p.study_days + v_p.review_days then 'review' else 'ended' end,
    'stages', public.wm_stage_counts(v_t.id), 'rule_version', v_p.rule_version) || case when project is null then '{}'::jsonb else jsonb_build_object('project', project) end;
end $$;
create or replace function public.wm_plan_close(p_plan uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_p public.wm_plans := public.wm_plan_for_staff(p_plan);
begin
  update public.homework_assignments set closed_at = public.wm_now() where id = v_p.game_assignment_id and closed_at is null;
  update public.wm_plans set closed_at = coalesce(closed_at, public.wm_now()) where id = v_p.id;
end $$;
commit;
