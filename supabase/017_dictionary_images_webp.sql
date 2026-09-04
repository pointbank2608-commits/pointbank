-- 사전(word_bank)·파닉스(phonics_bank) 이미지를 PNG(장당 평균 약 1.4MB)에서
-- WebP(장당 평균 약 100~110KB)로 재인코딩 — 해상도는 그대로 유지(1024px)해서 전자칠판
-- 전체화면 확대에도 화질 손실 없음. app/public/word-bank-images, app/public/phonics-images
-- 안의 실제 파일도 같은 작업으로 .png -> .webp 로 이미 교체돼 배포됨(013/015 번 마이그레이션은
-- 과거 기록이라 그대로 두고, 이 파일로 확장자만 갱신한다).

update public.word_bank
set image_url = '/word-bank-images/' || id || '.webp'
where image_url like '/word-bank-images/%.png';

update public.phonics_bank
set image_url = '/phonics-images/' || word || '.webp'
where image_url like '/phonics-images/%.png';
