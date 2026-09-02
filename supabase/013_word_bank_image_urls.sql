-- 단어장 이미지 경로 일괄 채우기.
--
-- 커서가 app/public/word-bank-images/<id>.png 규칙으로 이미지를 계속 채워나가는 중이다.
-- 파일이 아직 없는 단어에도 미리 경로를 넣어둔다 — 화면(DictionaryPage)에서는 이미지가
-- 없으면(404) 그냥 책 이모지로 대체 표시하고, 나중에 커서가 그 파일을 추가해서 배포되면
-- 이 SQL을 다시 실행할 필요 없이 자동으로 이미지가 나타난다.
update public.word_bank
set image_url = '/word-bank-images/' || id || '.png';
