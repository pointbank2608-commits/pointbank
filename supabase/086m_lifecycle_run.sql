-- 086m: 안내 메시지 실행(모의 / 계획 만들기)·발송 대기열·실패 재처리·중지

-- p_dry_run = true(기본): 아무것도 저장하지 않고 "이대로 돌리면 몇 건"만 기록한다.
-- p_dry_run = false: 작업이 켜져 있고(enabled) 실제 모드(live)일 때만, 중복을 건너뛰고 대기열(planned)에 넣는다. 발송은 하지 않는다.
create or replace function public.admin_lifecycle_run(p_kind text, p_dry_run boolean default true)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_job public.automation_jobs;
  v_new int;
  v_ins int := 0;
  v_run uuid;
begin
  if auth.role() <> 'service_role' and not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  select * into v_job from public.automation_jobs where job_key = p_kind and kind = 'lifecycle';
  if v_job.job_key is null then raise exception 'unknown_job'; end if;
  select count(*) into v_new from public.admin_lifecycle_targets(p_kind) where not already_planned;

  if coalesce(p_dry_run, true) then
    v_run := public.automation_record_run(p_kind, 'dry_run', v_new, 0, 0, null, true);
    return jsonb_build_object('dry_run', true, 'targets', v_new, 'run_id', v_run);
  end if;

  if not v_job.enabled or v_job.mode <> 'live' then raise exception 'job_not_live'; end if;
  insert into public.lifecycle_messages (kind, academy_id, dedupe_key)
  select p_kind, academy_id, dedupe_key from public.admin_lifecycle_targets(p_kind) where not already_planned
  on conflict (kind, dedupe_key) do nothing;
  get diagnostics v_ins = row_count;
  v_run := public.automation_record_run(p_kind, 'success', v_new, v_ins, 0, null, false);
  return jsonb_build_object('dry_run', false, 'targets', v_new, 'planned', v_ins, 'run_id', v_run);
end $$;

-- 발송기(Edge Function)가 보낼 건을 집어 간다. 잠긴 건 건너뛰어(skip locked) 같은 건을 두 곳이 집지 않는다.
-- 30분 넘게 "발송 중"인 건은 실패로 돌려 다시 시도 대상이 되게 한다.
create or replace function public.lifecycle_claim_batch(p_kind text, p_limit int default 50)
returns setof public.lifecycle_messages
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.automation_jobs where job_key = p_kind and enabled and mode = 'live') then return; end if;
  update public.lifecycle_messages set status = 'failed', last_error = coalesce(last_error, 'timeout')
   where kind = p_kind and status = 'sending' and claimed_at < now() - interval '30 minutes';
  return query
    with c as (select id from public.lifecycle_messages
                where kind = p_kind and status in ('planned', 'failed') and attempts < max_attempts and next_attempt_at <= now()
                order by created_at limit greatest(1, least(coalesce(p_limit, 50), 200)) for update skip locked)
    update public.lifecycle_messages m set status = 'sending', attempts = m.attempts + 1, claimed_at = now()
      from c where m.id = c.id returning m.*;
end $$;

-- 결과 기록: 성공 = sent. 실패 = failed + 다음 시도(시도 횟수² 시간 뒤). 최대 횟수에 닿으면 더는 집어 가지 않는다(재처리로만 다시).
create or replace function public.lifecycle_mark_result(p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not_allowed'; end if;
  update public.lifecycle_messages
     set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else sent_at end,
         last_error = case when p_ok then null else left(p_error, 300) end,
         next_attempt_at = case when p_ok then next_attempt_at else now() + make_interval(hours => attempts * attempts) end
   where id = p_id and status = 'sending';
end $$;

-- 작업 중지(대기 중인 건 취소) / 실패 항목 재처리(시도 횟수를 되돌려 다시 대기열로)
create or replace function public.admin_lifecycle_stop(p_kind text)
returns int language plpgsql volatile security definer set search_path = public
as $$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  update public.automation_jobs set enabled = false where job_key = p_kind and managed = 'internal';
  update public.lifecycle_messages set status = 'cancelled' where kind = p_kind and status in ('planned', 'failed');
  get diagnostics n = row_count;
  insert into public.admin_actions (action, detail, after) values ('job_stop', jsonb_build_object('job', p_kind), jsonb_build_object('cancelled', n));
  return n;
end $$;

create or replace function public.admin_lifecycle_retry_failed(p_kind text)
returns int language plpgsql volatile security definer set search_path = public
as $$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  update public.lifecycle_messages set status = 'planned', attempts = 0, next_attempt_at = now(), last_error = null
   where kind = p_kind and status = 'failed';
  get diagnostics n = row_count;
  insert into public.admin_actions (action, detail, after) values ('job_retry_failed', jsonb_build_object('job', p_kind), jsonb_build_object('requeued', n));
  return n;
end $$;

revoke all on function public.admin_lifecycle_run(text, boolean) from public, anon;
revoke all on function public.lifecycle_claim_batch(text, int) from public, anon, authenticated;
revoke all on function public.lifecycle_mark_result(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_lifecycle_stop(text) from public, anon;
revoke all on function public.admin_lifecycle_retry_failed(text) from public, anon;
grant execute on function public.admin_lifecycle_run(text, boolean) to authenticated, service_role;
grant execute on function public.lifecycle_claim_batch(text, int) to service_role;
grant execute on function public.lifecycle_mark_result(uuid, boolean, text) to service_role;
grant execute on function public.admin_lifecycle_stop(text) to authenticated;
grant execute on function public.admin_lifecycle_retry_failed(text) to authenticated;
