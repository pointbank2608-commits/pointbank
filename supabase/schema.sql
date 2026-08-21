-- ============================================================
--  클래스뱅크 (ClassBank) — 학원용 포인트 뱅킹 스키마
--  Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전합니다 (idempotent).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
--  0. 유틸 — 사람이 읽기 쉬운 참여 코드 생성
--     (헷갈리는 I, L, O, 0, 1 은 제외)
-- ------------------------------------------------------------
create or replace function public.gen_join_code(p_len int default 6)
returns text
language sql
volatile
as $$
  select string_agg(
           substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                  1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, p_len);
$$;


-- ============================================================
--  1. 테이블
-- ============================================================

-- 학원 (테넌트 최상위)
create table if not exists public.academies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  point_unit  text not null default '포인트',   -- 학원별 커스텀 단위 (별, 달러 …)
  invite_code text not null unique default public.gen_join_code(6), -- 선생님 초대 코드
  created_at  timestamptz not null default now()
);

-- 반
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists classes_academy_idx on public.classes(academy_id);

-- 학생 (계좌 주체). user_id 는 학생이 직접 로그인해 코드로 연결했을 때만 채워짐.
create table if not exists public.students (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id   uuid not null references public.classes(id)   on delete cascade,
  name       text not null,
  claim_code text not null unique default public.gen_join_code(8),
  user_id    uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists students_academy_idx on public.students(academy_id);
create index if not exists students_class_idx   on public.students(class_id);

-- 로그인 사용자 프로필 (원장 / 선생님 / 학생)
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  academy_id   uuid references public.academies(id) on delete cascade,
  role         text not null check (role in ('owner', 'teacher', 'student')),
  display_name text not null,
  created_at   timestamptz not null default now()
);
create index if not exists profiles_academy_idx on public.profiles(academy_id);

-- 지급/차감 사유 프리셋
create table if not exists public.presets (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  label      text not null,
  delta      int  not null check (delta <> 0),
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists presets_academy_idx on public.presets(academy_id);

-- 거래 원장 (append-only). 잔액은 저장하지 않고 이 테이블의 합으로 계산한다.
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  academy_id      uuid not null references public.academies(id) on delete cascade,
  class_id        uuid references public.classes(id) on delete set null,
  student_id      uuid not null references public.students(id) on delete cascade,
  delta           int  not null check (delta <> 0),
  reason          text not null default '',
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',   -- 선생님이 탈퇴해도 기록이 남도록 비정규화
  created_at      timestamptz not null default now()
);
create index if not exists transactions_student_idx on public.transactions(student_id, created_at desc);
create index if not exists transactions_academy_idx on public.transactions(academy_id, created_at desc);

-- 포인트 교환 내역 (추후 상품 교환 기능용, 원장과 분리)
create table if not exists public.redemptions (
  id              uuid primary key default gen_random_uuid(),
  academy_id      uuid not null references public.academies(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  item_name       text not null,
  cost            int  not null check (cost > 0),
  transaction_id  uuid references public.transactions(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists redemptions_student_idx on public.redemptions(student_id, created_at desc);

-- 미니게임 템플릿 (룰렛/사다리/빙고 …). 게임 종류는 game_type 문자열로 확장.
create table if not exists public.game_templates (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id   uuid references public.classes(id) on delete set null,
  game_type  text not null,                     -- 'roulette' | 'ladder' | 'bingo' | …
  name       text not null,
  items      jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists game_templates_academy_idx on public.game_templates(academy_id, game_type);


-- ============================================================
--  2. 헬퍼 함수
--     SECURITY DEFINER 이므로 profiles 의 RLS 를 우회한다.
--     → 정책 안에서 profiles 를 조회해도 무한 재귀가 발생하지 않는다.
-- ============================================================

create or replace function public.my_academy_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select academy_id from public.profiles where id = auth.uid() $$;

create or replace function public.my_role()
returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- 원장 또는 선생님인가?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(
         (select role in ('owner', 'teacher') from public.profiles where id = auth.uid()),
         false) $$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(
         (select role = 'owner' from public.profiles where id = auth.uid()),
         false) $$;

-- 로그인한 학생 본인의 students.id
create or replace function public.my_student_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.students where user_id = auth.uid() $$;


-- ============================================================
--  3. RLS 활성화
-- ============================================================
alter table public.academies      enable row level security;
alter table public.classes        enable row level security;
alter table public.students       enable row level security;
alter table public.profiles       enable row level security;
alter table public.presets        enable row level security;
alter table public.transactions   enable row level security;
alter table public.redemptions    enable row level security;
alter table public.game_templates enable row level security;


-- ============================================================
--  4. 정책
--     원칙: 읽기는 같은 학원 안에서만, 쓰기는 원장/선생님만.
--     학생은 남의 거래 사유까지 보지 못하게 막고,
--     순위는 이름+합계만 돌려주는 RPC 로 따로 제공한다.
-- ============================================================

-- ---------- academies ----------
drop policy if exists academies_select on public.academies;
create policy academies_select on public.academies
  for select using (id = public.my_academy_id());

drop policy if exists academies_update on public.academies;
create policy academies_update on public.academies
  for update using (id = public.my_academy_id() and public.is_staff())
          with check (id = public.my_academy_id() and public.is_staff());

-- ---------- profiles ----------
-- 본인 행은 academy_id 가 아직 없어도 읽을 수 있어야 한다 (온보딩 판단용).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or (academy_id is not null and academy_id = public.my_academy_id())
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- INSERT 정책은 두지 않는다. 프로필 생성은 아래 온보딩 RPC 를 통해서만 이뤄진다.

-- ---------- classes ----------
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select using (academy_id = public.my_academy_id());

drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

-- ---------- students ----------
-- 학생 명단(이름) 자체는 같은 학원이면 볼 수 있다. 잔액/사유는 별도 통제.
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select using (academy_id = public.my_academy_id());

drop policy if exists students_write on public.students;
create policy students_write on public.students
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

-- ---------- presets ----------
drop policy if exists presets_select on public.presets;
create policy presets_select on public.presets
  for select using (academy_id = public.my_academy_id());

drop policy if exists presets_write on public.presets;
create policy presets_write on public.presets
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

-- ---------- transactions ----------
-- 선생님/원장: 학원 전체. 학생: 본인 것만.
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select using (
    academy_id = public.my_academy_id()
    and (public.is_staff() or student_id = public.my_student_id())
  );

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert with check (academy_id = public.my_academy_id() and public.is_staff());

-- 정정은 원칙적으로 반대 거래를 추가하지만, 오입력 즉시 취소는 허용한다.
drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete using (academy_id = public.my_academy_id() and public.is_staff());

-- ---------- redemptions ----------
drop policy if exists redemptions_select on public.redemptions;
create policy redemptions_select on public.redemptions
  for select using (
    academy_id = public.my_academy_id()
    and (public.is_staff() or student_id = public.my_student_id())
  );

drop policy if exists redemptions_write on public.redemptions;
create policy redemptions_write on public.redemptions
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

-- ---------- game_templates ----------
drop policy if exists game_templates_select on public.game_templates;
create policy game_templates_select on public.game_templates
  for select using (academy_id = public.my_academy_id());

drop policy if exists game_templates_write on public.game_templates;
create policy game_templates_write on public.game_templates
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());


-- ============================================================
--  5. 잔액 뷰
--     security_invoker = on → 조회하는 사람의 RLS 가 그대로 적용된다.
--     (선생님은 전체, 학생은 본인 것만 집계된다)
-- ============================================================
create or replace view public.student_balances
with (security_invoker = on) as
  select s.id            as student_id,
         s.academy_id,
         s.class_id,
         s.name,
         coalesce(sum(t.delta), 0)::int as balance,
         count(t.id)::int               as tx_count,
         max(t.created_at)              as last_tx_at
  from public.students s
  left join public.transactions t on t.student_id = s.id
  group by s.id, s.academy_id, s.class_id, s.name;


-- ============================================================
--  6. 순위 RPC
--     학생도 순위를 봐야 하지만 남의 거래 사유는 보면 안 되므로,
--     이름과 합계만 돌려주는 SECURITY DEFINER 함수로 제공한다.
-- ============================================================

create or replace function public.class_ranking(p_class_id uuid)
returns table (student_id uuid, name text, class_name text, balance int)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, c.name, coalesce(sum(t.delta), 0)::int as balance
  from public.students s
  join public.classes c on c.id = s.class_id
  left join public.transactions t on t.student_id = s.id
  where s.class_id = p_class_id
    and s.academy_id = public.my_academy_id()   -- 테넌트 경계 강제
    and public.is_staff()                       -- 학생은 남의 순위를 볼 수 없음 (003 마이그레이션)
  group by s.id, s.name, c.name
  order by balance desc, s.name asc;
$$;

create or replace function public.academy_ranking()
returns table (student_id uuid, name text, class_name text, balance int)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, c.name, coalesce(sum(t.delta), 0)::int as balance
  from public.students s
  join public.classes c on c.id = s.class_id
  left join public.transactions t on t.student_id = s.id
  where s.academy_id = public.my_academy_id()
    and public.is_staff()
  group by s.id, s.name, c.name
  order by balance desc, s.name asc;
$$;


-- ============================================================
--  7. 온보딩 RPC
--     프로필 생성 경로를 이 세 함수로만 제한해서,
--     아무나 임의의 학원에 owner 로 끼어드는 것을 막는다.
-- ============================================================

-- (1) 원장: 학원을 새로 만들고 owner 가 된다. 기본 반/프리셋도 같이 심는다.
create or replace function public.create_academy(
  p_name         text,
  p_point_unit   text,
  p_display_name text
) returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_academy   uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception '이미 소속된 학원이 있습니다.';
  end if;

  insert into public.academies (name, point_unit)
  values (nullif(trim(p_name), ''), coalesce(nullif(trim(p_point_unit), ''), '포인트'))
  returning id into v_academy;

  insert into public.profiles (id, academy_id, role, display_name)
  values (v_uid, v_academy, 'owner',
          coalesce(nullif(trim(p_display_name), ''), '원장'));

  insert into public.classes (academy_id, name, sort_order)
  values (v_academy, '1반', 0);

  insert into public.presets (academy_id, label, delta, sort_order) values
    (v_academy, '숙제 완료',      2, 0),
    (v_academy, '수업 태도 우수', 3, 1),
    (v_academy, '발표 참여',      2, 2),
    (v_academy, '미제출',        -2, 3),
    (v_academy, '수업 방해',     -3, 4);

  return v_academy;
end;
$$;

-- (2) 선생님: 학원 초대 코드로 합류
create or replace function public.join_academy_as_teacher(
  p_invite_code  text,
  p_display_name text
) returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_academy uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception '이미 소속된 학원이 있습니다.';
  end if;

  select id into v_academy
  from public.academies
  where invite_code = upper(trim(p_invite_code));

  if v_academy is null then
    raise exception '초대 코드를 찾을 수 없습니다.';
  end if;

  insert into public.profiles (id, academy_id, role, display_name)
  values (v_uid, v_academy, 'teacher',
          coalesce(nullif(trim(p_display_name), ''), '선생님'));

  return v_academy;
end;
$$;

-- (3) 학생: 본인 통장 코드로 계정을 연결
create or replace function public.claim_student(p_claim_code text)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_student public.students%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception '이미 연결된 계정입니다.';
  end if;

  select * into v_student
  from public.students
  where claim_code = upper(trim(p_claim_code));

  if v_student.id is null then
    raise exception '학생 코드를 찾을 수 없습니다.';
  end if;
  if v_student.user_id is not null then
    raise exception '이미 다른 계정에 연결된 코드입니다.';
  end if;

  update public.students set user_id = v_uid where id = v_student.id;

  insert into public.profiles (id, academy_id, role, display_name)
  values (v_uid, v_student.academy_id, 'student', v_student.name);

  return v_student.academy_id;
end;
$$;

-- (4) 원장 전용: 선생님 초대 코드 재발급
create or replace function public.rotate_invite_code()
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_owner() then
    raise exception '원장만 초대 코드를 재발급할 수 있습니다.';
  end if;

  v_code := public.gen_join_code(6);
  update public.academies
     set invite_code = v_code
   where id = public.my_academy_id();

  return v_code;
end;
$$;


-- ============================================================
--  8. 실행 권한
-- ============================================================
grant execute on function public.create_academy(text, text, text)        to authenticated;
grant execute on function public.join_academy_as_teacher(text, text)     to authenticated;
grant execute on function public.claim_student(text)                     to authenticated;
grant execute on function public.rotate_invite_code()                    to authenticated;
grant execute on function public.class_ranking(uuid)                     to authenticated;
grant execute on function public.academy_ranking()                       to authenticated;


-- ============================================================
--  9. 일일 마감 (통장 정리)
--     반별 통장 화면은 "오늘 적립분"만 보여주고,
--     수업이 끝나면 선생님이 그날 내역을 마감(확정)한다.
--     포인트 자체는 지급하는 즉시 transactions 에 저장되므로,
--     마감은 데이터 저장이 아니라 "확정 + 잠금" 의 의미다.
-- ============================================================

create table if not exists public.settlements (
  id              uuid primary key default gen_random_uuid(),
  academy_id      uuid not null references public.academies(id) on delete cascade,
  class_id        uuid not null references public.classes(id)   on delete cascade,
  settled_on      date not null,              -- 선생님 로컬 기준 날짜 (YYYY-MM-DD)
  settled_by      uuid references auth.users(id) on delete set null,
  settled_by_name text not null default '',
  total_delta     int  not null default 0,    -- 그날 순증감 합계
  student_count   int  not null default 0,    -- 그날 포인트를 받은 학생 수
  created_at      timestamptz not null default now(),
  unique (class_id, settled_on)               -- 하루에 한 번만 마감
);
create index if not exists settlements_class_idx on public.settlements(class_id, settled_on desc);

alter table public.settlements enable row level security;

drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements
  for select using (academy_id = public.my_academy_id());

drop policy if exists settlements_write on public.settlements;
create policy settlements_write on public.settlements
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());


-- ------------------------------------------------------------
--  기간별 집계 (결과 보기 화면)
--    p_class_id = null  → 학원 전체
--    p_since    = null  → 전체 기간
--  학생도 순위를 봐야 하므로 이름/합계만 돌려주는 SECURITY DEFINER 함수로 제공한다.
-- ------------------------------------------------------------
create or replace function public.ranking_summary(
  p_class_id uuid default null,
  p_since    timestamptz default null
)
returns table (
  student_id uuid,
  name       text,
  class_name text,
  balance    int,
  earned     int,
  spent      int,
  tx_count   int
)
language sql stable security definer set search_path = public
as $$
  select s.id,
         s.name,
         c.name,
         coalesce(sum(t.delta), 0)::int                                as balance,
         coalesce(sum(t.delta) filter (where t.delta > 0), 0)::int     as earned,
         coalesce(-sum(t.delta) filter (where t.delta < 0), 0)::int    as spent,
         count(t.id)::int                                              as tx_count
  from public.students s
  join public.classes c on c.id = s.class_id
  left join public.transactions t
         on t.student_id = s.id
        and (p_since is null or t.created_at >= p_since)
  where s.academy_id = public.my_academy_id()
    and (p_class_id is null or s.class_id = p_class_id)
    and public.is_staff()
  group by s.id, s.name, c.name
  order by balance desc, s.name asc;
$$;

grant execute on function public.ranking_summary(uuid, timestamptz) to authenticated;


-- ============================================================
--  10. 학원 로고
--     학원마다 헤더의 브랜드 마크(기본은 🐷)를 자기 로고로 바꿀 수 있다.
-- ============================================================

alter table public.academies
  add column if not exists logo_url text;

-- 로고 이미지를 담을 공개 버킷
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- 업로드 경로 규칙: "<academy_id>/logo.<확장자>"
-- 폴더 이름(첫 세그먼트)이 자신의 academy_id 와 같을 때만, 그리고 선생님/원장일 때만 쓰기 허용.
-- 읽기는 버킷이 public 이라 누구나 가능 (RLS 정책 불필요).
drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );
