-- 086c: 학원 상태 계산(이용 권한·제공 근거·결제 상태)을 한 곳에 두고, 플랜 변경에 사유·전후 기록을 남긴다.
--
-- 이용 권한 entitlement: free(무료) / trial(체험 중) / full(전체 기능 — plan = paid)
-- 제공 근거 source(유료일 때만): subscription(카드 정기결제) / admin(관리자 제공) / event(기간 한정) / unclassified(미분류)
-- 결제 상태 billing_state(유료일 때만): normal(정상) / failed(결제 실패) / cancel_scheduled(해지 예약) / none(정기결제 아님)
-- 날짜 경계는 모두 한국 시간(Asia/Seoul).

create or replace view public.admin_academy_facts as
select
  a.id, a.name, a.created_at, a.is_test, a.plan, a.plan_status, a.plan_expires_at, a.next_billing_at,
  a.trial_ends_at, a.billing_failure_count, a.card_last4,
  (now() at time zone 'Asia/Seoul')::date as today_kst,
  (a.created_at at time zone 'Asia/Seoul')::date as signup_day_kst,
  case when a.plan = 'paid' then 'full'
       when a.trial_ends_at >= (now() at time zone 'Asia/Seoul')::date then 'trial'
       else 'free' end as entitlement,
  case when a.plan <> 'paid' then null
       else coalesce(a.plan_source, case when a.card_last4 is not null then 'subscription' else 'unclassified' end) end as source,
  case when a.plan <> 'paid' then null
       when a.billing_failure_count > 0 then 'failed'
       when a.plan_status = 'pending_cancel' then 'cancel_scheduled'
       when coalesce(a.plan_source, case when a.card_last4 is not null then 'subscription' else 'unclassified' end) = 'subscription' then 'normal'
       else 'none' end as billing_state
from public.academies a
where public.is_platform_admin();

revoke all on public.admin_academy_facts from public, anon, authenticated;

-- 사유가 필요한 플랜 변경(기존 admin_set_academy_plan 은 아래 호환 껍데기로 남긴다)
create or replace function public.admin_change_plan(
  p_academy_id uuid, p_plan text, p_until date default null, p_reason text default null, p_source text default 'admin')
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.is_platform_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  if p_plan not in ('free', 'paid') then raise exception 'plan은 free 또는 paid여야 해요.'; end if;
  if p_source is not null and p_source not in ('admin', 'event') then raise exception '제공 근거는 admin 또는 event 만 고를 수 있어요.'; end if;
  if p_reason is null or length(trim(p_reason)) < 2 then raise exception '변경 사유를 적어 주세요.'; end if;

  select jsonb_build_object('plan', plan, 'source', source, 'until', plan_expires_at, 'billing', billing_state)
    into v_before from public.admin_academy_facts where id = p_academy_id;
  if v_before is null then raise exception '학원을 찾을 수 없어요.'; end if;

  update public.academies
     set plan = p_plan,
         plan_status = 'active',
         plan_started_at = case when p_plan = 'paid' then now() else plan_started_at end,
         next_billing_at = null,
         billing_failure_count = 0,
         plan_expires_at = case when p_plan = 'paid' then p_until else null end,
         plan_source = case when p_plan = 'paid' then coalesce(p_source, 'admin') else null end
   where id = p_academy_id;

  insert into public.admin_actions (academy_id, action, reason, before, after, detail)
  values (p_academy_id, case when p_plan = 'paid' then 'set_paid' else 'set_free' end, trim(p_reason), v_before,
          jsonb_build_object('plan', p_plan, 'source', case when p_plan = 'paid' then coalesce(p_source, 'admin') end, 'until', p_until),
          jsonb_build_object('until', p_until));
end $$;

create or replace function public.admin_set_academy_plan(p_academy_id uuid, p_plan text, p_until date default null)
returns void language sql volatile security definer set search_path = public
as $$ select public.admin_change_plan(p_academy_id, p_plan, p_until, '(이전 화면에서 변경 — 사유 없음)', 'admin') $$;

revoke all on function public.admin_change_plan(uuid, text, date, text, text) from public, anon;
grant execute on function public.admin_change_plan(uuid, text, date, text, text) to authenticated;
