-- Learning research v1: descriptive vocabulary cohorts and admin-only review decisions.
-- Additive, depends on 097/098/099. Never changes lessons, assignments or recommendations.
begin;
do $$ declare m text; begin
  select string_agg(t,', ') into m from unnest(array['learning_path_plans','learning_path_states','learning_path_checks','learning_path_feedback_actions','learning_evidence_links','learning_sensor_events','learning_sensor_snapshots']) t
    where to_regclass('public.'||t) is null;
  if m is not null or to_regprocedure('public.learning_path_compat_problems()') is null
    or to_regprocedure('public.is_platform_admin()') is null then
    raise exception '100 requires 097/098/099; missing: %',coalesce(m,'admin/compat helpers');
  end if;
end $$;

create table if not exists public.learning_research_decisions (
  request_id uuid primary key,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  days int not null check(days in (7,30,90)),
  academy_id uuid references public.academies(id) on delete set null,
  focus text not null check(focus in ('participation','practice','measurement','curriculum')),
  decision text not null check(decision in ('investigate','compare','hold')),
  note text not null check(length(note)<=1000),
  evidence_hash text not null,
  evidence jsonb not null,
  request_hash text not null
);
alter table public.learning_research_decisions enable row level security;
revoke all on public.learning_research_decisions from public,anon,authenticated;
create index if not exists learning_research_decisions_date_idx on public.learning_research_decisions(created_at desc);
create index if not exists learning_research_plans_date_idx on public.learning_path_plans(created_at,academy_id);
create index if not exists learning_research_runs_resource_idx on public.learning_delivery_runs(source,resource_id,snapshot_id);
create index if not exists learning_research_telemetry_run_idx on public.learning_sensor_events(run_id) where run_id is not null;

create or replace function public.admin_learning_research(p_days int default 30,p_academy uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not coalesce(public.is_platform_admin(),false) then raise exception 'forbidden'; end if;
  if p_days is null or p_days not in (7,30,90) then raise exception 'bad_range'; end if;
  if p_academy is not null and not exists(select 1 from public.academies where id=p_academy) then raise exception 'bad_academy'; end if;
  with plans as materialized (
    select * from public.learning_path_plans where created_at>=now()-make_interval(days=>p_days)
      and (p_academy is null or academy_id=p_academy)
  ), assignments as materialized (
    select a.id,a.student_id,a.academy_id,p.lesson_id,p.practice,p.cards,s.run_id,v.snapshot_id,s.round,s.due_at,s.first_completed_at,s.finished_at,
      snap.fingerprint as version,coalesce(snap.definition#>>'{grading,steps,0,title}',l.name) as title
    from plans p join public.solo_lessons l on l.id=p.lesson_id join public.solo_assignments a on a.lesson_id=p.lesson_id
    left join public.learning_path_states s on s.assignment_id=a.id
    left join public.learning_solo_versions v on v.assignment_id=a.id
    left join public.learning_sensor_snapshots snap on snap.id=v.snapshot_id
  ), answers as materialized (
    select e.assignment_id,e.step_index,e.id,e.correct,e.created_at,
      l.version_matches,l.run_id as linked_run,
      coalesce(lr.source='solo' and lr.resource_id=a.id and lr.student_id=a.student_id and lr.academy_id=a.academy_id and l.position=e.step_index,false) as link_valid,
      coalesce(l.version_matches and lr.snapshot_id=a.snapshot_id,false) as same_version
    from assignments a join public.solo_step_events e on e.assignment_id=a.id and e.kind='answer'
    left join public.learning_evidence_links l on l.source_table='solo_step_events' and l.evidence_id=e.id
    left join public.learning_delivery_runs lr on lr.id=l.run_id
  ), first_answers as materialized (
    select distinct on (assignment_id,step_index) assignment_id,step_index,correct,link_valid,same_version
    from answers order by assignment_id,step_index,id
  ), practice_counts as materialized (
    select assignment_id,step_index,count(*) as answers from answers where link_valid and same_version group by assignment_id,step_index
  ), goals as materialized (
    select a.*,g.i as goal_index,case when diag.link_valid and diag.same_version then diag.correct end as diagnostic,
      case when fc.link_valid and fc.same_version then fc.correct end as first_check,
      c0.correct as final_check,c1.correct as d1_correct,c2.correct as d2_correct,
      c1.checked_at as d1_at,c2.checked_at as d2_at,
      extract(epoch from c1.checked_at-c0.checked_at)/86400 as d1_elapsed_days,
      extract(epoch from c2.checked_at-c0.checked_at)/86400 as d2_elapsed_days,
      (c1.assignment_id is not null or a.first_completed_at+interval '1 day'<=now()) as d1_due,
      (c2.assignment_id is not null or (a.round>=2 and a.due_at<=now())) as d2_due,
      coalesce(pc.answers,0) as practice_answers
    from assignments a cross join lateral generate_series(0,jsonb_array_length(a.cards)-1) g(i)
    left join first_answers diag on diag.assignment_id=a.id and diag.step_index=1+g.i*4
    left join first_answers fc on fc.assignment_id=a.id and fc.step_index=4+g.i*4
    left join practice_counts pc on pc.assignment_id=a.id and pc.step_index=3+g.i*4
    left join public.learning_path_checks c0 on c0.assignment_id=a.id and c0.goal_index=g.i and c0.round=0
    left join public.learning_path_checks c1 on c1.assignment_id=a.id and c1.goal_index=g.i and c1.round=1
    left join public.learning_path_checks c2 on c2.assignment_id=a.id and c2.goal_index=g.i and c2.round=2
  ), telemetry as materialized (
    select e.*,a.id as assignment_id from assignments a
    join public.learning_delivery_runs dr on dr.resource_id=a.id and dr.source='solo' and dr.student_id=a.student_id and dr.academy_id=a.academy_id and dr.snapshot_id=a.snapshot_id
    join public.learning_sensor_events e on e.run_id=dr.id and e.source='solo'
  ), version_groups as materialized (
    select version as fingerprint,min(title) as title,practice,
      case when diagnostic then 'known' when diagnostic=false then 'needs_practice' else 'unknown' end as baseline,
      count(*) as goal_units,count(distinct student_id) as students,
      count(*) filter(where first_check is not null) as first_checked,count(*) filter(where first_check) as first_correct,
      count(*) filter(where final_check is not null) as final_checked,count(*) filter(where final_check) as final_correct,
      count(*) filter(where d1_correct is not null) as d1_answered,count(*) filter(where d1_correct) as d1_correct,
      count(*) filter(where d2_correct is not null) as d2_answered,count(*) filter(where d2_correct) as d2_correct
    from goals where version is not null group by version,practice,case when diagnostic then 'known' when diagnostic=false then 'needs_practice' else 'unknown' end
  )
  select jsonb_build_object(
    'research_version','vocab-research-v1','days',p_days,'academy_id',p_academy,
    'overview',(select jsonb_build_object('plans',(select count(*) from plans),'assignments',count(*),'students',count(distinct student_id),
      'started',count(*) filter(where run_id is not null),'first_completed',count(*) filter(where first_completed_at is not null),
      'finished',count(*) filter(where finished_at is not null)) from assignments),
    'cohorts',(select coalesce(jsonb_agg(to_jsonb(x) order by practice,baseline),'[]') from (
      select practice,case when diagnostic then 'known' when diagnostic=false then 'needs_practice' else 'unknown' end as baseline,
        count(*) as goal_units,count(distinct student_id) as students,count(distinct lesson_id) as plans,count(distinct version) as versions,
        count(*) filter(where diagnostic is not null) as diagnostic_answered,
        count(*) filter(where first_check is not null) as first_checked,count(*) filter(where first_check) as first_correct,
        count(*) filter(where final_check is not null) as final_checked,count(*) filter(where final_check) as final_correct,
        count(*) filter(where diagnostic is not null) as practice_denominator,sum(practice_answers) as practice_answers,
        count(*) filter(where d1_due) as d1_due,count(*) filter(where d1_correct is not null) as d1_answered,count(*) filter(where d1_correct) as d1_correct,
        count(*) filter(where d2_due) as d2_due,count(*) filter(where d2_correct is not null) as d2_answered,count(*) filter(where d2_correct) as d2_correct
      from goals group by practice,case when diagnostic then 'known' when diagnostic=false then 'needs_practice' else 'unknown' end
    )x),
    'rounds',(select jsonb_agg(to_jsonb(x) order by round) from (
      select 1 as round,count(*) filter(where d1_due) as due,count(*) filter(where d1_correct is not null) as answered,
        count(*) filter(where d1_correct) as correct,count(*) filter(where d1_due and d1_correct is null) as missing,
        count(*) filter(where first_completed_at is not null and not coalesce(d1_due,false)) as not_due,
        count(*) filter(where first_completed_at is null) as not_scheduled,
        min(d1_elapsed_days) as min_elapsed_days,max(d1_elapsed_days) as max_elapsed_days
      from goals
      union all
      select 2,count(*) filter(where d2_due),count(*) filter(where d2_correct is not null),count(*) filter(where d2_correct),
        count(*) filter(where d2_due and d2_correct is null),count(*) filter(where round>=2 and not coalesce(d2_due,false)),
        count(*) filter(where coalesce(round,0)<2),min(d2_elapsed_days),max(d2_elapsed_days)
      from goals
    )x),
    'content_versions',(select coalesce(jsonb_agg(to_jsonb(x) order by goal_units desc,fingerprint,baseline),'[]') from (
      select * from version_groups order by goal_units desc,fingerprint,baseline limit 30
    )x),
    'versions_truncated',(select count(*)>30 from version_groups),
    'quality',(select jsonb_build_object('answers',count(*),'unlinked_answers',count(*) filter(where not link_valid),
      'mismatched_answers',count(*) filter(where link_valid and not same_version),
      'observed_runs',(select count(distinct assignment_id) from telemetry),'visible_ms',(select coalesce(sum(visible_ms),0) from telemetry),
      'hint_events',(select count(*) from telemetry where action='hint'),'help_requests',(select count(*) from telemetry where action='help_requested'),
      'unresolved_goals',(select count(*) from public.learning_delivery_items i join assignments a on a.run_id=i.run_id where i.goal_id is null and i.position>0)) from answers),
    'feedback',(select jsonb_build_object('assigned',count(*) filter(where f.decision='assigned'),'dismissed',count(*) filter(where f.decision='dismissed'),
      'changed_practice',count(*) filter(where f.decision='assigned' and np.practice is distinct from a.practice))
      from public.learning_path_feedback_actions f join assignments a on a.id=f.assignment_id left join public.learning_path_plans np on np.lesson_id=f.new_lesson_id),
    'protection',to_jsonb(public.learning_path_compat_problems()),
    'scopes',(select coalesce(jsonb_agg(to_jsonb(x) order by label,id),'[]') from (
      select ac.id,coalesce(nullif(to_jsonb(ac)->>'name',''),ac.id::text) as label from public.academies ac
      where exists(select 1 from public.learning_path_plans p where p.academy_id=ac.id) order by ac.id limit 200
    )x)
  ) into result;
  return result||jsonb_build_object('generated_at',now(),'evidence_hash',md5(result::text));
end $$;

create or replace function public.admin_learning_research_decide(p_request uuid,p_days int,p_academy uuid,p_focus text,p_decision text,p_note text,p_evidence_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.learning_research_decisions; evidence jsonb; h text; result jsonb;
begin
  if not coalesce(public.is_platform_admin(),false) then raise exception 'forbidden'; end if;
  if p_request is null or p_days is null or p_days not in (7,30,90) or p_focus is null or p_focus not in ('participation','practice','measurement','curriculum')
    or p_decision is null or p_decision not in ('investigate','compare','hold') or p_note is null or length(p_note)>1000 or p_evidence_hash is null then raise exception 'bad_decision'; end if;
  h:=md5(jsonb_build_array(p_days,p_academy,p_focus,p_decision,p_note,p_evidence_hash)::text);
  perform pg_advisory_xact_lock(hashtext('research:'||p_request::text));
  select * into prior from public.learning_research_decisions where request_id=p_request;
  if prior.request_id is not null then
    if prior.request_hash<>h then raise exception 'request_changed'; end if;
    return jsonb_build_object('request_id',prior.request_id,'created_at',prior.created_at,'duplicate',true);
  end if;
  evidence:=public.admin_learning_research(p_days,p_academy);
  if evidence->>'evidence_hash' is distinct from p_evidence_hash then raise exception 'research_changed_refresh'; end if;
  insert into public.learning_research_decisions(request_id,days,academy_id,focus,decision,note,evidence_hash,evidence,request_hash)
    values(p_request,p_days,p_academy,p_focus,p_decision,btrim(p_note),p_evidence_hash,evidence,h) returning jsonb_build_object('request_id',request_id,'created_at',created_at,'duplicate',false) into result;
  return result;
end $$;

create or replace function public.admin_learning_research_decisions(p_days int default 30,p_academy uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not coalesce(public.is_platform_admin(),false) then raise exception 'forbidden'; end if;
  if p_days is null or p_days not in (7,30,90) then raise exception 'bad_range'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,request_id),'[]') from (
    select request_id,created_at,days,academy_id,focus,decision,note,evidence_hash,evidence from public.learning_research_decisions
    where days=p_days and academy_id is not distinct from p_academy order by created_at desc,request_id limit 25
  )x);
end $$;

revoke all on function public.admin_learning_research(int,uuid),public.admin_learning_research_decide(uuid,int,uuid,text,text,text,text),public.admin_learning_research_decisions(int,uuid) from public,anon,authenticated;
grant execute on function public.admin_learning_research(int,uuid),public.admin_learning_research_decide(uuid,int,uuid,text,text,text,text),public.admin_learning_research_decisions(int,uuid) to authenticated;
commit;
