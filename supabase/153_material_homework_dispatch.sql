-- A teacher approval may include an ordinary assignment and one recurring
-- vocabulary range. The existing assignment functions perform authorization,
-- target validation and idempotency. Both operations commit together.
begin;

create or replace function public.hw_assign_materials(
  p_class uuid, p_students uuid[], p_draft jsonb, p_due timestamptz,
  p_request uuid, p_project jsonb
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  assignment jsonb;
  project jsonb;
  cards jsonb := p_project->'cards';
  ceiling int := (p_project->>'limit')::int;
  actual_limit int;
begin
  if coalesce(cardinality(p_students), 0) = 0 then raise exception 'no_students'; end if;
  if jsonb_typeof(cards) is distinct from 'array' or ceiling is null or ceiling < 1 then
    raise exception 'bad_new_word_limit';
  end if;
  actual_limit := least(ceiling, jsonb_array_length(cards));
  if actual_limit < 1 then raise exception 'too_few_words'; end if;
  if p_draft is not null then
    assignment := public.hw_assign_draft(p_class, p_draft, p_students, p_due, p_request);
  end if;
  project := public.wm_project_assign_adaptive(
    (p_project->>'request')::uuid, p_class, p_project->>'title', cards,
    (p_project->'source') || jsonb_build_object('approved_daily_limit',ceiling), p_students, 'normal',
    least(3650, greatest(7, ceil(jsonb_array_length(cards)::numeric / actual_limit)::int + 3)),
    14, actual_limit
  );
  return jsonb_build_object('assignment', assignment, 'project', project);
end $$;

revoke all on function public.hw_assign_materials(uuid,uuid[],jsonb,timestamptz,uuid,jsonb) from public, anon;
grant execute on function public.hw_assign_materials(uuid,uuid[],jsonb,timestamptz,uuid,jsonb) to authenticated;
commit;
