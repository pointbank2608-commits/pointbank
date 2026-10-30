-- 096 되돌리기: 새 함수·조정 칸·기록 표를 지우고, 바뀐 090 함수는 090 원본 파일을 다시 실행해 되돌린다.
--  순서: (1) 이 파일 실행 (2) 090c_wm_make_q → 090d_wm_styles → 090e_wm_build_session → 090f_wm_session → 090g_wm_assign 을 차례로 다시 실행
--  주의: 이미 plus 분량·1000단어·긴 기간으로 배정한 계획이 있으면 아래 제약 복원이 실패한다 — 먼저 그 계획을 닫고 지우거나 값을 줄일 것.

drop function if exists public.wm_plan_briefing(uuid);
drop function if exists public.wm_plan_steps(uuid);
drop function if exists public.wm_apply_step(uuid, uuid, text);
drop function if exists public.wm_plan_progress(uuid);
drop function if exists public.wm_plan_cards(uuid, int, int);
drop function if exists public.wm_plan_weak_cards(uuid, int);
drop function if exists public.wm_similar_words(jsonb, jsonb, int);
drop table if exists public.wm_step_log;
alter table public.wm_targets drop constraint if exists wm_targets_mode_override_check;
alter table public.wm_targets drop constraint if exists wm_targets_focus_skill_check;
alter table public.wm_targets drop column if exists mode_override;
alter table public.wm_targets drop column if exists focus_skill;
alter table public.wm_plans drop constraint if exists wm_plans_daily_mode_check;
alter table public.wm_plans add constraint wm_plans_daily_mode_check check (daily_mode in ('light', 'normal'));
alter table public.wm_plans drop constraint if exists wm_plans_study_days_check;
alter table public.wm_plans add constraint wm_plans_study_days_check check (study_days between 3 and 60);
alter table public.wm_plans drop constraint if exists wm_plans_review_days_check;
alter table public.wm_plans add constraint wm_plans_review_days_check check (review_days between 0 and 60);
