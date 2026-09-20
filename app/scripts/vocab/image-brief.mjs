// 커서(이미지 담당)에게 넘기는 인계 문서 생성.
//   node app/scripts/vocab/image-brief.mjs   →  CURSOR_IMAGE_HANDOFF.md (저장소 루트)
// 새 단어 배치가 생기면 pilot-new-words.mjs 처럼 목록을 추가하고 이 스크립트를 다시 돌린다.

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TARGETS, BATCH2_TARGETS, PILOT_TARGETS } from './image-targets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const imgDir = join(repo, 'app', 'public', 'word-bank-images');
const have = new Set(readdirSync(imgDir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));


// 그림으로 옮길 때 뜻이 헷갈리는 두 번째 뜻 행은 장면을 직접 지정한다.
const SCENE = {
  'fly-2': '곤충 "파리" 한 마리(날아다니는 벌레). 동사 fly(날다) 그림과 달라야 함',
  'chicken-2': '접시에 담긴 구운/튀긴 닭고기 요리(살아 있는 닭 아님)',
  'fish-2': '접시에 담긴 구운 생선 요리(살아 있는 물고기 아님)',
  'color-2': '아이가 크레용으로 그림에 색칠하는 장면(색깔 팔레트 그림 아님)',
  'dress-2': '아이가 스스로 옷을 입고 있는 장면(드레스 그림 아님)',
  'brush-2': '아이가 칫솔로 이를 닦는 장면',
  'point-2': '아이가 손가락으로 무언가를 가리키는 장면',
  'plant-2': '아이가 모종/씨앗을 흙에 심는 장면(다 자란 식물 그림 아님)',
  'rest-2': '아이가 편안히 쉬는 장면(의자·소파에 앉아 쉼)',
  'practice-2': '아이가 악기나 운동을 연습하는 장면',
  'empty-2': '아이가 가방/통을 뒤집어 비우는 장면',
  kiss: '아이가 아기 동생 볼에 뽀뽀하거나 손키스를 보내는 장면(입술 뽀뽀 X)',
  hug: '아이와 엄마가 서로 꼭 껴안는 장면',
  'cold-2': '아이가 콧물을 훌쩍이며 담요를 두르고 체온계를 물고 있는 감기 걸린 장면',
  'back-2': '클레이 아이가 뒤돌아서 등을 보이는 장면',
  'cool-2': '선글라스를 쓰고 엄지를 세운 멋진 클레이 아이',
  'light-2': '깃털처럼 가벼운 가방을 한 손으로 드는 장면',
  'watch-2': '손목시계 하나를 중심에',
  'bat-2': '거꾸로 매달린 박쥐 한 마리',
  'mouse-2': '컴퓨터 마우스 하나를 중심에(쥐 동물 그림 아님)',
  'free-2': '선물처럼 가게 진열대에서 그냥 가져가라며 건네는 장면(글자 없이)',
  'open-2': '문이 활짝 열린 가게 하나(글자 없이)',
  'change-2': '손바닥 위의 동전 몇 개(거스름돈)',
  'circle-2': '아이가 책의 그림 하나에 동그라미를 그리는 장면',
  'tie-2': '넥타이 하나를 중심에',
  'turkey-2': '튀르키예를 상징하는 열기구 여러 개가 뜬 풍경(국기·글자 없이)',
  bow: '아이가 선생님께 허리 숙여 인사하는 장면',
};

const lines = [];
lines.push('# 클래스뱅크 단어 사전 이미지 제작 인계');
lines.push('');
lines.push('작성: Claude Code. 대상: `app/public/word-bank-images/`. 커밋·푸시·배포는 하지 않았고 이 문서의 이미지 제작 후 사용자가 Claude Code에 커밋/배포를 요청한다.');
lines.push('');
lines.push('## 무엇을 만드나');
lines.push('');
const todo = ALL_TARGETS.filter((r) => !have.has(r.id));
lines.push(`사전에 새로 들어가는 단어의 그림. 전체 ${ALL_TARGETS.length}개 중 **아직 없는 ${todo.length}개**를 만든다(시범 배치 ${PILOT_TARGETS.length}개 + 확장 배치 ${BATCH2_TARGETS.filter((r) => r.pos !== '숙어' && r.pos !== '표현').length}개, 숙어·표현은 그림이 필요 없다). 기존 812개(\`apple.webp\`, \`dolphin.webp\`, \`climb.webp\` 등)와 **같은 화풍**이어야 한다.`);
lines.push('');
lines.push('**권장 순서**: 위에서부터 카테고리 단위로. 그림으로 옮기기 어려운 추상 단어(서수, 배수, 의문사 등)는 마지막에 하거나, 정말 어려우면 건너뛰어도 된다(파일이 없는 단어는 이미지 없이 글자 카드로 정상 동작한다). 표의 "만들어졌나"에 `완료`가 있으면 이미 있는 것이니 다시 만들지 않는다.');
lines.push('');
lines.push('**특수 규칙**: 숫자(one~ninety)는 숫자 글자 없이 그 수만큼의 클레이 사과/공 등을 보여준다. 서수(first~tenth)는 줄 선 아이들 중 N번째 아이만 눈에 띄게(글자 없이). 요일·월·명절은 글자·달력 숫자 없이 계절/대표 활동으로 상징한다. 나라(Korea 등)는 그 나라의 대표 랜드마크·풍경(국기 무늬는 OK, 글자는 X). 언어 이름(Korean 등)은 그 나라 아이가 인사하는 장면.');
lines.push('');
lines.push('## 규격 (반드시 지킬 것)');
lines.push('');
lines.push('- **화풍**: 점토(클레이/플라스티신) 3D 질감, 둥글고 귀여운 형태, 밝은 파스텔 배경. 기존 `dolphin.webp`(동물), `apple.webp`(사물), `climb.webp`(동작: 클레이 남자아이)를 먼저 열어 보고 맞출 것.');
lines.push('- **크기·형식**: 1024×1024 정사각 WebP, 장당 약 100~150KB(기존과 동일).');
lines.push('- **파일명**: 아래 표의 `id` 그대로 `<id>.webp` (예: `puppy.webp`, `hot-dog.webp`, `fly-2.webp`). 이 규칙이 곧 DB의 이미지 경로다.');
lines.push('- **그림 안에 글자·숫자·로고·말풍선을 절대 넣지 않는다.** (AI 이미지에 박힌 글자, 특히 한글이 깨지는 문제를 피하기 위함. 순수 일러스트만.)');
lines.push('- **한 장에 주제 하나**: 단어의 뜻이 한눈에 보이게. 배경은 단순하게, 주제가 화면 중앙에 크게.');
lines.push('- **동사**는 기존 동작 그림처럼 클레이 남자아이/여자아이가 그 동작을 하는 장면. 아이가 나오는 그림은 밝고 안전하게(폭력·위험한 장면 X).');
lines.push('- 아래 "참고 문장"은 장면 힌트일 뿐이다. 문장을 그림에 쓰지 말 것.');
lines.push('');
lines.push('## 하지 말 것');
lines.push('');
lines.push('- 기존 812개 이미지 파일 수정/덮어쓰기 금지. 코드, DB(SQL), i18n 수정 금지 — 이미지 파일 추가만.');
lines.push('- id가 표에 없는 파일 이름 사용 금지(사전과 연결이 안 된다).');
lines.push('');
lines.push('## 다 만든 뒤');
lines.push('');
lines.push('`node app/scripts/vocab/make-image-url-sql.mjs` 를 실행하면 새 이미지가 있는 단어만 골라 `supabase/023_word_bank_new_image_urls.sql` 이 만들어진다(파일이 없는 단어는 이미지가 없는 채로 두어야 이미지 퀴즈 등에서 깨진 그림이 안 나온다). 그 SQL 실행과 배포는 사용자가 한다.');
lines.push('');

const byCat = new Map();
for (const r of ALL_TARGETS) {
  if (!byCat.has(r.category)) byCat.set(r.category, []);
  byCat.get(r.category).push(r);
}
for (const [category, list] of byCat) {
  const pending = list.filter((r) => !have.has(r.id)).length;
  lines.push(`## ${category} (${list.length}개, 남은 ${pending}개)`);
  lines.push('');
  lines.push('| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |');
  lines.push('|---|---|---|---|---|---|');
  for (const { id, word, pos, meaning, example } of list) {
    const scene = SCENE[id] ?? SCENE[word] ?? (pos === '동사' ? `클레이 아이가 "${meaning}" 동작을 하는 장면` : `${meaning} 하나를 중심에`);
    lines.push(`| \`${id}\` | ${word} | ${meaning} | ${scene} | ${example} | ${have.has(id) ? '완료' : ''} |`);
  }
  lines.push('');
}

writeFileSync(join(repo, 'CURSOR_IMAGE_HANDOFF.md'), lines.join('\n'));
console.log('CURSOR_IMAGE_HANDOFF.md 생성');
