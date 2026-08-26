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
--  나중에 학생 로그인을 다시 열 때는 맨 아래 GRANT 문만 다시 실행하면 됩니다.
--
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

revoke execute on function public.claim_student(text) from authenticated;
revoke execute on function public.claim_student(text) from public;

-- 다시 열 때:
-- grant execute on function public.claim_student(text) to authenticated;
