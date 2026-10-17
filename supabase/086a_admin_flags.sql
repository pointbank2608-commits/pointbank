-- 086a: 학원에 "제공 근거"와 "테스트 계정" 표시를 더한다(2026-10-18, 관리자 운영 개선).
-- 순서: 086a → 086b → … → 086_check.sql (하나씩 실행. 한 파일은 2.8KB 안팎 — SQL 편집기 잘림 방지)
--
-- plan_source: 유료 권한을 어떻게 갖게 됐는지. subscription(카드 정기결제) / admin(관리자 제공) / event(기간 한정 이벤트).
--   비워 두면 "미분류"다. 카드 등록 정보가 있으면 정기 구독으로 본다(086d 의 계산). 이름·카드 없음만으로 오류 처리하지 않는다.
-- is_test: 운영자가 직접 표시한 테스트·내부 학원(이름으로 자동 분류하지 않는다). 통계에서 제외할 수 있다.

alter table public.academies
  add column if not exists plan_source text check (plan_source in ('subscription', 'admin', 'event')),
  add column if not exists is_test boolean not null default false;

create index if not exists academies_created_idx on public.academies (created_at desc);
create index if not exists academies_test_idx on public.academies (is_test) where is_test;

-- 선생님이 두 칸을 바꾸지 못하게 결제 보호 트리거에 넣는다(관리자·service role 은 통과)
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
  new.plan_source            := old.plan_source;
  new.is_test                := old.is_test;
  return new;
end;
$$;
