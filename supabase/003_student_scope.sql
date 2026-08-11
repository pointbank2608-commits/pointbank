-- ============================================================
--  마이그레이션 003 — 순위 조회를 선생님/원장 전용으로 제한
--
--  학생 화면에서 결과 보기를 없앴지만, 화면에서 숨기는 것만으로는
--  학생이 API 를 직접 호출하는 것을 막지 못한다.
--  순위 함수 자체에 is_staff() 조건을 넣어 학생에게는 빈 결과가 가도록 한다.
--
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
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
    and s.academy_id = public.my_academy_id()
    and public.is_staff()
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
