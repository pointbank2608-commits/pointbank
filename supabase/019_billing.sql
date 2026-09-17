-- ============================================================
--  19. 무료/유료 등급 + 포트원 정기결제(빌링키)
-- ============================================================
-- 무료 플랜: 반 1개, 학생 10명, 통장·출석부 + 게임 4종(돌림판/사다리/시한폭탄/행맨)만.
-- 유료 플랜: 전체 기능, 학생 수와 무관하게 월 9,900원 정액(2026-09-17 확정 — 학생이
-- 직접 쓰는 기능이 없는 지금 단계에서는 학생 수로 추가 과금할 근거가 없다고 판단).
-- 결제는 포트원 빌링키로 처리하며, 실제 청구 금액 계산·PG 호출은 Edge Function에서만
-- 한다(카드 정보는 클라이언트에 절대 노출하지 않음).

alter table public.academies
  add column if not exists plan                 text        not null default 'free'
    check (plan in ('free', 'paid')),
  add column if not exists plan_status           text        not null default 'active'
    check (plan_status in ('active', 'pending_cancel')),
  add column if not exists plan_started_at       timestamptz,
  add column if not exists card_brand            text,
  add column if not exists card_last4            text,
  add column if not exists card_registered_at    timestamptz,
  add column if not exists next_billing_at        date,
  add column if not exists billing_cycle_day      int,
  add column if not exists billing_failure_count  int         not null default 0,
  add column if not exists plan_expires_at        date;

-- 빌링키 원문 — service role(Edge Function)만 접근. RLS는 켜두고 정책은 하나도
-- 만들지 않는다 = 일반 클라이언트(anon/authenticated) 요청은 무조건 0행. 원장도
-- 화면에서 원문 빌링키를 볼 수 없다.
create table if not exists public.academy_billing_keys (
  academy_id    uuid primary key references public.academies(id) on delete cascade,
  billing_key   text not null,
  customer_uid  text not null,
  issued_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.academy_billing_keys enable row level security;

-- 결제 내역 — 선생님(스태프)은 자기 학원 것만 조회. 기록은 service role만 쓴다.
create table if not exists public.billing_history (
  id                  uuid primary key default gen_random_uuid(),
  academy_id          uuid not null references public.academies(id) on delete cascade,
  billed_at           timestamptz not null default now(),
  period_start        date not null,
  period_end          date not null,
  student_count       int not null,
  amount_krw          int not null,
  status              text not null check (status in ('success', 'failed')),
  portone_payment_id  text,
  failure_reason      text,
  created_at          timestamptz not null default now()
);
alter table public.billing_history enable row level security;

drop policy if exists billing_history_select on public.billing_history;
create policy billing_history_select on public.billing_history
  for select using (academy_id = public.my_academy_id() and public.is_staff());

-- ---------- 무료 플랜 정원(반 1개 / 학생 10명) 서버 측 이중 차단 ----------
-- 화면(버튼 비활성화)과 별개로, API를 직접 호출해도 못 넘어가게 하는 안전망.
create or replace function public.check_free_tier_limits()
returns trigger
language plpgsql
as $$
declare
  v_plan  text;
  v_count int;
begin
  select plan into v_plan from public.academies where id = new.academy_id;
  if v_plan is distinct from 'free' then
    return new;
  end if;

  if tg_table_name = 'classes' then
    select count(*) into v_count from public.classes where academy_id = new.academy_id;
    if v_count >= 1 then
      raise exception '무료 플랜은 반을 1개까지만 만들 수 있어요. 유료 플랜으로 업그레이드하면 반을 더 만들 수 있어요.';
    end if;
  elsif tg_table_name = 'students' then
    select count(*) into v_count from public.students where academy_id = new.academy_id;
    if v_count >= 10 then
      raise exception '무료 플랜은 학생을 10명까지만 등록할 수 있어요. 유료 플랜으로 업그레이드하면 더 등록할 수 있어요.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists classes_free_cap on public.classes;
create trigger classes_free_cap
  before insert on public.classes
  for each row execute function public.check_free_tier_limits();

drop trigger if exists students_free_cap on public.students;
create trigger students_free_cap
  before insert on public.students
  for each row execute function public.check_free_tier_limits();

-- ---------- plan/결제 컬럼 변조 방지 ----------
-- academies_update 정책(id = my_academy_id() and is_staff())은 원장·선생님이 학원
-- 이름 등을 고치라고 열어둔 것인데, 그 구멍으로 plan을 직접 'paid'로 바꿔버리는 것까지
-- 막아야 한다. service role(Edge Function)이 아닌 요청이면 결제 관련 컬럼을 옛 값으로
-- 강제로 되돌린다.
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
  return new;
end;
$$;

drop trigger if exists academies_protect_billing on public.academies;
create trigger academies_protect_billing
  before update on public.academies
  for each row execute function public.protect_billing_columns();

-- ---------- 관리자 수동 플랜 전환 ----------
-- 카드 등록 없이 플랫폼 관리자(007_platform_admin.sql의 is_platform_admin())가 특정
-- 학원을 유료로 comp 처리하거나 되돌릴 수 있게 하는 RPC. 위 protect_billing_columns()
-- 트리거가 is_platform_admin()이면 통과시켜주므로 이 RPC의 일반 UPDATE가 그대로 먹힌다.
-- 'paid'로 전환 시 next_billing_at을 일부러 null로 둔다 — charge-subscriptions는
-- next_billing_at <= today인 학원만 골라 청구하므로, null이면 카드가 없어도 자동 청구
-- 배치에 절대 걸리지 않는다(수동 전환 = 결제 없는 순수 override).
-- p_until(선택, 날짜): 이벤트성 유료 체험 등 기한부 전환용. charge-subscriptions가 매일
-- plan_expires_at이 지난 유료 학원을 찾아 자동으로 무료로 되돌린다(결제 시도 없음).
create or replace function public.admin_set_academy_plan(p_academy_id uuid, p_plan text, p_until date default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '관리자만 할 수 있어요.';
  end if;
  if p_plan not in ('free', 'paid') then
    raise exception 'plan은 free 또는 paid여야 해요.';
  end if;

  update public.academies
  set plan                = p_plan,
      plan_status          = 'active',
      plan_started_at      = case when p_plan = 'paid' then now() else plan_started_at end,
      next_billing_at      = null,
      billing_failure_count = 0,
      plan_expires_at       = case when p_plan = 'paid' then p_until else null end
  where id = p_academy_id;
end;
$$;

revoke execute on function public.admin_set_academy_plan(uuid, text, date) from anon;
revoke execute on function public.admin_set_academy_plan(uuid, text, date) from public;
grant  execute on function public.admin_set_academy_plan(uuid, text, date) to authenticated;

-- admin_list_academies()에 plan/plan_expires_at도 같이 내려주도록 재정의
-- (007_platform_admin.sql의 원본을 대체 — 컬럼을 추가만 하고 나머지 로직은 동일).
-- 반환 컬럼 구성이 달라지면 create or replace만으로는 안 바뀌므로(Postgres 제약)
-- 먼저 기존 함수를 지운다.
drop function if exists public.admin_list_academies();
create or replace function public.admin_list_academies()
returns table (
  academy_id      uuid,
  name            text,
  point_unit      text,
  invite_code     text,
  created_at      timestamptz,
  owner_count     int,
  teacher_count   int,
  student_count   int,
  plan            text,
  plan_expires_at date
)
language sql stable security definer set search_path = public
as $$
  select
    a.id, a.name, a.point_unit, a.invite_code, a.created_at,
    (select count(*) from public.profiles p where p.academy_id = a.id and p.role = 'owner')::int,
    (select count(*) from public.profiles p where p.academy_id = a.id and p.role = 'teacher')::int,
    (select count(*) from public.students s where s.academy_id = a.id)::int,
    a.plan,
    a.plan_expires_at
  from public.academies a
  where public.is_platform_admin()
  order by a.created_at desc;
$$;

-- ---------- 매달 자동 청구 스케줄 ----------
-- pg_cron/pg_net 확장은 Supabase 대시보드(Database → Extensions)에서 먼저 켜야 할 수
-- 있다. 매달이 아니라 "매일" 호출해서, charge-subscriptions 함수 안에서 각 학원의
-- next_billing_at을 직접 비교하게 한다 — 그래야 결제 실패 시 다음 날 자동 재시도된다.
-- 아래 줄은 pg_cron/pg_net 확장이 이미 켜져 있어야 동작한다. 안 켜져 있으면 이 SELECT만
-- 건너뛰고, 확장을 켠 뒤 따로 실행해도 된다.
-- select cron.schedule(
--   'charge-subscriptions-daily',
--   '0 18 * * *',
--   $$
--   select net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/charge-subscriptions',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET 값>'),
--     body := '{}'::jsonb
--   );
--   $$
-- );
