-- 086n: 자동 작업 상태 목록 + 켜기/끄기(앱이 관리하는 작업만).
-- 상태 health: disabled(꺼짐) / dry_only(모의 실행만 해 봄) / running(실행 중) / failed(마지막 실행 실패) / retry_wait(실패 항목 재시도 대기)
--              / stale(기대 주기의 2배가 지나도록 성공 없음) / no_record(실행 기록 없음 — 스케줄러 미연결일 수 있음) / ok(정상)
-- 켜지 않은 안내 작업은 "예정"이 아니라 꺼짐으로 보인다. 정상 작동처럼 보이게 만들지 않는다.

create or replace view public.automation_jobs_health as
with lr as (select distinct on (r.job_key) r.job_key, r.status, r.error from public.automation_runs r order by r.job_key, r.started_at desc),
     mc as (select kind, (count(*) filter (where status in ('planned', 'sending')))::int as planned,
                   (count(*) filter (where status = 'sent'))::int as sent, (count(*) filter (where status = 'failed'))::int as failed
              from public.lifecycle_messages group by 1)
select j.*,
       case
         when j.managed = 'internal' and not j.enabled then
           (case when exists (select 1 from public.automation_runs x where x.job_key = j.job_key and x.dry_run) then 'dry_only' else 'disabled' end)
         when lr.status = 'running' then 'running'
         when lr.status = 'failed' then 'failed'
         when coalesce(mc.failed, 0) > 0 then 'retry_wait'
         when j.last_run_at is null then 'no_record'
         when j.expected_interval_minutes is not null
              and coalesce(j.last_success_at, '-infinity'::timestamptz) < now() - make_interval(mins => j.expected_interval_minutes * 2) then 'stale'
         else 'ok' end as health,
       lr.error as last_error,
       coalesce(mc.planned, 0) as msg_planned, coalesce(mc.sent, 0) as msg_sent, coalesce(mc.failed, 0) as msg_failed
  from public.automation_jobs j
  left join lr on lr.job_key = j.job_key
  left join mc on mc.kind = j.job_key;

revoke all on public.automation_jobs_health from public, anon, authenticated;

create or replace function public.admin_jobs_status()
returns table (job_key text, title text, description text, kind text, managed text, enabled boolean, mode text, channel text, schedule text,
               last_run_at timestamptz, last_success_at timestamptz, next_run_at timestamptz, expected_interval_minutes int,
               health text, last_error text, msg_planned int, msg_sent int, msg_failed int)
language sql stable security definer set search_path = public
as $$
  select h.job_key, h.title, h.description, h.kind, h.managed, h.enabled, h.mode, h.channel, h.schedule,
         h.last_run_at, h.last_success_at, h.next_run_at, h.expected_interval_minutes, h.health, h.last_error, h.msg_planned, h.msg_sent, h.msg_failed
    from public.automation_jobs_health h
   where public.is_platform_admin()
   order by case h.kind when 'billing' then 0 when 'maintenance' then 1 when 'report' then 2 else 3 end, h.job_key;
$$;

create or replace function public.admin_job_set(p_key text, p_enabled boolean, p_mode text, p_channel text, p_reason text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_old public.automation_jobs;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  if p_reason is null or length(trim(p_reason)) < 2 then raise exception '변경 사유를 적어 주세요.'; end if;
  select * into v_old from public.automation_jobs where job_key = p_key and managed = 'internal';
  if v_old.job_key is null then raise exception '이 작업은 앱에서 켜고 끌 수 없어요.'; end if;
  if p_mode not in ('dry_run', 'live') or p_channel not in ('none', 'email', 'in_app') then raise exception 'bad_value'; end if;
  update public.automation_jobs set enabled = p_enabled, mode = p_mode, channel = p_channel where job_key = p_key;
  insert into public.admin_actions (action, reason, before, after, detail)
  values ('job_set', trim(p_reason), jsonb_build_object('enabled', v_old.enabled, 'mode', v_old.mode, 'channel', v_old.channel),
          jsonb_build_object('enabled', p_enabled, 'mode', p_mode, 'channel', p_channel), jsonb_build_object('job', p_key));
end $$;

revoke all on function public.admin_jobs_status() from public, anon;
revoke all on function public.admin_job_set(text, boolean, text, text, text) from public, anon;
grant execute on function public.admin_jobs_status() to authenticated;
grant execute on function public.admin_job_set(text, boolean, text, text, text) to authenticated;
