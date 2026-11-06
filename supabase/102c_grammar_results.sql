-- Grammar outcomes for staff and platform admins. Apply after 102.
begin;
create or replace view public.grammar_result_rows with (security_invoker=true) as
select a.id as assignment_id,p.academy_id,p.class_id,p.mode,p.goal_id,p.version,p.approved_at,
  case when s.academy_id=p.academy_id then s.name else '학원 이동' end as student,v.content->>'title' as title,
  r.correct as reasoning,b.correct as practice,t.correct as transfer,
  case
    when a.revoked_at is not null or s.archived_at is not null or s.academy_id is distinct from p.academy_id then 'excluded'
    when d.correct is true then 'correct'
    when d.correct is false then 'wrong'
    when not public.grammar_feature_open(p.academy_id,p.mode) then 'excluded'
    when a.review_due_at is null then 'unscheduled'
    when a.review_due_at>statement_timestamp() then 'waiting'
    else 'missing'
  end as review
from public.grammar_assignments a
join public.grammar_plans p on p.id=a.plan_id
join public.students s on s.id=a.student_id
join public.grammar_content_versions v using (goal_id,version)
left join public.grammar_answers r on r.assignment_id=a.id and r.position=1
left join public.grammar_answers b on b.assignment_id=a.id and b.position=3
left join public.grammar_answers t on t.assignment_id=a.id and t.position=4
left join public.grammar_answers d on d.assignment_id=a.id and d.position=5;
revoke all on public.grammar_result_rows from public,anon,authenticated;

create or replace function public.grammar_teacher_summary(p_class_id uuid,p_mode text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare ac uuid := public.hw_staff_academy();
begin
  if p_mode is null or p_mode not in ('homework','individual') then raise exception 'bad_mode'; end if;
  if not exists(select 1 from public.classes where id=p_class_id and academy_id=ac) then raise exception 'not_found'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('assignmentId',assignment_id,'student',student,
    'title',title,'reasoning',reasoning,'practice',practice,'transfer',transfer,'review',review)
    order by approved_at desc,student,assignment_id) from (
    select * from public.grammar_result_rows where academy_id=ac and class_id=p_class_id and mode=p_mode
      and approved_at>=statement_timestamp()-interval '30 days'
      order by approved_at desc,student,assignment_id limit 200
  ) recent), '[]'::jsonb);
end $$;

create or replace function public.admin_grammar_summary(p_days integer default 30) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if public.is_platform_admin() is distinct from true then raise exception 'forbidden'; end if;
  if p_days is null or p_days not between 1 and 90 then raise exception 'bad_days'; end if;
  return coalesce((select jsonb_agg(to_jsonb(result) order by "goalId",version,mode) from (
    select goal_id as "goalId",version,mode,title,count(*) as assigned,
      count(reasoning) as "reasoningAnswered",count(*) filter(where reasoning) as "reasoningCorrect",
      count(practice) as "practiceAnswered",count(*) filter(where practice) as "practiceCorrect",
      count(transfer) as "transferAnswered",count(*) filter(where transfer) as "transferCorrect",
      count(*) filter(where review='correct') as "reviewCorrect",count(*) filter(where review='wrong') as "reviewWrong",
      count(*) filter(where review='missing') as "reviewMissing",count(*) filter(where review='waiting') as "reviewWaiting",
      count(*) filter(where review='unscheduled') as "reviewUnscheduled",count(*) filter(where review='excluded') as excluded
    from public.grammar_result_rows where approved_at>=statement_timestamp()-make_interval(days=>p_days)
    group by goal_id,version,mode,title
  ) result), '[]'::jsonb);
end $$;
revoke all on function public.grammar_teacher_summary(uuid,text),public.admin_grammar_summary(integer) from public,anon,authenticated;
grant execute on function public.grammar_teacher_summary(uuid,text),public.admin_grammar_summary(integer) to authenticated;
commit;
