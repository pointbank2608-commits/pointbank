-- Adaptive homework v1. Requires 097-100. Reuses the approved, bounded 099 recall engine.
-- No existing assignment, grading, or interval is changed. The six 099 wrappers stay intact.
begin;
do $$begin
 if to_regprocedure('public.learning_path_assign(uuid,uuid,uuid[],text,jsonb,text)') is null
 or to_regprocedure('public.admin_learning_research(int,uuid)') is null then raise exception '101 requires 097-100';end if;
 perform public.learning_path_assert_compat();
end$$;
create table if not exists public.learning_homework_plans(
 lesson_id uuid primary key references public.learning_path_plans(lesson_id) on delete cascade,
 academy_id uuid not null references public.academies(id),
 approved_by uuid not null,
 approved_at timestamptz not null default now(),
 approval_hash text not null,
 goal text not null check(goal='meaning_to_spelling'),
 portion int not null check(portion in (4,8)),
 initial_due_at timestamptz,
 source_kind text not null check(source_kind in ('list','lesson','manual')),
 source_id uuid,
 rule_version text not null default 'adaptive-homework-v1'
);
alter table public.learning_homework_plans enable row level security;
revoke all on public.learning_homework_plans from public,anon,authenticated;
create index if not exists learning_homework_scope_idx on public.learning_homework_plans(academy_id,approved_at desc);

create or replace function public.learning_homework_guard(p_lesson uuid,p_academy uuid)
returns void language plpgsql stable security definer set search_path=public as $$begin
 if exists(select 1 from public.learning_homework_plans where lesson_id=p_lesson)
 and not public.academy_feature(p_academy,'homework') then raise exception 'feature_closed';end if;
end$$;
revoke all on function public.learning_homework_guard(uuid,uuid) from public,anon,authenticated;

-- Preserve the latest authorization helper and add exactly one gate before its return.
-- Abort rather than guessing if its shape changes. This does NOT replace a 099 registered wrapper.
do $$declare ddl text; body text; target text; n int;begin
 select pg_get_functiondef(p.oid),p.prosrc into ddl,body from pg_proc p where p.oid='public.solo_assignment_for(uuid,uuid)'::regprocedure;
 if position('public.learning_homework_guard(' in body)>0 then return;end if;
 if position('student_session_student(p_token)' in body)=0 or position('academy_feature(' in body)=0 then raise exception '101 incompatible solo authorization helper';end if;
 select count(*) into n from regexp_matches(body,'return\s+([a-zA-Z_][a-zA-Z_0-9]*)\s*;','gi');
 if n<>1 then raise exception '101 ambiguous solo authorization return';end if;
 select (regexp_match(body,'return\s+([a-zA-Z_][a-zA-Z_0-9]*)\s*;','i'))[1] into target;
 ddl:=regexp_replace(ddl,'return\s+'||target||'\s*;',
  'perform public.learning_homework_guard('||target||'.lesson_id,'||target||'.academy_id); return '||target||';','i');
 execute ddl;
end$$;

-- Explicit execution mode is frozen on NEW runs; old unknown modes remain NULL.
alter table public.learning_delivery_runs add column if not exists learning_mode text;
alter table public.learning_delivery_runs add column if not exists learning_rule_version text;
create or replace function public.learning_homework_tag_run() returns trigger
language plpgsql security definer set search_path=public as $$begin
 if new.source='solo' and exists(select 1 from public.solo_assignments a join public.learning_homework_plans h on h.lesson_id=a.lesson_id where a.id=new.resource_id) then
  new.learning_mode:='homework';new.learning_rule_version:='adaptive-homework-v1';
 elsif new.source='solo' then
  new.learning_mode:=case when exists(select 1 from public.solo_assignments a where a.id=new.resource_id and a.kind='homework') then 'homework' else 'individual' end;
 else new.learning_mode:=new.source;end if;
 return new;
end$$;
revoke all on function public.learning_homework_tag_run() from public,anon,authenticated;
drop trigger if exists learning_homework_run_mode on public.learning_delivery_runs;
create trigger learning_homework_run_mode before insert on public.learning_delivery_runs for each row execute function public.learning_homework_tag_run();

create or replace function public.learning_homework_assign(p_request uuid,p_class uuid,p_students uuid[],p_title text,p_cards jsonb,p_practice text,p_portion int,p_due timestamptz,p_source_kind text,p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); h text; prior public.learning_homework_plans; result jsonb; lid uuid;begin
 if not public.academy_feature(ac,'homework') or not public.academy_feature(ac,'solo') then raise exception 'feature_closed';end if;
 if position('public.learning_homework_guard(' in pg_get_functiondef('public.solo_assignment_for(uuid,uuid)'::regprocedure))=0 then raise exception 'homework_protection_changed';end if;
 if p_request is null or p_portion is null or p_portion not in (4,8) or p_source_kind is null or p_source_kind not in ('manual','list','lesson')
 or jsonb_typeof(p_cards) is distinct from 'array' then raise exception 'bad_homework_plan';end if;
 if jsonb_array_length(p_cards) not between 1 and p_portion then raise exception 'bad_homework_portion';end if;
 if (p_source_kind='manual')<>(p_source_id is null) then raise exception 'bad_homework_source';end if;
 h:=md5(jsonb_build_array(p_class,(select jsonb_agg(distinct s order by s) from unnest(p_students) s),btrim(p_title),p_cards,p_practice,p_portion,p_due,p_source_kind,p_source_id)::text);
 perform pg_advisory_xact_lock(hashtext(ac::text||p_request::text));
 select m.* into prior from public.learning_homework_plans m join public.learning_path_plans p on p.lesson_id=m.lesson_id where p.academy_id=ac and p.request_id=p_request;
 if prior.lesson_id is not null then
  if prior.approval_hash<>h then raise exception 'request_changed';end if;
  return jsonb_build_object('lesson_id',prior.lesson_id,'duplicate',true);
 end if;
 if exists(select 1 from public.learning_path_plans where academy_id=ac and request_id=p_request) then raise exception 'request_changed';end if;
 if p_source_kind='list' and not exists(select 1 from public.word_lists where id=p_source_id and academy_id=ac and (class_id is null or class_id=p_class)) then raise exception 'bad_homework_source';end if;
 if p_source_kind='lesson' and not exists(select 1 from public.curriculum_lessons where id=p_source_id and academy_id=ac and (class_id is null or class_id=p_class)) then raise exception 'bad_homework_source';end if;
 if p_due is not null and (p_due<=now() or p_due>now()+interval '365 days') then raise exception 'bad_homework_due';end if;
 result:=public.learning_path_assign(p_request,p_class,p_students,p_title,p_cards,p_practice);lid:=(result->>'lesson_id')::uuid;
 insert into public.learning_homework_plans(lesson_id,academy_id,approved_by,approval_hash,goal,portion,initial_due_at,source_kind,source_id)
 values(lid,ac,auth.uid(),h,'meaning_to_spelling',p_portion,p_due,p_source_kind,p_source_id);
 update public.solo_assignments set kind='homework',due_at=p_due where lesson_id=lid;
 return result;
end$$;
revoke all on function public.learning_homework_assign(uuid,uuid,uuid[],text,jsonb,text,int,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.learning_homework_assign(uuid,uuid,uuid[],text,jsonb,text,int,timestamptz,text,uuid) to authenticated;

create or replace function public.learning_homework_summary(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy();outcome jsonb;begin
 if not exists(select 1 from public.classes where id=p_class and academy_id=ac) then raise exception 'not_found';end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.approved_at desc),'[]') into outcome from (
 select h.lesson_id,l.name,h.approved_at,h.initial_due_at,h.portion,h.goal,h.rule_version,p.practice,jsonb_array_length(p.cards) as words,
 (select count(*) from public.solo_assignments a where a.lesson_id=h.lesson_id) as assigned,
 (select count(*) from public.solo_assignments a join public.learning_path_states s on s.assignment_id=a.id where a.lesson_id=h.lesson_id and s.first_completed_at is not null) as first_completed,
 (select count(*) from public.solo_assignments a join public.learning_path_checks c on c.assignment_id=a.id where a.lesson_id=h.lesson_id and c.round>0) as delayed_answered,
 (select count(*) from public.solo_assignments a join public.learning_path_checks c on c.assignment_id=a.id where a.lesson_id=h.lesson_id and c.round>0 and c.correct) as delayed_correct,
 (select coalesce(jsonb_agg(jsonb_build_object('name',st.name,'assignment_id',a.id,'started',s.assignment_id is not null,'first_completed',s.first_completed_at is not null,'finished',s.finished_at is not null,'waiting',coalesce(s.due_at>now(),false),'due_at',s.due_at,'phase',case when s.finished_at is not null then 'finished' when s.first_completed_at is not null then 'review' when s.assignment_id is not null then 'learning' else 'not_started' end) order by st.name),'[]') from public.solo_assignments a join public.students st on st.id=a.student_id left join public.learning_path_states s on s.assignment_id=a.id where a.lesson_id=h.lesson_id) as students
 from public.learning_homework_plans h join public.learning_path_plans p on p.lesson_id=h.lesson_id join public.solo_lessons l on l.id=h.lesson_id
 where p.class_id=p_class and h.academy_id=ac order by h.approved_at desc limit 30) x;
 return jsonb_build_object('plans',outcome,'limit',30);
end$$;
revoke all on function public.learning_homework_summary(uuid) from public,anon,authenticated;
grant execute on function public.learning_homework_summary(uuid) to authenticated;

create or replace function public.admin_learning_homework_summary(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare outdata jsonb;begin
 if public.is_platform_admin() is distinct from true then raise exception 'forbidden';end if;
 if p_days is null or p_days not in (7,30,90) then raise exception 'bad_days';end if;
 with cohort as (select h.*,a.id as assignment_id,a.student_id,p.cards,s.first_completed_at,s.finished_at,s.round,s.due_at
 from public.learning_homework_plans h join public.learning_path_plans p on p.lesson_id=h.lesson_id join public.solo_assignments a on a.lesson_id=h.lesson_id
 left join public.learning_path_states s on s.assignment_id=a.id where h.approved_at>=now()-make_interval(days=>p_days)),
 rounds as (select c.assignment_id,r.n as round,jsonb_array_length(c.cards) as words,
 (select count(*) from public.learning_path_checks ck where ck.assignment_id=c.assignment_id and ck.round=r.n) as answered,
 (select count(*) from public.learning_path_checks ck where ck.assignment_id=c.assignment_id and ck.round=r.n and ck.correct) as correct,
 c.round=r.n and c.due_at<=now() and c.finished_at is null as pending_due,
 c.round=r.n and c.due_at>now() as pending_future
 from cohort c cross join (values(1),(2)) r(n))
 select jsonb_build_object('rule_version','adaptive-homework-v1','days',p_days,'plans',(select count(distinct lesson_id) from cohort),'assignments',(select count(*) from cohort),'students',(select count(distinct student_id) from cohort),
 'first_completed',(select count(*) from cohort where first_completed_at is not null),'finished',(select count(*) from cohort where finished_at is not null),
 'rounds',(select coalesce(jsonb_agg(row_to_json(r) order by r.round),'[]') from (select round,coalesce(sum(answered),0) as answered,coalesce(sum(correct),0) as correct,
 coalesce(sum(answered+case when pending_due then words-answered else 0 end),0) as due,
 coalesce(sum(case when pending_due then words-answered else 0 end),0) as missing,
 coalesce(sum(case when pending_future then words-answered else 0 end),0) as not_due,
 coalesce(sum(case when not coalesce(pending_due,false) and not coalesce(pending_future,false) then words-answered else 0 end),0) as not_scheduled from rounds group by round) r),
 'observed_assignments',(select count(distinct c.assignment_id) from cohort c join public.learning_delivery_runs r on r.resource_id=c.assignment_id and r.learning_mode='homework' join public.learning_sensor_events e on e.run_id=r.id),
 'grading_links',(select count(*) from cohort c join public.learning_delivery_runs r on r.resource_id=c.assignment_id and r.learning_mode='homework' join public.learning_evidence_links e on e.run_id=r.id),
 'protection_intact',position('public.learning_homework_guard(' in pg_get_functiondef('public.solo_assignment_for(uuid,uuid)'::regprocedure))>0) into outdata;
 return outdata;
end$$;
revoke all on function public.admin_learning_homework_summary(int) from public,anon,authenticated;
grant execute on function public.admin_learning_homework_summary(int) to authenticated;
commit;
