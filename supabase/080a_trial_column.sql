-- 080a: 14일 전체 체험(2026-10-16) — 학원마다 체험 종료일. 새 학원은 가입일 + 14일(한국 날짜).
-- 이미 있는 학원은 이 SQL 을 실행한 날부터 14일(베타 사용자에게 주는 체험)로 들어간다.
-- 순서: 080a → 080b → 080c → 080d → 080_check.sql (하나씩 실행)

alter table public.academies
  add column if not exists trial_ends_at date not null
  default ((now() at time zone 'Asia/Seoul')::date + 14);

-- 선생님이 화면에서 체험 기간을 고치지 못하게 결제 보호 트리거에 같이 넣는다
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' or public.is_platform_admin() then
    return new;
  end if;

  new.plan                 := old.plan;
  new.plan_status           := old.plan_status;
  new.plan_started_at       := old.plan_started_at;
  new.card_brand             := old.card_brand;
  new.card_last4             := old.card_last4;
  new.card_registered_at     := old.card_registered_at;
  new.next_billing_at        := old.next_billing_at;
  new.billing_cycle_day      := old.billing_cycle_day;
  new.billing_failure_count  := old.billing_failure_count;
  new.plan_expires_at        := old.plan_expires_at;
  new.trial_ends_at          := old.trial_ends_at;
  return new;
end;
$$;
