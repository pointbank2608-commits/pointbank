// public/word-bank-lineart 폴더에 실제로 있는 선화 파일 목록을 src/lib/lineartManifest.ts 로 뽑는다.
//   node scripts/vocab/lineart-manifest.mjs
// 선화는 정적 파일이라 앱이 런타임에 폴더를 읽을 수 없어서, dev/build 직전에 자동으로 다시 만든다
// (package.json 의 predev / prebuild). 커서가 선화를 더 만들면 dev/build 를 다시 돌리면 반영된다.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECOR_SETS } from './lineart-words.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', '..');
const dir = join(appDir, 'public', 'word-bank-lineart');

const list = (d) =>
  existsSync(d)
    ? readdirSync(d)
        .filter((f) => f.endsWith('.webp'))
        .map((f) => f.slice(0, -5))
        .sort()
    : [];

const words = list(dir);
const decorIds = new Set(list(join(dir, 'decor')));
const decor = {};
for (const [theme, items] of Object.entries(DECOR_SETS)) {
  const ids = Object.keys(items).filter((id) => decorIds.has(id));
  if (ids.length) decor[theme] = ids;
}

const out = [
  '// 자동 생성 파일 — 직접 고치지 말 것. app/scripts/vocab/lineart-manifest.mjs 가 만든다(predev/prebuild).',
  '/** public/word-bank-lineart/<id>.webp 가 실제로 있는 단어 id(단어 슬러그) */',
  `export const LINEART_WORD_IDS: readonly string[] = ${JSON.stringify(words)};`,
  '',
  '/** public/word-bank-lineart/decor/<id>.webp 가 실제로 있는 장식 부품(주제별) */',
  `export const LINEART_DECOR: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(decor)};`,
  '',
].join('\n');
writeFileSync(join(appDir, 'src', 'lib', 'lineartManifest.ts'), out);
console.log(`선화 ${words.length}개, 장식 ${Object.values(decor).flat().length}개 → src/lib/lineartManifest.ts`);
