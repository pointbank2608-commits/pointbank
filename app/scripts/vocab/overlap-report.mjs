// 원본 목록 전체 vs 기존 사전(812) + 시범 신규(166) 겹침 집계.
//   node app/scripts/vocab/overlap-report.mjs
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAW } from './raw-lists.mjs';
import { IDIOM_LISTS, MERGE_INTO, RAW_REST } from './raw-lists-rest.mjs';
import { NEW_ROWS } from './pilot-new-words.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

const existing = new Set(
  readdirSync(join(repo, 'app', 'public', 'word-bank-images'))
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.slice(0, -5).replace(/-\d+$/, '').toLowerCase()),
);
const pilot = new Set(Object.values(NEW_ROWS).flat().map(([w]) => w.toLowerCase()));

// 카테고리 → 단어들 (합치기 규칙 적용)
const cats = { ...RAW };
for (const [cat, list] of Object.entries(RAW_REST)) {
  const target = MERGE_INTO[cat] ?? cat;
  cats[target] = [...(cats[target] ?? []), ...list];
}

const where = new Map(); // 단어 → 등장 카테고리 집합
for (const [cat, list] of Object.entries(cats)) {
  for (const word of list) {
    const key = word.toLowerCase();
    if (!where.has(key)) where.set(key, new Set());
    where.get(key).add(cat);
  }
}

const all = [...where.keys()];
const inExisting = all.filter((w) => existing.has(w));
const inPilot = all.filter((w) => !existing.has(w) && pilot.has(w));
const fresh = all.filter((w) => !existing.has(w) && !pilot.has(w));
const multi = all.filter((w) => where.get(w).size > 1);
const raw = Object.values(cats).reduce((n, l) => n + l.length, 0);
const idioms = Object.values(IDIOM_LISTS).flat().length;

console.log(`카테고리 ${Object.keys(cats).length}개(단어 ${raw}줄) → 고유 단어 ${all.length}개`);
console.log(`  기존 사전과 겹침 ${inExisting.length} / 시범에서 이미 처리 ${inPilot.length} / 새로 처리할 단어 ${fresh.length}`);
console.log(`  여러 카테고리에 걸린 단어 ${multi.length}개 / 숙어·표현 ${idioms}개(별도)`);
if (process.argv.includes('--list')) {
  console.log('\n새로 처리할 단어:\n' + fresh.join(', '));
  console.log('\n기존과 겹치지만 카테고리가 다른 경우는 별도 검토 필요(extra_categories).');
}
