-- ============================================================
--  마이그레이션 007 — 플랫폼 관리자 (회원/서비스 관리 페이지)
--
--  가입한 학원 목록, 학원별 학생/선생님 수, 학원 삭제를 볼 수 있는
--  화면을 특정 계정 한 명(운영자 본인)에게만 열어준다.
--
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 1) profiles.role 에 'admin' 을 추가로 허용
--    (기존 제약: role in ('owner','teacher','student'))
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'teacher', 'student', 'admin'));

-- 2) 헬퍼: 로그인한 사람이 admin 인가?
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- 3) 온보딩 RPC — 이 이메일로 로그인한 사람만 admin 프로필을 만들 수 있다.
--    (다른 온보딩 함수들과 같은 패턴: 이메일은 서버에서 auth.users 로 직접 확인하므로
--     클라이언트가 값을 조작해도 소용없다.)
create or replace function public.claim_admin()
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception '이미 프로필이 있습니다.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  if v_email is null or lower(trim(v_email)) <> 'likesea85@naver.com' then
    raise exception '관리자 계정이 아닙니다.';
  end if;

  insert into public.profiles (id, academy_id, role, display_name)
  values (v_uid, null, 'admin', '관리자');
end;
$$;

-- anon 까지 명시적으로 막아야 한다 (Supabase는 public 스키마 함수 생성 시
-- anon/authenticated 양쪽에 기본 실행 권한을 자동 부여하기 때문 — 006 마이그레이션 참고).
revoke execute on function public.claim_admin() from anon;
revoke execute on function public.claim_admin() from public;
grant  execute on function public.claim_admin() to authenticated;

-- 4) 학원 목록 + 학생/선생님 수 (admin 만 호출 가능 — 아니면 빈 결과)
create or replace function public.admin_list_academies()
returns table (
  academy_id    uuid,
  name          text,
  point_unit    text,
  invite_code   text,
  created_at    timestamptz,
  owner_count   int,
  teacher_count int,
  student_count int
)
language sql stable security definer set search_path = public
as $$
  select
    a.id, a.name, a.point_unit, a.invite_code, a.created_at,
    (select count(*) from public.profiles p where p.academy_id = a.id and p.role = 'owner')::int,
    (select count(*) from public.profiles p where p.academy_id = a.id and p.role = 'teacher')::int,
    (select count(*) from public.students s where s.academy_id = a.id)::int
  from public.academies a
  where public.is_platform_admin()
  order by a.created_at desc;
$$;

revoke execute on function public.admin_list_academies() from anon;
revoke execute on function public.admin_list_academies() from public;
grant  execute on function public.admin_list_academies() to authenticated;

-- 5) admin 은 academies 테이블에 직접 select/delete 가능 (학원 삭제 버튼용).
--    기존 정책들(같은 학원 소속만 보기)에 "OR is_platform_admin()" 을 더하는 게 아니라
--    별도 permissive 정책을 추가하는 방식 — Postgres RLS는 같은 명령에 대한 여러
--    permissive 정책을 OR 로 합치므로 기존 정책과 충돌 없이 admin 접근만 추가된다.
drop policy if exists academies_admin_select on public.academies;
create policy academies_admin_select on public.academies
  for select using (public.is_platform_admin());

drop policy if exists academies_admin_delete on public.academies;
create policy academies_admin_delete on public.academies
  for delete using (public.is_platform_admin());

-- 6) profiles 도 admin 이 자기 프로필(역할이 admin인지 확인용)을 읽을 수 있어야
--    하는데, 이미 "id = auth.uid()" 조건으로 본인 행은 항상 읽힌다 (profiles_select
--    정책 참고) — 추가 정책 불필요.
