-- 086u: 결제·구독 화면용 요약 + 결제 사업자 알림(웹훅) 기록·대사(맞춰 보기)
--
-- 금액 기준: billing_history.amount_krw = 청구 성공 시점의 청구액(부가세 포함, 원). 환불 내역은 아직 DB 에 기록되지 않아
-- "청구 성공액"은 순매출이 아니다(환불을 빼지 않음). 기간은 한국 시간 달력 월/최근 30일. 테스트 학원은 제외한다.
-- payment_events 는 결제 사업자(포트원)가 보낸 알림을 받은 그대로 남기는 장부다. 청구 결과(academies·billing_history)는 이 표로 바꾸지 않는다.

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null unique,
  event_type text not null,
  payment_id text,
  event_ts timestamptz not null,
  payload jsonb,
  status text not null default 'received' check (status in ('received', 'ignored_stale')),
  received_at timestamptz not null default now()
);
create index if not exists payment_events_payment_idx on public.payment_events (payment_id, event_ts desc);
alter table public.payment_events enable row level security;
drop policy if exists payment_events_admin on public.payment_events;
create policy payment_events_admin on public.payment_events for select using (public.is_platform_admin());

-- 웹훅 수신기(service role)가 부른다. 같은 webhook_id 는 한 번만 저장(재전송 무시), 같은 결제의 더 오래된 알림은 stale 로 표시(순서 역전).
create or replace function public.payment_event_record(p_webhook_id text, p_type text, p_payment_id text, p_event_ts timestamptz, p_payload jsonb)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_latest timestamptz;
begin
  if auth.role() <> 'service_role' then raise exception 'not_allowed'; end if;
  if exists (select 1 from public.payment_events where webhook_id = p_webhook_id) then return 'duplicate'; end if;
  select max(event_ts) into v_latest from public.payment_events where payment_id = p_payment_id and status = 'received';
  insert into public.payment_events (webhook_id, event_type, payment_id, event_ts, payload, status)
  values (p_webhook_id, p_type, p_payment_id, p_event_ts, p_payload, case when v_latest is not null and p_event_ts < v_latest then 'ignored_stale' else 'received' end)
  on conflict (webhook_id) do nothing;
  if not found then return 'duplicate'; end if;
  return case when v_latest is not null and p_event_ts < v_latest then 'stale' else 'recorded' end;
end $$;

-- 결제 요약
create or replace function public.admin_billing_overview()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with h as (select x.* from public.billing_history x join public.academies a on a.id = x.academy_id
              where not a.is_test and public.is_platform_admin()),
       mstart as (select (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul' as s)
  select case when not public.is_platform_admin() then null else jsonb_build_object(
    'billed_ok_30d', (select count(*) from h where status = 'success' and billed_at > now() - interval '30 days'),
    'billed_failed_30d', (select count(*) from h where status = 'failed' and billed_at > now() - interval '30 days'),
    'amount_ok_30d_krw', (select coalesce(sum(amount_krw), 0) from h where status = 'success' and billed_at > now() - interval '30 days'),
    'amount_ok_month_krw', (select coalesce(sum(amount_krw), 0) from h, mstart where status = 'success' and billed_at >= mstart.s),
    'refunds_recorded', false,
    'webhook_events_30d', (select count(*) from public.payment_events where received_at > now() - interval '30 days'),
    'failures', (select coalesce(jsonb_agg(f), '[]'::jsonb) from (
        select a.id as academy_id, a.name, x.billed_at, x.amount_krw, left(x.failure_reason, 160) as reason
          from h x join public.academies a on a.id = x.academy_id where x.status = 'failed' order by x.billed_at desc limit 20) f)
  ) end;
$$;

-- 대사: 청구 성공 기록(60일)과 결제 사업자 알림을 맞춰 보고 어긋난 것만 돌려준다
create or replace function public.admin_billing_reconcile()
returns table (kind text, academy_name text, payment_id text, billed_at timestamptz, amount_krw int)
language sql stable security definer set search_path = public
as $$
  select 'paid_without_event', a.name, h.portone_payment_id, h.billed_at, h.amount_krw
    from public.billing_history h join public.academies a on a.id = h.academy_id
   where public.is_platform_admin() and h.status = 'success' and h.billed_at > now() - interval '60 days'
     and h.portone_payment_id is not null and h.billed_at < now() - interval '1 day'
     and not exists (select 1 from public.payment_events e where e.payment_id = h.portone_payment_id and e.event_type ilike '%paid%')
  union all
  select 'event_without_history', null, e.payment_id, e.event_ts, null
    from public.payment_events e
   where public.is_platform_admin() and e.event_type ilike '%paid%' and e.event_ts > now() - interval '60 days'
     and not exists (select 1 from public.billing_history h where h.portone_payment_id = e.payment_id and h.status = 'success');
$$;

revoke all on function public.payment_event_record(text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.admin_billing_overview() from public, anon;
revoke all on function public.admin_billing_reconcile() from public, anon;
grant execute on function public.payment_event_record(text, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.admin_billing_overview() to authenticated;
grant execute on function public.admin_billing_reconcile() to authenticated;
