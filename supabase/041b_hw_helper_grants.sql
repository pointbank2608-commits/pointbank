-- 041 보완(2026-10-05): 숙제 내부 도우미 함수 4개를 학생·선생님 브라우저가 직접 부르지 못하게 막는다.
-- (채점·정답 글·학생용 활동 만들기는 서버 함수 안에서만 쓰인다. 041 원본에도 같은 줄을 넣어 두었다.)
revoke all on function public.hw_norm(text) from public, anon, authenticated;
revoke all on function public.hw_grade(jsonb, text) from public, anon, authenticated;
revoke all on function public.hw_answer_text(jsonb) from public, anon, authenticated;
revoke all on function public.hw_public_item(public.homework_items) from public, anon, authenticated;
