// 교육부 3000 중·고등 빠진 단어 → SQL + 검수 CSV + 그림 대상 목록(2026-10-02)
//   node app/scripts/vocab/build-moe-upper.mjs
// 원본: batch-moe-mid-*.mjs(중학, Lv.5) · batch-moe-high-*.mjs(고등, Lv.6). 있는 파일만 읽는다(묶음이 다 차기 전에도 돌릴 수 있게).
// moe-upper-missing.json(엑셀과 사전을 비교해 뽑은 목록)과 맞춰 보고 빠진·남는 단어를 알려 준다.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { slug } from './image-targets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const KINDS = ['object', 'scene', 'symbol', 'none'];
const expected = JSON.parse(readFileSync(join(here, 'moe-upper-missing.json'), 'utf8'));
const catSrc = readFileSync(join(repo, 'app', 'src', 'lib', 'wordBankCategories.ts'), 'utf8');
const CATEGORIES = new Set([...catSrc.slice(0, catSrc.indexOf('] as const')).matchAll(/'([^']+)'/g)].map((m) => m[1]));
// 엑셀 표제어와 다르게 쓰는 표기(더 흔한 쪽을 사전에 넣는다): 엑셀 표제어 → 우리 표기
const ALIAS = { advertize: 'advertise', catalogue: 'catalog', defence: 'defense', disk: 'disc', especial: 'especially', technic: 'technique', towards: 'toward', aggress: 'aggressive', artifice: 'artificial', avail: 'available', datum: 'data', destine: 'destination', destruct: 'destruction', analyse: 'analyze', err: 'error', evitable: 'inevitable', illude: 'illusion', opportune: 'opportunity', opt: 'option', negate: 'negative', oversea: 'overseas', 0: 'false', fibre: 'fiber', flavour: 'flavor', harbour: 'harbor', enquire: 'inquire', posit: 'position', sculpt: 'sculpture', sophisticate: 'sophisticated', suffice: 'sufficient', transact: 'transaction', rumour: 'rumor', upwards: 'upward', utilise: 'utilize' };
// 엑셀엔 한 낱말로 적혔지만 사전에 이미 다른 표기로 있는 단어(다시 넣지 않는다)
const ALREADY = new Set(['livingroom', 'environ']);
const variants = (w) => {
  const id = slug(w.split('/')[0].trim());
  return ALIAS[id] ? [id, ALIAS[id]] : [id];
};

const existingIds = new Set(
  readdirSync(join(repo, 'app', 'public', 'word-bank-images')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)),
);

async function load(prefix) {
  const files = readdirSync(here).filter((f) => f.startsWith(prefix) && f.endsWith('.mjs')).sort();
  const rows = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(here, f)).href);
    for (const list of Object.values(mod)) if (Array.isArray(list)) rows.push(...list);
  }
  return rows;
}

function build(name, raw, want, sortBase, level) {
  const errors = [];
  const ids = new Set();
  const rows = raw.map(([word, pos, meaning, example, lv, category, subcategory, kind, scene], i) => {
    const id = slug(word);
    if (ids.has(id)) errors.push(`id 중복: ${id}`);
    ids.add(id);
    if (existingIds.has(id)) errors.push(`이미 그림이 있는 id: ${id}`);
    if (!KINDS.includes(kind)) errors.push(`${word}: 그림 종류 ${kind}`);
    if (kind !== 'none' && !scene) errors.push(`${word}: 장면 힌트 없음`);
    if (!CATEGORIES.has(category)) errors.push(`${word}: 없는 카테고리 ${category}`);
    if (lv !== level) errors.push(`${word}: 레벨 ${lv}`);
    return { id, word, pos, meaning, example, level: lv, category, subcategory, kind, scene, sort: sortBase + i };
  });
  // 예문에 그 단어(또는 그 변화형의 앞부분)가 들어 있는지 — 다른 단어 예문을 잘못 붙였는지 거른다
  const stem = (w) => w.toLowerCase().slice(0, Math.max(3, w.length - 2));
  const noWord = rows.filter((r) => !r.example.toLowerCase().includes(stem(r.word))).map((r) => r.word);
  const wantSets = want.filter((w) => !ALREADY.has(slug(w.word))).map((w) => variants(w.word));
  const missing = wantSets.filter((v) => !v.some((id) => ids.has(id))).map((v) => v[v.length - 1]);
  const wantAll = new Set(wantSets.flat());
  const extra = [...ids].filter((id) => !wantAll.has(id));
  console.log(
    `[${name}] ${rows.length}/${want.length}  빠진 ${missing.length}  남는 ${extra.length}  오류 ${errors.length}`,
    Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.kind === k).length])),
  );
  if (extra.length) console.log('  남는:', extra.join(', '));
  if (errors.length) console.log('  오류:\n   ' + errors.slice(0, 40).join('\n   '));
  if (noWord.length) console.log('  예문에 단어가 안 보임(변화형이면 괜찮음):', noWord.join(', '));
  if (missing.length) console.log('  빠진(앞 30):', missing.slice(0, 30).join(', '));
  return { rows, missing, errors, extra };
}

const mid = build('중학', await load('batch-moe-mid-'), expected.middle, 4000, 5);
const high = build('고등', await load('batch-moe-high-'), expected.high, 5000, 6);

function sqlFor(num, title, rows) {
  const values = rows
    .map((r) => `  (${[q(r.id), q(r.word), 1, q(r.pos), q(r.meaning), q(r.example), q(r.category), "'{}'", q(r.subcategory), r.level, "'moe'", 'null', q(r.kind), r.sort].join(', ')})`)
    .join(',\n');
  return `-- ${num}. 교육부 2022 기본어휘 ${title} 중 사전에 없던 ${rows.length}개 (origin 'moe').
-- image_kind: object 사물 / scene 인물 장면 / symbol 도식 / none 그림을 만들지 않음(중·고등은 기본이 글자형).
-- 033 다음에 실행. 여러 번 실행해도 안전(on conflict do nothing). image_url 은 그림이 생긴 뒤 따로 채운다.
-- app/scripts/vocab/build-moe-upper.mjs 로 생성.

insert into public.word_bank
  (id, word, sense_number, part_of_speech, meaning, example_sentence, category, extra_categories, subcategory, level, origin, image_url, image_kind, sort_order)
values
${values}
on conflict (id) do nothing;
`;
}

const csv = (rows) =>
  '﻿id,단어,품사,뜻,예문,레벨,카테고리,소분류,그림 종류,장면\n' +
  rows
    .map((r) => [r.id, r.word, r.pos, r.meaning, r.example, r.level, r.category, r.subcategory, r.kind, r.scene].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n') +
  '\n';

const clean = (b) => b.rows.length > 0 && b.errors.length === 0 && b.extra.length === 0;
if (clean(mid)) {
  writeFileSync(join(repo, 'supabase', '036_word_bank_moe_middle.sql'), sqlFor('036', '중학(**) 1200개', mid.rows));
  writeFileSync(join(here, 'out', 'moe-middle-review.csv'), csv(mid.rows));
}
if (clean(high)) {
  writeFileSync(join(repo, 'supabase', '037_word_bank_moe_high.sql'), sqlFor('037', '고등 1000개', high.rows));
  writeFileSync(join(here, 'out', 'moe-high-review.csv'), csv(high.rows));
}

// 그림 대상(선택): 중·고등은 글자형이 기본이라 급하지 않다 — 그릴 수 있는 것만 모아 둔다.
const drawable = [...mid.rows, ...high.rows].filter((r) => r.kind !== 'none');
if (drawable.length) {
  const done = (id) => existsSync(join(repo, 'app', 'public', 'word-bank-images', `${id}.webp`));
  const label = { object: '사물', scene: '인물 장면', symbol: '도식·기호' };
  const sections = ['object', 'scene', 'symbol']
    .map((k) => {
      const list = drawable.filter((r) => r.kind === k);
      const lines = list.map((r) => `| \`${r.id}\` | ${r.word} | ${r.meaning} | ${r.scene} | ${r.example} | ${done(r.id) ? '완료' : ''} |`).join('\n');
      return `## ${label[k]} (${list.length}개)\n\n| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |\n|---|---|---|---|---|---|\n${lines}\n`;
    })
    .join('\n');
  const md = `# 교육부 필수 영단어 그림 제작 인계 (확장 2차: 중학·고등 중 그릴 수 있는 단어)

작성: Claude Code. 규격·화풍·그림 종류 설명은 \`CURSOR_IMAGE_HANDOFF.md\`와 \`CURSOR_IMAGE_HANDOFF_MOE.md\`를 그대로 따른다(글자·숫자 금지, 한 장에 뜻 하나, 밝고 안전하게).
중·고등 단어는 **글자형(단서 카드)이 기본**이라 이 그림은 급하지 않다 — 눈에 보이는 사물·장면만 골랐다. 대상 ${drawable.length}개 (중학 ${mid.rows.filter((r) => r.kind !== 'none').length} · 고등 ${high.rows.filter((r) => r.kind !== 'none').length}).

${sections}
## 다 만든 뒤

\`node app/scripts/vocab/make-image-url-sql.mjs\`로 image_url SQL을 만든다. "만들어졌나" 칸은 \`node app/scripts/vocab/build-moe-upper.mjs\`를 다시 돌리면 채워진다.
`;
  writeFileSync(join(repo, 'CURSOR_IMAGE_HANDOFF_MOE_UPPER.md'), md);
}
