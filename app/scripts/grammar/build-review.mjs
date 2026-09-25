// 문법 목록(app/src/data/grammarPoints.json — 원본) → 검수용 CSV(엑셀에서 바로 열리게 UTF-8 BOM).
// 실행: node app/scripts/grammar/build-review.mjs
// 필드 설명·설계 원칙은 app/src/lib/grammar.ts 머리말 참고.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GRAMMAR_POINTS = JSON.parse(readFileSync(join(here, '../../src/data/grammarPoints.json'), 'utf-8'));
const LEVEL_NAMES = { 1: '1 Notice & Name', 2: '2 Build & Respond', 3: '3 Connect & Describe', 4: '4 Tell & Explain', 5: '중1', 6: '중2', 7: '중3', 8: '8품사', 9: '시제', 10: '5형식', 11: '고등·동사', 12: '고등·준동사', 13: '고등·관계사·접속사', 14: '고등·가정법·비교', 15: '고등·특수 구문' };
const STAGE_NAMES = { elementary: '초등', middle: '중등', high: '고등', pos: '8품사', tense: '시제', forms: '5형식' };
const NL = String.fromCharCode(10);
const strip = (s) => s.replace(/\*\*/g, '');
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// 같은 id 가 두 번 들어가면 슬라이드가 엉뚱한 문법을 열게 되므로 미리 막는다.
const ids = new Set();
for (const g of GRAMMAR_POINTS) {
  if (ids.has(g.id)) throw new Error(`중복 id: ${g.id}`);
  ids.add(g.id);
}

const MAX_EX = Math.max(...GRAMMAR_POINTS.map((g) => g.examples.length));
const header = ['번호', '과정', '레벨', '단계', '학년', 'id', '문법 이름', '문장 틀', '한 줄 설명', ...Array.from({ length: MAX_EX }, (_, k) => `예문 ${k + 1}`), '이럴 때 써요', '쉽게 이해하기', '예문 해석', '규칙', '틀리기 쉬운 것 (✗ → ✓)', '한 줄 정리', '단어장 바꾸기 틀', '넣을 카테고리', '검수 메모'];
const rows = GRAMMAR_POINTS.map((g, i) => [
  i + 1,
  STAGE_NAMES[g.stage],
  LEVEL_NAMES[g.level],
  g.band,
  g.grade,
  g.id,
  g.name,
  strip(g.pattern),
  g.explain,
  ...Array.from({ length: MAX_EX }, (_, k) => strip(g.examples[k] ?? '')),
  (g.usage ?? []).join(NL),
  (g.detail ?? []).join(NL),
  (g.translations ?? []).map((k, i) => `${i + 1}. ${k}`).join(NL),
  (g.rule ?? []).join('\n'),
  (g.pitfalls ?? []).map((p) => `✗ ${p.wrong} → ✓ ${strip(p.right)} (${p.why})`).join('\n'),
  g.tip ?? '',
  g.slots ? g.slots.map((s) => s.template).join(' / ') : '(바꾸기 안 함)',
  g.slots ? [...new Set(g.slots.flatMap((s) => s.categories))].join(', ') : '',
  '',
]);

const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
const outPath = join(outDir, 'grammar-review.csv');
writeFileSync(outPath, csv);

const byLevel = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((l) => `${LEVEL_NAMES[l]}: ${GRAMMAR_POINTS.filter((g) => g.level === l).length}개`);
console.log(`문법 ${GRAMMAR_POINTS.length}개 → ${outPath}`);
console.log(byLevel.join('\n'));
console.log(`단어장 바꾸기 가능: ${GRAMMAR_POINTS.filter((g) => g.slots).length}개`);
