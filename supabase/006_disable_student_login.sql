-- ============================================================
--  마이그레이션 006 — 학생 로그인 잠금 (베타 오픈 전 보안 조치)
--
--  베타 기간 동안은 원장/선생님만 로그인하도록 제한합니다.
--  academies.invite_code, students.claim_code 를 같은 학원 구성원 누구나
--  읽을 수 있는 구조인데, 학생 계정이 존재하면 학생이 이 값을 읽어
--  선생님 권한을 얻거나(초대코드) 다른 학생 계정을 가로챌(claim_code)
--  수 있었습니다. 학생 로그인 자체를 막으면 "넘을 권한 경계"가 없어져
--  이 문제가 해소됩니다.
--
--  claim_student() 함수/데이터는 지우지 않고 "실행 권한만" 회수합니다.
--
--  ⚠️ Supabase 는 public 스키마에 함수를 만들면 anon / authenticated
--  두 role 에 기본적으로 실행 권한을 자동 부여합니다(ALTER DEFAULT
--  PRIVILEGES). "authenticated" 와 "public" 에서만 revoke 하면 anon 쪽이
--  그대로 남아서, 로그인조차 하지 않은 사람도(브라우저 콘솔에서 anon key
--  로 직접 fetch) 함수를 호출할 수 있었습니다. 세 role 전부에서 revoke
--  해야 실제로 막힙니다.
--
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
--  (이전 006 버전을 이미 실행하셨어도, 이 파일을 한 번 더 실행하면
--   빠졌던 anon 권한까지 마저 회수되니 다시 실행하시면 됩니다.)
-- ============================================================

revoke execute on function public.claim_student(text) from authenticated;
revoke execute on function public.claim_student(text) from anon;
revoke execute on function public.claim_student(text) from public;

-- 다시 열 때 (세 role 모두 원상복구):
-- grant execute on function public.claim_student(text) to authenticated, anon, public;
-- (anon 에게는 원래도 줄 필요 없음 — authenticated 만 있으면 로그인한 사용자만 호출 가능)
