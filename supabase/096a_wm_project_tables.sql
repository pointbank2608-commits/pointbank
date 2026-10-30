-- 096a 단어암기 프로젝트(2026-10-31): 800단어 같은 큰 범위를 며칠·몇 달에 걸쳐 외우게 하기 위한 준비. 090 을 그대로 두고 더한다.
--  · 하루 분량 "plus"(새 낱말 10개) 추가, 공부 기간 최대 240일·복습 기간 최대 90일로 확대
--  · 학생별 조정 칸: mode_override(분량 바꾸기), focus_skill(약한 능력 집중) — 선생님의 "다음 단계 카드"가 바꾼다
--  · 조정 기록 wm_step_log (선생님이 언제 무엇을 바꿨는지)
-- 되돌리기: 096_rollback.sql

alter table public.wm_plans drop constraint if exists wm_plans_daily_mode_check;
alter table public.wm_plans add constraint wm_plans_daily_mode_check check (daily_mode in ('light', 'normal', 'plus'));
alter table public.wm_plans drop constraint if exists wm_plans_study_days_check;
alter table public.wm_plans add constraint wm_plans_study_days_check check (study_days between 3 and 240);
alter table public.wm_plans drop constraint if exists wm_plans_review_days_check;
alter table public.wm_plans add constraint wm_plans_review_days_check check (review_days between 0 and 90);

alter table public.wm_targets add column if not exists mode_override text;
alter table public.wm_targets add column if not exists focus_skill text;
alter table public.wm_targets drop constraint if exists wm_targets_mode_override_check;
alter table public.wm_targets add constraint wm_targets_mode_override_check check (mode_override is null or mode_override in ('light', 'normal', 'plus'));
alter table public.wm_targets drop constraint if exists wm_targets_focus_skill_check;
alter table public.wm_targets add constraint wm_targets_focus_skill_check check (focus_skill is null or focus_skill in ('spelling', 'listening', 'meaning', 'context'));

create table if not exists public.wm_step_log (
  id bigserial primary key,
  plan_id uuid not null references public.wm_plans(id) on delete cascade,
  target_id uuid not null references public.wm_targets(id) on delete cascade,
  action text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.wm_step_log enable row level security;
revoke all on public.wm_step_log from anon, authenticated;
revoke usage, select on sequence public.wm_step_log_id_seq from anon, authenticated;

create or replace function public.wm_mode_params(p_mode text) returns jsonb
language sql immutable as $$
  select case p_mode
    when 'light' then '{"asks":12,"reserve":2,"new_max":3}'::jsonb
    when 'plus' then '{"asks":30,"reserve":5,"new_max":10}'::jsonb
    else '{"asks":20,"reserve":4,"new_max":5}'::jsonb end
$$;
