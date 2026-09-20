// 확장 배치(A~E) → 임포트 SQL + 검수용 CSV.
//   node app/scripts/vocab/build-batches.mjs
//   → supabase/024_word_bank_batch2.sql   새 행 insert (022 다음에 실행)
//   → supabase/025_word_bank_batch2_extra_categories.sql   여러 카테고리에 걸린 단어에 extra_categories 붙이기
//   → app/scripts/vocab/out/batch2-review.csv, out/batch2-extra-report.csv
//
// 검수 결과는 CSV가 아니라 batch-*.mjs 를 고치고 이 스크립트를 다시 돌려서 반영한다(여러 번 돌려도 같은 결과).

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAW } from './raw-lists.mjs';
import { IDIOM_LISTS, MERGE_INTO, RAW_REST } from './raw-lists-rest.mjs';
import { NEW_ROWS as PILOT_ROWS } from './pilot-new-words.mjs';
import { BATCH_A } from './batch-a.mjs';
import { BATCH_B } from './batch-b.mjs';
import { BATCH_C } from './batch-c.mjs';
import { BATCH_D } from './batch-d.mjs';
import { BATCH_E } from './batch-e.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const SORT_BASE = 1200; // 기존 812 + 시범 166(1000~1165) 뒤

const slug = (word) => word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (list) => (list.length ? `array[${list.map(q).join(', ')}]::text[]` : "'{}'");

const existingIds = readdirSync(join(repo, 'app', 'public', 'word-bank-images'))
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.slice(0, -'.webp'.length));
const pilotRows = Object.values(PILOT_ROWS).flat();
const pilotIds = pilotRows.map(([w, , , , , , opt = {}]) => opt.id ?? slug(w));
const allKnownIds = new Set([...existingIds, ...pilotIds]);
const baseOf = (id) => id.replace(/-\d+$/, '');
const idsOfWord = (word) => [...allKnownIds].filter((id) => id === slug(word) || baseOf(id) === slug(word));

// ── 새 행 모으기 ─────────────────────────────────────────────
const merged = {};
for (const b of [BATCH_A, BATCH_B, BATCH_C, BATCH_D, BATCH_E]) {
  for (const [cat, list] of Object.entries(b)) merged[cat] = [...(merged[cat] ?? []), ...list];
}

const errors = [];
const notes = [];
const rows = [];
const seen = new Set();
let order = SORT_BASE;
for (const [key, list] of Object.entries(merged)) {
  for (const [word, pos, meaning, example, level, subcategory, opt = {}] of list) {
    const category = opt.category ?? key;
    const id = opt.id ?? slug(word);
    const isIdiom = pos === '숙어' || pos === '표현';
    if (allKnownIds.has(id)) {
      if (isIdiom && !opt.id) {
        notes.push(`건너뜀(이미 있음): ${id}`);
        continue;
      }
      errors.push(`이미 있는 id: ${id}`);
      continue;
    }
    if (!opt.id && idsOfWord(word).length) {
      errors.push(`이미 있는 단어인데 뜻 행 옵션(id)이 없음: ${word} (${idsOfWord(word).join(', ')})`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`새 행 id 중복: ${id}`);
      continue;
    }
    seen.add(id);
    rows.push({ id, word, sense: opt.sense ?? 1, pos, meaning, example, category, subcategory, level, isIdiom, order: order++ });
  }
}

// ── 원본 목록의 카테고리 소속(자동 extra_categories 재료) ─────────────
const catsOfWord = new Map(); // 소문자 단어 → Set(카테고리)
const addMember = (cat, word) => {
  const key = word.toLowerCase();
  if (!catsOfWord.has(key)) catsOfWord.set(key, new Set());
  catsOfWord.get(key).add(cat);
};
for (const [cat, list] of Object.entries(RAW)) list.forEach((w) => addMember(cat, w));
for (const [cat, list] of Object.entries(RAW_REST)) list.forEach((w) => addMember(MERGE_INTO[cat] ?? cat, w));

// 뜻이 다른 행을 따로 만든 (단어, 카테고리) 쌍에는 다른 뜻 행에 카테고리를 자동으로 붙이지 않는다.
const explicitPairs = new Set(rows.filter((r) => r.sense > 1).map((r) => `${r.word.toLowerCase()}|${r.category}`));

// 자동으로 붙이면 뜻이 어긋나는 (단어|카테고리)는 뺀다.
const EXCLUDE = new Set(['can|환경', 'note|음악', 'matter|과학', 'card|쇼핑', 'card|돈']);

// 다의어(id가 여러 개)는 품사/뜻으로 골라서 붙인다. where 절은 SQL 그대로.
const SENSE_RULES = [
  ['fly', '동작', "part_of_speech = '동사'"],
  ['fly', '동물', "meaning like '%파리%'"],
  ['color', '동작', "part_of_speech = '동사'"],
  ['brush', '동작', "part_of_speech = '동사'"],
  ['dress', '동작', "part_of_speech = '동사'"],
  ['dress', '옷', "part_of_speech = '명사'"],
  ['rest', '동작', "part_of_speech = '동사'"],
  ['rest', '건강/질병', "part_of_speech = '명사'"],
  ['practice', '동작', "part_of_speech = '동사'"],
  ['plant', '동작', "part_of_speech = '동사'"],
  ['plant', '자연/날씨', "part_of_speech = '명사'"],
  ['plant', '과학', "part_of_speech = '명사'"],
  ['empty', '동작', "part_of_speech = '동사'"],
  ['empty', '상태', "part_of_speech = '형용사'"],
  ['point', '동작', "part_of_speech = '동사'"],
  ['point', '모양', "part_of_speech = '명사'"],
  ['point', '스포츠', "part_of_speech = '명사'"],
  ['chicken', '동물', "meaning like '%닭%' and meaning not like '%고기%'"],
  ['chicken', '음식', "meaning like '%닭고기%'"],
  ['fish', '동물', "meaning like '%물고기%'"],
  ['fish', '음식', "meaning like '%생선%'"],
  ['capital', '나라/세계', "meaning like '%수도%'"],
  ['may', '요일/달력', "meaning like '%5월%'"],
  ['kind', '감정', "part_of_speech = '형용사'"],
  ['kind', '성격', "part_of_speech = '형용사'"],
  ['kind', '상태', "part_of_speech = '형용사'"],
  ['present', '휴일/기념일', "meaning like '%선물%'"],
  ['band', '음악', "meaning like '%악단%' or meaning like '%밴드%'"],
  ['fall', '자연/날씨', "meaning like '%가을%'"],
  ['hard', '상태', "part_of_speech = '형용사'"],
  ['hard', '맛/질감', "meaning like '%딱딱%'"],
  ['right', '상태', "meaning like '%옳%' or meaning like '%맞%'"],
  ['right', '위치/방향', "meaning like '%오른%'"],
  ['march', '동작', "part_of_speech = '동사'"],
  ['march', '요일/달력', "meaning like '%3월%'"],
];
const senseRuleKeys = new Set(SENSE_RULES.map(([w, c]) => `${w}|${c}`));

// 새 행
for (const r of rows) {
  r.extra = [];
  if (r.isIdiom || r.sense > 1) continue;
  for (const cat of catsOfWord.get(r.word.toLowerCase()) ?? []) {
    const pair = `${r.word.toLowerCase()}|${cat}`;
    if (cat !== r.category && !explicitPairs.has(pair) && !EXCLUDE.has(pair)) r.extra.push(cat);
  }
}
// 이미 DB에 있는 행(기존 812 + 시범 166): 첫 번째 뜻 행(id = 슬러그)에만 붙인다. 다의어(-1,-2)는 사람이 정한다.
const extraOnExisting = []; // {id, add}
const ambiguous = [];
const missingCats = [];
const pilotWordSet = new Set(pilotRows.map(([w]) => w.toLowerCase()));
for (const [word, cats] of catsOfWord) {
  if (seen.has(slug(word)) || rows.some((r) => r.word.toLowerCase() === word)) continue; // 새 행으로 이미 처리
  const ids = idsOfWord(word);
  if (!ids.length) {
    if (!pilotWordSet.has(word)) missingCats.push(word);
    continue;
  }
  const target = ids.includes(slug(word)) && ids.length === 1 ? ids[0] : null;
  for (const cat of cats) {
    const pair = `${word}|${cat}`;
    if (explicitPairs.has(pair) || EXCLUDE.has(pair) || senseRuleKeys.has(pair)) continue;
    if (target) extraOnExisting.push({ id: target, add: cat, word });
    else ambiguous.push(`${word} → ${cat} (${ids.join(', ')})`);
  }
}

// ── 커버리지 확인: 원본 목록의 단어가 전부 어딘가에 있는지 ─────────────
const rowWords = new Set(rows.map((r) => r.word.toLowerCase()));
const uncovered = [...catsOfWord.keys()].filter(
  (w) => !rowWords.has(w) && !idsOfWord(w).length && !pilotWordSet.has(w),
);
const idiomRaw = Object.values(IDIOM_LISTS).flat();
const idiomUncovered = idiomRaw.filter((w) => !rowWords.has(w.toLowerCase()) && !allKnownIds.has(slug(w)));
const outside = rows.filter((r) => !r.isIdiom && r.sense === 1 && !catsOfWord.has(r.word.toLowerCase())).map((r) => r.word);

if (errors.length) {
  console.error('오류:\n' + errors.join('\n'));
  process.exit(1);
}

// ── SQL ─────────────────────────────────────────────────────
const insertSql = [
  '-- 024. 확장 배치 2: 외모·몸·옷·색깔·장소·나라·행사·요일·취미·감정·휴일·집·건강·쇼핑·돈·음악·자연·숫자·사람·학교·',
  '-- 모양·스포츠·크기·우주·장난감·교통·과학기술·상태·위치·의문사·성격·맛·직업·재료·과학·환경·독해 + 숙어·표현.',
  '-- 020, 021, 022 다음에 실행. 여러 번 실행해도 안전(on conflict do nothing). image_url은 그림 파일이 생긴 뒤 별도로 채운다.',
  '-- app/scripts/vocab/build-batches.mjs 로 생성.',
  '',
  'insert into public.word_bank',
  '  (id, word, sense_number, part_of_speech, meaning, example_sentence, category, extra_categories, subcategory, level, origin, image_url, sort_order)',
  'values',
  rows
    .map(
      (r) =>
        `  (${q(r.id)}, ${q(r.word)}, ${r.sense}, ${q(r.pos)}, ${q(r.meaning)}, ${q(r.example)}, ${q(r.category)}, ${arr(r.extra)}, ${q(r.subcategory)}, ${r.level}, 'classbank', null, ${r.order})`,
    )
    .join(',\n'),
  'on conflict (id) do nothing;',
  '',
].join('\n');
writeFileSync(join(repo, 'supabase', '024_word_bank_batch2.sql'), insertSql);

// 기존/시범 행에 추가 카테고리: 카테고리별로 id 묶어서 한 줄씩
const grouped = new Map();
for (const { id, add } of extraOnExisting) {
  if (!grouped.has(add)) grouped.set(add, new Set());
  grouped.get(add).add(id);
}
const extraSql = [
  '-- 025. 이미 있는 단어(기존 812 + 시범 166)가 다른 카테고리에도 걸릴 때 extra_categories 붙이기.',
  '-- 024 다음에 실행. 이미 그 카테고리에 속해 있으면 건드리지 않는다(여러 번 실행해도 안전).',
  '-- app/scripts/vocab/build-batches.mjs 로 생성.',
  '',
  ...[...grouped].map(
    ([cat, ids]) =>
      `update public.word_bank set extra_categories = array_append(extra_categories, ${q(cat)})\n` +
      `where id in (${[...ids].map(q).join(', ')}) and category <> ${q(cat)} and not (${q(cat)} = any(extra_categories));`,
  ),
  '',
].join('\n');
writeFileSync(join(repo, 'supabase', '025_word_bank_batch2_extra_categories.sql'), extraSql);

// ── CSV ─────────────────────────────────────────────────────
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, body) => '﻿' + [header, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
mkdirSync(join(here, 'out'), { recursive: true });
writeFileSync(
  join(here, 'out', 'batch2-review.csv'),
  toCsv(
    ['id', 'word', '품사', '뜻', '예문', '카테고리', '추가 카테고리', '소분류', '레벨', '뜻 번호'],
    rows.map((r) => [r.id, r.word, r.pos, r.meaning, r.example, r.category, r.extra.join(' / '), r.subcategory, r.level, r.sense]),
  ),
);
writeFileSync(
  join(here, 'out', 'batch2-extra-report.csv'),
  toCsv(
    ['단어', '기존/시범 id', '추가되는 카테고리'],
    extraOnExisting.map((e) => [e.word, e.id, e.add]),
  ),
);

// ── 요약 ────────────────────────────────────────────────────
const byCat = {};
for (const r of rows) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
const byLv = {};
for (const r of rows) byLv[r.level] = (byLv[r.level] ?? 0) + 1;
console.log(`새 행 ${rows.length}개 (숙어·표현 ${rows.filter((r) => r.isIdiom).length}개)`);
console.log('카테고리별', byCat);
console.log('레벨별', byLv);
console.log(`새 행에 자동 extra_categories: ${rows.filter((r) => r.extra.length).length}개 행`);
console.log(`기존/시범 행에 extra_categories 추가: ${extraOnExisting.length}건 (${grouped.size}개 카테고리)`);
if (notes.length) console.log('건너뜀:', notes.join(', '));
if (ambiguous.length) console.log(`다의어라 자동 처리 못 한 것 ${ambiguous.length}건:\n  ` + ambiguous.join('\n  '));
console.log(`원본 목록에서 아직 처리 안 된 단어 ${uncovered.length}개:`, uncovered.join(', '));
if (idiomUncovered.length) console.log('처리 안 된 숙어·표현:', idiomUncovered.join(', '));
if (outside.length) console.log(`원본 목록에 없는 새 행 ${outside.length}개(내가 추가한 것):`, outside.join(', '));
console.log('사용된 카테고리 목록:', [...new Set(rows.map((r) => r.category))].join(', '));
