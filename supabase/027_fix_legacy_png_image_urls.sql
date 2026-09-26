-- 027. 옛 ".png" 그림 주소를 ".webp" 로 한 번에 고치기 (2026-09-26)
--
-- 017에서 사전(word_bank)·파닉스 그림을 PNG → WebP 로 바꾸면서 word_bank.image_url 은 고쳤지만,
-- 단어장·게임 내용·수업은 단어를 담을 때 그림 주소를 "복사"해 두기 때문에 그 전에 만든 것들은
-- 아직 없는 .png 파일을 가리킨다(그림이 깨져 보임). 앱은 불러올 때 이미 고쳐서 보여주지만
-- (api.ts fixLegacyImageUrls), 저장된 데이터도 깔끔하게 맞춰 둔다. 여러 번 실행해도 안전하다.

update word_lists
set items = regexp_replace(items::text, '(/(?:word-bank-images|phonics-images)/[^"]+)\.png"', '\1.webp"', 'g')::jsonb
where items::text ~ '/(word-bank-images|phonics-images)/[^"]+\.png"';

update game_templates
set items = regexp_replace(items::text, '(/(?:word-bank-images|phonics-images)/[^"]+)\.png"', '\1.webp"', 'g')::jsonb
where items::text ~ '/(word-bank-images|phonics-images)/[^"]+\.png"';

update game_templates
set config = regexp_replace(config::text, '(/(?:word-bank-images|phonics-images)/[^"]+)\.png"', '\1.webp"', 'g')::jsonb
where config::text ~ '/(word-bank-images|phonics-images)/[^"]+\.png"';

update curriculum_lessons
set playlist = regexp_replace(playlist::text, '(/(?:word-bank-images|phonics-images)/[^"]+)\.png"', '\1.webp"', 'g')::jsonb
where playlist::text ~ '/(word-bank-images|phonics-images)/[^"]+\.png"';
