-- 060_solo_stats.sql 확인(읽기 전용) — SQL Editor 에서 실행해 한 줄 결과를 본다.
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'solo_step_events' and column_name = 'skill') as has_skill_col,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'solo_lessons' and column_name = 'origin') as has_origin_col,
  exists (select 1 from pg_trigger where tgname = 'solo_step_events_skill') as has_skill_trigger,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('solo_step_skill', 'solo_event_skill', 'solo_event_set_skill', 'solo_first_answers', 'student_skill_events')) as helper_functions_5,
  (select count(*) from public.solo_step_events where kind in ('answer', 'unsure')) as answer_events,
  (select count(*) from public.solo_step_events where kind in ('answer', 'unsure') and skill is not null) as events_with_skill,
  (select coalesce(jsonb_object_agg(skill, n), '{}'::jsonb)
     from (select skill, count(*) as n from public.solo_step_events where skill is not null group by skill) s) as by_skill;
