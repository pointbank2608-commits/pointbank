-- 082c: 관리자 권한을 "2단계 인증을 마친 로그인(aal2)"에서만 인정한다.
--
-- ⚠ 반드시 먼저 앱을 배포하고, 관리자 화면(/admin)에서 인증 앱(TOTP) 등록을 끝내고 한 번 로그인해 본 뒤에
--    실행하세요. 등록 전에 실행하면 관리자 화면의 모든 목록·기능이 막힙니다(되돌리려면 이 파일 맨 아래 주석의
--    "원래대로" 함수를 실행).
-- 이 함수는 모든 관리자 RPC·RLS 정책이 쓰므로, 한 번 실행하면 서버 쪽에서도 2단계 인증이 강제됩니다.

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid())
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2',
    false
  )
$$;

-- 원래대로(2단계 인증 강제 해제):
-- create or replace function public.is_platform_admin()
-- returns boolean language sql stable security definer set search_path = public
-- as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;
