// 시범 신규 단어 → 임포트 SQL + 검수용 CSV 생성.
//   node app/scripts/vocab/pilot-build.mjs
//   → supabase/022_word_bank_pilot.sql   (SQL Editor에서 020, 021 다음에 실행)
//   → app/scripts/vocab/out/pilot-review.csv   (Excel에서 열어 뜻·예문·레벨 검수)
//
// 검수 결과는 CSV를 고치는 게 아니라 pilot-new-words.mjs 를 고치고 이 스크립트를 다시 돌려서 반영한다.

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXISTING_SUBCATEGORY, EXTRA_CATEGORY_ON_EXISTING, NEW_ROWS } from './pilot-new-words.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const SORT_BASE = 1000; // 기존 812행(sort_order ≤ 812) 뒤에 이어 붙인다. 다음 배치는 이 값을 올려서 쓴다.

const existingIds = readdirSync(join(repo, 'app', 'public', 'word-bank-images'))
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.slice(0, -'.webp'.length));
const existingSet = new Set(existingIds);
const idsOfWord = (word) => existingIds.filter((id) => id === word || id.replace(/-\d+$/, '') === word);

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const slug = (word) => word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const errors = [];
const rows = [];
let order = SORT_BASE;
for (const [category, list] of Object.entries(NEW_ROWS)) {
  for (const [word, pos, meaning, example, level, subcategory, opt = {}] of list) {
    const id = opt.id ?? slug(word);
    if (existingSet.has(id)) errors.push(`이미 있는 id: ${id}`);
    if (!opt.id && idsOfWord(word).length) errors.push(`이미 있는 단어인데 뜻 행 옵션(id)이 없음: ${word}`);
    rows.push({ id, word, sense: opt.sense ?? 1, pos, meaning, example, category, subcategory, level, order: order++ });
  }
}
const dupIds = rows.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupIds.length) errors.push(`새 행 id 중복: ${dupIds.join(', ')}`);

for (const [cat, subs] of Object.entries(EXISTING_SUBCATEGORY)) {
  for (const [sub, words] of Object.entries(subs)) {
    for (const w of words) if (!idsOfWord(w).length) errors.push(`기존 사전에 없는 단어(소분류 ${cat}/${sub}): ${w}`);
  }
}
for (const { ids } of EXTRA_CATEGORY_ON_EXISTING) {
  for (const id of ids) if (!idsOfWord(id).length) errors.push(`기존 사전에 없는 단어(추가 카테고리): ${id}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const sql = [];
sql.push('-- 022. 시범 배치: 동물·음식·동작 (020_word_bank_levels.sql, 021 다음에 실행. 여러 번 실행해도 안전)');
sql.push('-- app/scripts/vocab/pilot-build.mjs 로 생성. 뜻·예문·레벨은 초안 — 검수는 pilot-review.csv.');
sql.push('');
sql.push('-- 1) 이미 있는 행에 추가 카테고리 붙이기(뜻이 같은 단어가 다른 카테고리에도 걸릴 때)');
for (const { ids, add } of EXTRA_CATEGORY_ON_EXISTING) {
  sql.push(
    `update public.word_bank set extra_categories = array_append(extra_categories, ${q(add)})\n` +
      `where id in (${ids.map(q).join(', ')}) and category <> ${q(add)} and not (${q(add)} = any(extra_categories));`,
  );
}
sql.push('');
sql.push('-- 2) 새 단어(이미 있는 단어의 다른 뜻 행 포함). image_url은 그림 파일이 생긴 뒤 별도로 채운다.');
sql.push(
  'insert into public.word_bank\n' +
    '  (id, word, sense_number, part_of_speech, meaning, example_sentence, category, extra_categories, subcategory, level, origin, image_url, sort_order)\nvalues',
);
sql.push(
  rows
    .map(
      (r) =>
        `  (${q(r.id)}, ${q(r.word)}, ${r.sense}, ${q(r.pos)}, ${q(r.meaning)}, ${q(r.example)}, ${q(r.category)}, '{}', ${q(r.subcategory)}, ${r.level}, 'classbank', null, ${r.order})`,
    )
    .join(',\n'),
);
sql.push('on conflict (id) do nothing;');
sql.push('');
sql.push('-- 3) 이미 있는 812단어 중 이 세 카테고리에 속한 것들에 소분류 붙이기');
for (const [cat, subs] of Object.entries(EXISTING_SUBCATEGORY)) {
  for (const [sub, words] of Object.entries(subs)) {
    const ids = [...new Set(words.flatMap(idsOfWord))];
    sql.push(
      `update public.word_bank set subcategory = ${q(sub)}\n` +
        `where id in (${ids.map(q).join(', ')}) and (category = ${q(cat)} or ${q(cat)} = any(extra_categories));`,
    );
  }
}
sql.push('');
writeFileSync(join(repo, 'supabase', '022_word_bank_pilot.sql'), sql.join('\n'));

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ['id', 'word', '품사', '뜻', '예문', '카테고리', '소분류', '레벨', '뜻 번호'];
const csv = [header, ...rows.map((r) => [r.id, r.word, r.pos, r.meaning, r.example, r.category, r.subcategory, r.level, r.sense])]
  .map((row) => row.map(csvCell).join(','))
  .join('\r\n');
mkdirSync(join(here, 'out'), { recursive: true });
writeFileSync(join(here, 'out', 'pilot-review.csv'), '﻿' + csv + '\r\n');

const byCat = {};
for (const r of rows) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
const byLv = {};
for (const r of rows) byLv[r.level] = (byLv[r.level] ?? 0) + 1;
console.log(`새 행 ${rows.length}개`, byCat, '레벨', byLv);
