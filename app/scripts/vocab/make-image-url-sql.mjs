// 새로 만든 단어 이미지 파일을 사전 DB에 연결하는 SQL 생성.
//   node app/scripts/vocab/make-image-url-sql.mjs   →  supabase/023_word_bank_new_image_urls.sql
//
// 기존 812개는 이미 image_url이 채워져 있어서 건드리지 않는다. 새 단어는 022 임포트 때 image_url을
// 일부러 null로 넣었고(그림이 없는 채로 이미지 퀴즈 후보에 뽑혀 깨진 그림이 나오는 걸 막으려고),
// 새 단어 목록(image-targets.mjs: 시범 + 확장 배치)에 있으면서 실제 그림 파일도 생긴 단어만 여기서 경로를 채운다.
// 여러 번 돌려도 안전하다(image_url이 null인 행만 바꾼다).

import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TARGETS } from './image-targets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const out = join(repo, 'supabase', '023_word_bank_new_image_urls.sql');

const files = new Set(
  readdirSync(join(repo, 'app', 'public', 'word-bank-images'))
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.slice(0, -'.webp'.length)),
);

const newIds = ALL_TARGETS.map((r) => r.id);
const withImage = newIds.filter((id) => files.has(id));
const missing = newIds.filter((id) => !files.has(id));

if (withImage.length === 0) {
  if (existsSync(out)) rmSync(out);
  console.log(`새 단어 ${newIds.length}개 중 그림 파일이 있는 단어가 아직 없습니다.`);
  process.exit(0);
}

const sql = [
  '-- 023. 새 단어 중 그림 파일이 생긴 것에 image_url 채우기 (image_url이 아직 null인 행만).',
  '-- app/scripts/vocab/make-image-url-sql.mjs 로 생성. 그림 파일이 배포된 뒤에 실행한다.',
  '',
  'update public.word_bank',
  "set image_url = '/word-bank-images/' || id || '.webp'",
  'where image_url is null',
  `  and id in (${withImage.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ')});`,
  '',
].join('\n');

writeFileSync(out, sql);
console.log(`그림 있는 새 단어 ${withImage.length}개 → 023 SQL 생성 (아직 그림 없음: ${missing.length}개)`);
