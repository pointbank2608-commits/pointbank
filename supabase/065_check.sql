-- 065 확인(읽기 전용): 결과가 "0 rows"면 전부 통과, 행이 나오면 그 칸(k)이 실패한 것.
with r as (
select
  (public.solo_public_step('{"t":"orderWrite","ko":"x","words":["a","b"],"answer":"a b"}'::jsonb) ? 'answer') = false as order_answer_stripped,
  (public.solo_public_step('{"t":"condWrite","ko":"x","conditions":[{"text":"t"}],"model":"m"}'::jsonb) ? 'model') = false as model_stripped,
  (public.solo_public_step('{"t":"condWrite","ko":"x","conditions":[{"text":"t"}],"model":"m"}'::jsonb) -> 'conditions' -> 0 ->> 'text') = 't' as conditions_kept,
  public.solo_grade('{"t":"orderWrite","answer":"I like red apples."}'::jsonb, 'i like red apples') as order_graded,
  public.solo_grade('{"t":"orderWrite","answer":"I like red apples."}'::jsonb, 'red apples like I') = false as order_wrong,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"7단어","min":7,"max":7},{"text":"want","words":["want","wants"]}]}'::jsonb, 'I want to learn English very much') as cond_met,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"7단어","min":7,"max":7},{"text":"want","words":["want","wants"]}]}'::jsonb, 'I want to learn English') = false as cond_count_fails,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"7단어","min":4,"max":7},{"text":"want","words":["want","wants"]}]}'::jsonb, 'I like to learn English') = false as cond_word_fails,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"안내만"}]}'::jsonb, 'anything') as cond_no_check_passes,
  public.solo_grade('{"t":"condWrite","conditions":[{"text":"안내만"}]}'::jsonb, '   ') = false as cond_empty_fails,
  public.solo_correct_text('{"t":"condWrite","model":"I want to learn English."}'::jsonb) = 'I want to learn English.' as model_text,
  public.solo_step_skill('{"t":"orderWrite"}'::jsonb) = 'sentence.order' as order_skill,
  public.solo_step_skill('{"t":"condWrite"}'::jsonb) is null as cond_unscored,
  public.solo_step_skill('{"t":"fixError"}'::jsonb) = 'sentence.correct' as old_skill_kept
)
select e.key as k, e.value as v
from r, jsonb_each(to_jsonb(r)) as e(key, value)
where e.value is distinct from 'true'::jsonb;
