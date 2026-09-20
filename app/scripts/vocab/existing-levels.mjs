// 기존 사전 812단어(교육부 초등 필수)에 난이도 Level 1~4를 매겨 SQL로 뽑는다.
//   node app/scripts/vocab/existing-levels.mjs   →  supabase/021_word_bank_existing_levels.sql
//
// 기준(초안 — 선생님 검수용):
//   Lv.1 유치~초2   눈에 보이는 일상 사물·동물·색·가족·음식, 기초 동사/형용사, 인사, 기본 기능어
//   Lv.2 초3~4      장소·날씨·시간, 확장 동사/형용사, 기본 전치사·접속사
//   Lv.3 초5~6      추상 명사, 덜 흔한 동사/형용사, 관계가 복잡한 전치사
//   Lv.4 초등 확장   드물거나 추상적이고 뜻이 여러 갈래인 단어(중1 준비)
// 목록에 없는 단어는 전부 Lv.1. 다의어 행(band-1, band-2)은 단어 이름으로 함께 적용되고,
// 뜻마다 레벨이 다르면 "hard-2"처럼 id 전체를 적는다.

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const ids = readdirSync(join(repo, 'app', 'public', 'word-bank-images'))
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.slice(0, -'.webp'.length));

const words = (s) => s.split(/[\s,]+/).filter(Boolean);

const LV4 = words(`base capital case cassette course dial engine excuse fact fool gentle god handle hose kill lie-2 ma'am
  matter medal pardon service shall steam strange strike stupid switch temple till usual war`);

const LV3 = words(`address album along among band become below bench beside blow bridge bright build burn camp captain
  care ceiling center chance cheap chopstick church copy corner cover cross curtain danger dead deep dear die dish drop
  enough example excellent excite fair famous few field fight fill film fix free fresh gas gate ground group hall happen
  hard-2 hiking hill hole hurry idea ill ink interest into introduce island job join jungle just kind-2 knock lady land
  last lead lie-1 luck march-2 marry may-1 meter middle model narrow noise pair pass peace piece pin pine pipe plan poor
  post present-1 print problem real record return set sheet shoot shut sign sir smoke speed spend stove straight step
  storm supper sure than thick through tie travel true twice until waste way wonder yet`);

const LV2 = words(`about across act afraid age ago air airport any apartment around arrive as aunt autumn away bank basket
  bath beach beautiful because before begin behind bell between bicycle board bottle bowl break bring brush busy butter
  button buy calendar call camera candle cap carry catch chalk change circle city classmate clean climb clothes club coat
  coffee coin cook cool country cousin cream cut dark date daughter diary dictionary dirty dollar dolphin dream dress
  drive drum dry early earth east easy empty end enjoy every exercise fall-1 fall-2 far farm fat feel find fine finish
  fire flag floor fly follow forget fork front full garden get glad glass glove gold grass gray great grow guitar half
  hard-1 hate heavy hide high hit hold holiday hope hospital hotel hour hundred hurt if keep key kick kind-1 king
  kitchen knee knife lake lamp large late laugh leaf learn leave left lesson let letter library light line lip list live
  lose lot loud low mad mail map march-1 market may-2 meet million mirror mountain move Miss Mr Mrs much must near neck
  need news next north note nurse o'clock off office often oil once only other over page paint parent pay pick picnic
  pilot place plant pocket point police pool poster practice present-2 pretty pull push queen question quick quiet radio
  ready remember repeat rest restaurant ribbon rich ride right-1 right-2 ring river road rock rocket roll roof rose round
  safe same sand score season seat sell send shape shop shout show shower side silver size skate slide smell so soft son
  soon sound south space speak spell sport square stairs stamp station stay stick stone store street strong subway
  supermarket surprise sweater swing tape taste tea teach team telephone tell test then thin thing thousand throw ticket
  together tonight too top touch town trip try tulip turn uncle understand vacation vegetable village visit violin wake
  wall warm weak wear welcome well west wet which wide will win wing wood world wrong young`);

function levelFor(id) {
  const base = id.replace(/-\d+$/, '');
  for (const [level, list] of [[4, LV4], [3, LV3], [2, LV2]]) {
    if (list.includes(id) || list.includes(base)) return level;
  }
  return 1;
}

// 목록에 적은 단어가 실제 id와 하나도 안 맞으면 오타다 — 조용히 넘어가지 않고 알린다.
const idSet = new Set(ids);
const baseSet = new Set(ids.map((i) => i.replace(/-\d+$/, '')));
const unmatched = [...LV4, ...LV3, ...LV2].filter((w) => !idSet.has(w) && !baseSet.has(w));
if (unmatched.length) console.error('id와 안 맞는 단어:', unmatched.join(', '));

const byLevel = { 1: [], 2: [], 3: [], 4: [] };
for (const id of ids) byLevel[levelFor(id)].push(id);

const q = (s) => `'${s.replace(/'/g, "''")}'`;
const sql = [
  '-- 021. 기존 사전 812단어에 난이도(level) 1~4 채우기 (020_word_bank_levels.sql 다음에 실행).',
  '-- app/scripts/vocab/existing-levels.mjs 로 생성한 초안 — 기준은 그 파일 맨 위 주석 참고.',
  '-- 레벨을 바꾸고 싶은 단어는 이 파일을 고치지 말고 SQL Editor에서 update로 덮어써도 된다.',
  '',
  ...[1, 2, 3, 4].map(
    (lv) =>
      `update public.word_bank set level = ${lv} where id in (\n  ${byLevel[lv].map(q).join(', ')}\n);`,
  ),
  '',
].join('\n');

writeFileSync(join(repo, 'supabase', '021_word_bank_existing_levels.sql'), sql);
console.log(`ids ${ids.length} → Lv1 ${byLevel[1].length} / Lv2 ${byLevel[2].length} / Lv3 ${byLevel[3].length} / Lv4 ${byLevel[4].length}`);
