-- 3단계: 반 숙제 번호 + 이름 + PIN 로그인 폐지 (학생은 학생 포털 /s 의 개인 링크로만 연다).
-- 함수를 지우지 않고 학생(익명) 실행 권한만 회수한다. 되돌리기는 맨 아래 주석.
-- 적용 전: 앱(HomeworkStudentPage)에서 PIN 입구를 뺀 버전이 먼저 배포돼 있어야 한다.
begin;
revoke execute on function public.hw_login_name(text, text, text) from anon, authenticated, public;
commit;

-- rollback:
-- grant execute on function public.hw_login_name(text, text, text) to anon, authenticated;
