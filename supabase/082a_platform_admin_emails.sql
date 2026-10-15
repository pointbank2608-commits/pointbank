-- 082a: 관리자 이메일을 SQL 에 박아 두지 않고 표로 관리한다(2026-10-17, 관리자 계정 보호).
-- 순서: 082a → 082b → (앱 배포 후 2단계 인증 등록을 마친 뒤) 082c → 082_check.sql
-- 새 관리자를 늘릴 때는 이 표에 이메일만 넣으면 그 이메일로 가입한 사람이 관리자 프로필을 만들 수 있다.

create table if not exists public.platform_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.platform_admin_emails enable row level security;

insert into public.platform_admin_emails (email)
values ('likesea85@naver.com')
on conflict (email) do nothing;

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

  if v_email is null or not exists (
    select 1 from public.platform_admin_emails where lower(email) = lower(trim(v_email))
  ) then
    raise exception '관리자 계정이 아닙니다.';
  end if;

  insert into public.profiles (id, academy_id, role, display_name)
  values (v_uid, null, 'admin', '관리자');
end;
$$;
