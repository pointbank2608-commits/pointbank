-- Attach evidence for teacher feedback to the existing class-scoped result API.
begin;

create or replace function public.grammar_teacher_summary(p_class_id uuid,p_mode text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare ac uuid := public.hw_staff_academy();
begin
  if p_mode is null or p_mode not in ('homework','individual') then raise exception 'bad_mode'; end if;
  if not exists(select 1 from public.classes where id=p_class_id and academy_id=ac) then raise exception 'not_found'; end if;

  return coalesce((select jsonb_agg(jsonb_build_object('assignmentId',recent.assignment_id,'student',recent.student,
    'title',recent.title,'reasoning',recent.reasoning,'practice',recent.practice,'transfer',recent.transfer,
    'review',recent.review,'evidence',recent.evidence,'independentEvidence',detail.formats,'reviewExamples',detail.examples)
    order by recent.approved_at desc,recent.student,recent.assignment_id)
  from (
    select * from public.grammar_result_rows
    where academy_id=ac and class_id=p_class_id and mode=p_mode
      and approved_at>=statement_timestamp()-interval '30 days'
    order by approved_at desc,student,assignment_id limit 200
  ) recent
  join public.grammar_content_versions version using (goal_id,version)
  left join lateral (
    with independent as materialized (
      select answer.position,answer.correct,answer.option_id,
        public.grammar_item(version.content,answer.position) as item,
        case when answer.position=5 or answer.position>=40 then 'delayed' else 'transfer' end as phase
      from public.grammar_answers answer
      where answer.assignment_id=recent.assignment_id
        and (answer.position in (4,5) or answer.position between 30 and 33 or answer.position between 40 and 45)
    ), wrong_examples as (
      select position, jsonb_build_object(
        'phase',phase,'sentence',item->>'sentence',
        'written',item ? 'answerText',
        'explanation',case when item ? 'answerText' then item->>'feedback' else (
          select choice->>'feedback' from jsonb_array_elements(item->'options') choice
          where choice->>'id'=option_id
        ) end
      ) as example
      from independent where not correct and item is not null order by position desc limit 2
    )
    select (
      select jsonb_build_object(
        'choiceAnswered', count(*) filter(where not (item ? 'answerText')),
        'choiceCorrect', count(*) filter(where not (item ? 'answerText') and correct),
        'writtenAnswered', count(*) filter(where item ? 'answerText'),
        'writtenCorrect', count(*) filter(where item ? 'answerText' and correct)
      )
      from independent where item is not null
    ) as formats, (
      select coalesce(jsonb_agg(example order by position desc),'[]'::jsonb) from wrong_examples
    ) as examples
    where recent.review <> 'excluded'
  ) detail on true), '[]'::jsonb);
end $$;

commit;
