-- 파닉스 이미지 경로 일괄 채우기.
--
-- word_bank 와 다르게 id 가 아니라 word 기준이다 — 같은 단어가 여러 단계(step)에서
-- 다른 규칙의 예시로 반복되므로(예: cat 은 1단계·2단계 둘 다), 이미지 하나만 만들어서
-- 여러 행이 같이 쓴다. 커서가 app/public/phonics-images/<word>.png 로 채워 넣는다.
-- 화면에서는 이미지가 없으면(404) 대체 표시하고, 나중에 파일이 추가·배포되면 이 SQL을
-- 다시 실행할 필요 없이 자동으로 이미지가 나타난다.
update public.phonics_bank
set image_url = '/phonics-images/' || word || '.png';
