-- ============================================================
--  마이그레이션 002 — 일일 마감(통장 정리) + 결과 보기 집계
--
--  이미 schema.sql 을 실행한 프로젝트에 추가로 적용하는 파일입니다.
--  Supabase 대시보드 > SQL Editor 에 이 파일 내용만 붙여넣고 Run 하세요.
--  (schema.sql 에도 같은 내용이 9번 섹션으로 들어 있으니,
--   새로 세팅하는 경우엔 schema.sql 하나만 실행하면 됩니다.)
-- ============================================================

-- ------------------------------------------------------------
--  1. 일일 마감
--     반별 통장 화면은 "오늘 적립분"만 보여주고,
--     수업이 끝나면 선생님이 그날 내역을 마감(확정)한다.
--     포인트 자체는 지급하는 즉시 transactions 에 저장되므로,
--     마감은 데이터 저장이 아니라 "확정 + 잠금" 의 의미다.
-- ------------------------------------------------------------
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
--  2. 기간별 집계 (결과 보기 화면)
--     p_class_id = null → 학원 전체
--     p_since    = null → 전체 기간
--     학생도 순위를 봐야 하므로 이름/합계만 돌려주는
--     SECURITY DEFINER 함수로 제공한다.
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
  group by s.id, s.name, c.name
  order by balance desc, s.name asc;
$$;

grant execute on function public.ranking_summary(uuid, timestamptz) to authenticated;
