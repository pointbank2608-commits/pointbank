// 교육부 초등 빠진 95개 → supabase/033_word_bank_moe_elementary.sql + CURSOR_IMAGE_HANDOFF_MOE.md
//   node app/scripts/vocab/build-moe-elem.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOE_ELEM } from './batch-moe-elem.mjs';
import { slug } from './image-targets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const KINDS = ['object', 'scene', 'symbol', 'none'];

const rows = MOE_ELEM.map(([word, pos, meaning, example, level, category, subcategory, kind, scene], i) => {
  if (!KINDS.includes(kind)) throw new Error(`${word}: 그림 종류 ${kind}`);
  if (kind !== 'none' && !scene) throw new Error(`${word}: 장면 힌트 없음`);
  return { id: slug(word), word, pos, meaning, example, level, category, subcategory, kind, scene, sort: 3000 + i };
});
const ids = new Set();
for (const r of rows) {
  if (ids.has(r.id)) throw new Error(`id 중복: ${r.id}`);
  ids.add(r.id);
}

const values = rows
  .map((r) => `  (${[q(r.id), q(r.word), 1, q(r.pos), q(r.meaning), q(r.example), q(r.category), "'{}'", q(r.subcategory), r.level, "'moe'", 'null', q(r.kind), r.sort].join(', ')})`)
  .join(',\n');

const sql = `-- 033. 교육부 2022 기본어휘 초등(*) 800개 중 사전에 없던 ${rows.length}개 + 그림 종류(image_kind) 칸.
-- image_kind: object 사물 / scene 인물 장면 / symbol 도식·기호 / none 그림을 만들지 않음(앱이 단서 카드로 보여 줌).
-- 기존 행은 null(= 예전처럼 그림이 있으면 그림). 024 다음에 실행. 여러 번 실행해도 안전(on conflict do nothing).
-- image_url 은 그림이 생긴 뒤 make-image-url-sql.mjs 로 따로 채운다.
-- app/scripts/vocab/build-moe-elem.mjs 로 생성(원본 데이터: batch-moe-elem.mjs).

alter table public.word_bank add column if not exists image_kind text
  check (image_kind is null or image_kind in ('object', 'scene', 'symbol', 'none'));

insert into public.word_bank
  (id, word, sense_number, part_of_speech, meaning, example_sentence, category, extra_categories, subcategory, level, origin, image_url, image_kind, sort_order)
values
${values}
on conflict (id) do nothing;
`;
writeFileSync(join(repo, 'supabase', '033_word_bank_moe_elementary.sql'), sql);

const KIND_LABEL = { object: '사물', scene: '인물 장면', symbol: '도식·기호' };
const done = (id) => existsSync(join(repo, 'app', 'public', 'word-bank-images', `${id}.webp`));
const need = rows.filter((r) => r.kind !== 'none');
const table = (kind) =>
  need
    .filter((r) => r.kind === kind)
    .map((r) => `| \`${r.id}\` | ${r.word} | ${r.meaning} | ${r.scene} | ${r.example} | ${done(r.id) ? '완료' : ''} |`)
    .join('\n');
const skipped = rows.filter((r) => r.kind === 'none').map((r) => `\`${r.word}\``).join(', ');

const md = `# 교육부 필수 영단어 그림 제작 인계 (확장 1차: 초등 빠진 단어)

작성: Claude Code (2026-09-28). 대상 폴더: \`app/public/word-bank-images/\`. 기존 인계서 \`CURSOR_IMAGE_HANDOFF.md\`의 **규격(화풍·크기·파일명·글자 금지)을 그대로 따른다.** 이 문서는 거기에 더해 "추상적인 단어를 어떻게 그릴지"와 이번 목록만 적는다.

앞으로 교육부 3000단어(중학 1200·고등 1000)까지 사전을 넓힌다. 같은 규칙으로 목록이 배치마다 이 문서 뒤에 붙는다.

## 그림 종류 4가지 (단어마다 이미 정해져 있음)

| 종류 | 뜻 | 그리는 법 |
|---|---|---|
| **사물** (object) | 눈에 보이는 물건·동물·장소 | 기존과 같다. 주제 하나를 가운데 크게 |
| **인물 장면** (scene) | 동작·감정·관계처럼 사람이 해야 보이는 뜻 | 기존 동작 그림(\`climb.webp\`)처럼 클레이 아이·어른이 그 뜻을 **한 장면**으로 보여 준다. 표정과 몸짓을 크게. 인물은 1~4명 |
| **도식·기호** (symbol) | 위치·방향·양·시간처럼 관계를 보여야 하는 뜻 | 같은 클레이 질감의 **단순한 모양**(화살표·막대·빈 상자·퍼즐 조각 등)으로. 사물 1~3개 + 모양 하나. 복잡한 그림 금지 |
| **그림 없음** (none) | 기능어·개념어처럼 그림으로 옮기면 오히려 헷갈리는 뜻 | **만들지 않는다.** 앱이 같은 크기의 "단서 카드"(뜻·예문)로 대신 보여 준다 |

### 공통 규칙 (추상 단어일수록 더 중요)
- **글자·숫자·기호 문자 금지는 그대로.** 말풍선·간판·달력 숫자·✓ 옆 글씨 모두 안 된다. ✓·화살표·음표 같은 **모양**은 괜찮다.
- **한 장에 뜻 하나**: 아이가 그림만 보고 그 단어를 떠올릴 수 있어야 한다. 헷갈리면 장면을 줄이고 핵심 몸짓 하나만 남긴다.
- **밝고 안전하게**: death·hunt·fail·worry처럼 무거운 뜻은 피·다침·우는 얼굴 없이 부드럽게(예: hunt는 몸을 낮춘 사자, fail은 무너진 블록 탑). death는 그림 없음으로 정했다.
- **도식 그림은 한 세트처럼**: 화살표·막대·상자 모양은 같은 색·굵기·질감으로 통일한다(뒤 배치에서 같은 모양을 여러 단어가 다시 쓴다).
- 표의 "장면"이 곧 지시다. "참고 문장"은 뜻 확인용일 뿐 그림에 쓰지 않는다.

## 이번 목록: ${need.length}개 (전체 ${rows.length}개 중 그림 없음 ${rows.length - need.length}개 제외)

그림 없음으로 정한 단어(만들지 말 것): ${skipped}

### 사물 (${need.filter((r) => r.kind === 'object').length}개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
${table('object')}

### 인물 장면 (${need.filter((r) => r.kind === 'scene').length}개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
${table('scene')}

### 도식·기호 (${need.filter((r) => r.kind === 'symbol').length}개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
${table('symbol')}

## 다 만든 뒤

\`node app/scripts/vocab/make-image-url-sql.mjs\`로 그림이 생긴 단어의 image_url SQL을 만든다(없는 단어는 그대로 둔다). SQL 실행과 배포는 사용자가 한다. 이 문서의 "만들어졌나" 칸은 \`node app/scripts/vocab/build-moe-elem.mjs\`를 다시 돌리면 채워진다.
`;
writeFileSync(join(repo, 'CURSOR_IMAGE_HANDOFF_MOE.md'), md);
console.log(`rows ${rows.length}, images ${need.length}`, Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.kind === k).length])));
