-- ============================================================
--  030: 수업 공유 링크 + 학생 따라보기 링크 — 2026-09-27
--
--  1) lesson_shares: 선생님이 만든 수업을 링크로 다른 선생님(다른 학원 포함)에게 준다.
--     링크를 만드는 순간의 수업을 한 묶음(snapshot: 슬라이드 + 단어장 단어 + 게임 내용)으로 저장해 두고,
--     받은 선생님은 lesson_share_get 으로 미리 본 뒤 "내 수업으로 가져오기"로 자기 학원에 새로 만든다.
--     학생 이름·출석·포인트는 묶음에 넣지 않는다(앱이 만들 때 빼고 만든다).
--  2) lesson_views: 온라인(줌) 수업에서 학생이 링크를 열면 선생님이 넘기는 슬라이드가 학생 화면에도 따라 나온다.
--     학생은 로그인하지 않는다 — lesson_view_get(처음 한 번 수업 묶음) / lesson_view_state(지금 슬라이드)로만.
--
--  SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- ============================================================

-- ---------- 1) 수업 공유 ----------
create table if not exists public.lesson_shares (
  id uuid primary key default gen_random_uuid(),
  -- 링크에 들어가는 추측하기 어려운 열쇠
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  academy_id uuid not null references public.academies(id) on delete cascade,
  lesson_id uuid references public.curriculum_lessons(id) on delete set null,
  title text not null default '',
  snapshot jsonb not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists lesson_shares_lesson_idx on public.lesson_shares (lesson_id);

alter table public.lesson_shares enable row level security;
drop policy if exists lesson_shares_staff on public.lesson_shares;
create policy lesson_shares_staff on public.lesson_shares
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

-- 링크로 미리 보기(로그인 안 한 사람도 — 가입 전에 무엇을 받는지 볼 수 있게)
create or replace function public.lesson_share_get(p_token text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'title', s.title,
    'snapshot', s.snapshot,
    'academy_name', a.name,
    'created_at', s.created_at
  )
  from public.lesson_shares s
  join public.academies a on a.id = s.academy_id
  where s.token = p_token and s.revoked_at is null
$$;
revoke all on function public.lesson_share_get(text) from public;
grant execute on function public.lesson_share_get(text) to anon, authenticated;

-- ---------- 2) 학생 따라보기 ----------
create table if not exists public.lesson_views (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  academy_id uuid not null references public.academies(id) on delete cascade,
  title text not null default '',
  -- 발표용 수업 묶음(슬라이드 + 수업 단어) — 학생 화면이 이걸로 그린다
  snapshot jsonb not null,
  slide_id text,
  -- 슬라이드 안 단계(문법 예문 몇 개, 노래 몇 번째 줄, 카드 몇 번째 …)
  sub jsonb,
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists lesson_views_code_idx on public.lesson_views (code) where ended_at is null;

alter table public.lesson_views enable row level security;
drop policy if exists lesson_views_staff on public.lesson_views;
create policy lesson_views_staff on public.lesson_views
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

create or replace function public.lesson_view_host_create(p_title text, p_snapshot jsonb, p_slide_id text default null)
returns public.lesson_views
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_row public.lesson_views;
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  update public.lesson_views set ended_at = now()
   where ended_at is null and created_at < now() - interval '1 day';
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from public.lesson_views where code = v_code and ended_at is null);
  end loop;
  insert into public.lesson_views (code, academy_id, title, snapshot, slide_id)
  values (v_code, public.my_academy_id(), coalesce(p_title, ''), p_snapshot, p_slide_id)
  returning * into v_row;
  return v_row;
end $$;
grant execute on function public.lesson_view_host_create(text, jsonb, text) to authenticated;

-- 학생: 처음 한 번 — 수업 묶음까지
create or replace function public.lesson_view_get(p_code text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object('title', v.title, 'snapshot', v.snapshot, 'slide_id', v.slide_id, 'sub', v.sub, 'ended', v.ended_at is not null)
  from public.lesson_views v
  where v.code = btrim(p_code) and v.created_at > now() - interval '1 day'
  order by v.created_at desc
  limit 1
$$;
-- 학생: 자주 — 지금 슬라이드만(가볍게)
create or replace function public.lesson_view_state(p_code text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object('slide_id', v.slide_id, 'sub', v.sub, 'ended', v.ended_at is not null, 'updated_at', v.updated_at)
  from public.lesson_views v
  where v.code = btrim(p_code) and v.created_at > now() - interval '1 day'
  order by v.created_at desc
  limit 1
$$;
revoke all on function public.lesson_view_get(text) from public;
revoke all on function public.lesson_view_state(text) from public;
grant execute on function public.lesson_view_get(text) to anon, authenticated;
grant execute on function public.lesson_view_state(text) to anon, authenticated;
