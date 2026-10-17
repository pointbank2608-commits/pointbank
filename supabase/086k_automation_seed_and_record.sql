-- 086k: 자동 작업 목록 채우기 + 실행 기록 남기기(service role·관리자)
-- 문구·채널은 확정 전이라 초안 상태(꺼짐)다. 기존 결제·점검 작업은 "이미 있는 작업"으로 목록에만 올리고 켜고 끄지 않는다.

insert into public.automation_jobs (job_key, title, description, kind, managed, enabled, mode, channel, schedule, expected_interval_minutes, config) values
 ('welcome_first_use', '가입 후 첫 사용 안내', '가입 직후 시작하는 방법을 한 번 안내합니다.', 'lifecycle', 'internal', false, 'dry_run', 'email', '매일 1회', 1440, '{"after_days": 0, "within_days": 3}'),
 ('stalled_help', '첫 수업을 못 시작한 계정 도움말', '가입 후 3일 지나도 반·수업이 없는 계정에 도움말을 안내합니다.', 'lifecycle', 'internal', false, 'dry_run', 'email', '매일 1회', 1440, '{"after_days": 3, "within_days": 14}'),
 ('trial_ending', '체험 종료 전 안내', '체험 종료 3일 전에 무엇이 달라지는지 안내합니다.', 'lifecycle', 'internal', false, 'dry_run', 'email', '매일 1회', 1440, '{"days_before": 3}'),
 ('billing_failed', '결제 실패 안내', '결제 실패 횟수가 늘 때마다 한 번, 결제 수단 갱신 링크와 함께 안내합니다(서비스 안내).', 'lifecycle', 'internal', false, 'dry_run', 'email', '매일 1회', 1440, '{}'),
 ('cancel_scheduled', '해지 예약·이용 종료 안내', '해지 예약 확인과 이용 종료일을 안내합니다(서비스 안내).', 'lifecycle', 'internal', false, 'dry_run', 'email', '매일 1회', 1440, '{}'),
 ('plan_ending', '기간 한정 제공 종료 전 안내', '관리자 제공·이벤트 권한이 3일 안에 끝날 때 안내합니다.', 'lifecycle', 'internal', false, 'dry_run', 'email', '매일 1회', 1440, '{"days_before": 3}'),
 ('charge_subscriptions', '정기결제 배치', '매일 결제일이 된 학원을 청구합니다. 실패는 매일 재시도, 7회 실패하면 무료 전환(결제 정책).', 'billing', 'external', true, 'live', 'none', '매일(Edge Function + pg_cron)', 1440, '{}'),
 ('ops_health_tick', '점검 자동 띠', '같은 오류가 짧은 시간에 여러 사용자에게 나면 상단 띠를 자동으로 띄우고 내립니다.', 'maintenance', 'external', true, 'live', 'in_app', '5분마다(pg_cron)', 5, '{}'),
 ('weekly_report', '주간 운영 리포트 메일', '월요일 아침에 숫자와 오류 요약을 운영자에게 보냅니다.', 'report', 'external', true, 'live', 'email', '매주 월요일(Edge Function + pg_cron)', 10080, '{}'),
 ('purge_deletions', '삭제 유예 만료 처리', '14일 유예가 끝난 학원 삭제를 처리합니다.', 'maintenance', 'external', true, 'live', 'none', '매일(관리자 화면을 열 때도 실행)', 1440, '{}')
on conflict (job_key) do nothing;

-- 외부 작업이 자기 실행 결과를 알린다(service role 또는 관리자)
create or replace function public.automation_record_run(
  p_job text, p_status text, p_targets int default 0, p_done int default 0, p_failed int default 0, p_error text default null, p_dry boolean default false)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  if p_status not in ('success', 'failed', 'dry_run', 'running') then raise exception 'bad_status'; end if;
  insert into public.automation_runs (job_key, status, targets, done, failed, error, dry_run, finished_at)
  values (p_job, p_status, coalesce(p_targets, 0), coalesce(p_done, 0), coalesce(p_failed, 0), left(p_error, 500), coalesce(p_dry, false),
          case when p_status = 'running' then null else now() end)
  returning id into v_id;
  update public.automation_jobs set
      last_run_at = now(),
      last_success_at = case when p_status = 'success' then now() else last_success_at end,
      next_run_at = case when expected_interval_minutes is null then null else now() + make_interval(mins => expected_interval_minutes) end
   where job_key = p_job;
  return v_id;
end $$;

revoke all on function public.automation_record_run(text, text, int, int, int, text, boolean) from public, anon;
grant execute on function public.automation_record_run(text, text, int, int, int, text, boolean) to authenticated, service_role;
