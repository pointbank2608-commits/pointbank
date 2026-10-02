// 비어 있는 그림 자리를 전부 채우기 위한 커서 안내서 → CURSOR_IMAGE_HANDOFF_FILL_ALL.md (2026-10-02)
//   node app/scripts/vocab/build-image-fill-all.mjs
// 대상: 그림 파일이 없는 모든 사전 단어(초등 추상어 · 숙어·표현 · 중학 · 고등) + 다시 만들 그림(사과·글자·나무 타는 아이가 잘못 들어간 것).
// 다시 돌리면 "만들어졌나" 칸이 채워진다(다시 만들 그림은 파일이 이미 있으므로 칸을 비워 둔다).
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDIOM_TARGETS, MOE_ELEM_NONE_TARGETS, MOE_HIGH_TARGETS, MOE_MID_TARGETS } from './image-targets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const has = (id) => existsSync(join(repo, 'app', 'public', 'word-bank-images', `${id}.webp`));

// 그리지 않는 단어(아이들 화면에 올리기 어려운 뜻) — 빈 자리로 둔다.
const SKIP = new Set(['death', 'suicide', 'murder', 'torture', 'abuse', 'terror']);
// 무겁거나 위험한 뜻은 장면을 정해 준다(부드럽게, 다치는 모습·피·사람을 겨누는 무기 없이).
const SAFE = {
  gun: '장난감 물총 하나(사람 없이, 누구도 겨누지 않게)',
  weapon: '박물관 유리장 안의 옛 칼과 방패(사람 없이)',
  bomb: '만화처럼 둥근 검은 폭탄과 짧은 심지(터지지 않은 모습, 사람 없이)',
  blast: '밤하늘에 터지는 불꽃놀이',
  explode: '밤하늘에 터지는 불꽃놀이 폭죽',
  alcohol: '뚜껑 닫힌 병과 빈 유리잔(라벨 글자 없이, 사람 없이)',
  pub: '나무 간판이 달린 작은 가게 앞모습(간판 글자 없이)',
  cigarette: '담배 한 개비 위에 빨간 금지 사선이 그어진 둥근 표지(글자 없이)',
  drug: '약병과 알약 몇 알',
  addict: '주변에 장난감이 있어도 게임기 화면에서 눈을 못 떼는 아이',
  naked: '거품 가득한 욕조에서 어깨까지 잠겨 웃는 아기',
  bare: '모래밭 위 맨발 두 개',
  drown: '수영장에서 구명 튜브를 던져 주는 안전요원(위험한 모습 없이)',
  victim: '넘어진 아이를 다른 아이가 일으켜 주는 장면',
  poison: '보라색 액체가 든 병에 빨간 X 모양 표시(해골·글자 없이)',
  toxic: '초록 연기가 나는 통과 빨간 X 모양 표시(해골·글자 없이)',
  prison: '창살이 있는 빈 방(사람 없이)',
  jail: '창살문이 달린 빈 방과 열쇠 꾸러미(사람 없이)',
  gamble: '주사위 두 개와 카드 몇 장(숫자·글자 없이 무늬만)',
  crime: '창문으로 들어가려는 복면 도둑과 손전등을 비추는 경찰(우스꽝스럽게)',
  violent: '거센 파도와 번개가 치는 폭풍우 바다(사람 없이)',
  punish: '벽을 보고 서서 반성하는 아이와 팔짱 낀 어른(무섭지 않게)',
  penalty: '축구 심판이 노란 카드를 들어 보이는 장면',
  surgery: '수술복과 마스크를 쓴 의사 두 명이 수술등 아래 서 있는 장면(환자·피 없이)',
  operate: '아이가 버튼을 눌러 기계를 작동시키는 장면',
  mortal: '시든 꽃과 옆에서 새로 돋는 새싹',
  harm: '뜨거운 냄비에 손을 대려는 아이를 어른이 막는 장면',
  damage: '찌그러진 장난감 자동차',
  smash: '바닥에 떨어져 깨진 접시(사람 없이)',
  survive: '무인도에서 작은 불을 피우고 손을 흔드는 아이',
  severe: '눈보라 속에서 옷깃을 여미고 걷는 아이',
  evacuate: '아이들이 선생님을 따라 줄지어 건물 밖으로 나가는 장면',
};

// ── 다시 만들 그림(지금 파일이 있지만 잘못된 것) ─────────────────
const REDO_APPLE = [
  ['comic', '만화책', '펼친 만화책(칸마다 우주선·강아지·로봇 같은 서로 다른 그림, 글자 없이)'],
  ['blanket', '담요', '개어 놓은 체크무늬 담요 하나'],
  ['shelf', '선반', '벽 선반 위에 책 몇 권과 작은 화분'],
  ['workbook', '문제집', '연필이 놓인 펼친 문제집(줄과 빈칸 모양만, 글자·사과 없이)'],
  ['sentence', '문장', '낱말 카드 여러 장이 한 줄로 이어져 있고 끝에 둥근 점 카드(카드 안은 단순한 색 블록, 글자 없이)'],
  ['smaller', '더 작은', '큰 곰 인형 옆의 작은 곰 인형(작은 쪽을 밝게)'],
  ['laptop', '노트북', '열려 있는 노트북(화면은 하늘과 언덕 풍경)'],
  ['screen', '화면', '모니터 화면에 산과 해가 보이는 풍경'],
  ['living-thing', '생물', '새·물고기·꽃·나비가 함께 있는 모습'],
  ['underline', '밑줄을 긋다', '아이가 자를 대고 공책의 줄 아래에 연필로 선을 긋는 장면'],
  ['lemon', '레몬', '끝이 뾰족한 타원형 노란 레몬과 반으로 자른 단면(사과 꼭지·잎 없이)'],
  ['mango', '망고', '타원형 노랑·주황 망고와 격자로 칼집 낸 망고 조각(사과 꼭지·잎 없이)'],
  ['pumpkin', '호박', '골이 깊게 진 주황 호박과 굵은 초록 꼭지(사과 잎 없이)'],
  ['onion', '양파', '갈색 껍질 양파와 반으로 자른 겹겹 단면(사과 꼭지·잎 없이)'],
];
const REDO_TEXT = [
  ['bookstore', '서점', '진열창에 책이 가득한 가게(간판은 책 모양 그림, 글자 없이)'],
  ['freezer', '냉동고', '문이 열린 냉동고 안에 얼음과 아이스크림(글자 없이)'],
  ['fever', '열', '이마에 물수건을 얹고 볼이 빨간 아이와 체온계(눈금 숫자·글자 없이)'],
  ['sore-throat', '목이 아픔', '목에 목도리를 두르고 목을 만지며 찡그린 아이(글자 없이)'],
  ['shorter', '더 짧은·작은', '긴 연필과 짧은 연필이 나란히(짧은 쪽을 밝게, 글자 없이)'],
  ['sometimes', '가끔', '일곱 칸 중 두 칸에만 별 스티커가 붙은 빈 주간표(글자·숫자 없이)'],
  ['bookshelf', '책장', '색색의 책이 꽂힌 나무 책장(책등 글자 없이)'],
  ['click', '클릭하다', '아이가 마우스를 누르고 화면에 화살표 커서와 반짝임(글자 없이)'],
  ['school-bus', '스쿨버스', '창문으로 아이들이 손 흔드는 노란 버스(옆면 글자 없이)'],
  ['ambulance', '구급차', '빨간 십자 표시와 경광등이 있는 흰 구급차(글자 없이)'],
  ['fire-engine', '소방차', '사다리와 호스가 달린 빨간 소방차(글자·숫자 없이)'],
  ['title', '제목', '표지 위쪽에 넓은 색 띠가 있고 그 띠가 반짝이며 강조된 책(글자 없이, 띠 자리가 제목임을 화살표 모양으로)'],
  ['event', '행사', '풍선과 깃발 장식 아래 아이들이 모인 행사장(케이크·현수막 글자 없이)'],
  ['chapter', '장(책의)', '색깔 띠지로 여러 묶음이 나뉜 두꺼운 책(숫자·글자 없이)'],
  ['height', '키', '벽의 눈금 막대 앞에 서서 키를 재는 아이(눈금은 줄만, 숫자 없이)'],
];
const REDO_CLIMB = [
  ['nod', '고개를 끄덕이다', '아이가 웃으며 고개를 아래로 끄덕이는 모습(머리 위아래 움직임 선)'],
  ['blond', '금발의', '밝은 금발 머리 남자아이 얼굴과 상반신'],
  ['serious', '진지한', '입을 다물고 눈썹을 모은 채 책상에서 집중하는 아이'],
  ['november', '11월', '낙엽이 거의 다 떨어진 나무 아래에서 목도리를 두르고 낙엽을 쓸어 모으는 아이'],
  ['snowy', '눈이 오는', '눈이 펑펑 내리는 마을과 눈 쌓인 지붕'],
  ['humid', '습한', '땀을 흘리며 부채질하는 아이와 김 서린 창문'],
  ['freezing', '몹시 추운', '두꺼운 외투를 입고 덜덜 떠는 아이와 고드름'],
  ['actor', '배우', '무대 조명 아래에서 의상을 입고 연기하는 아이'],
];
const NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

for (const [id] of [...REDO_APPLE, ...REDO_TEXT, ...REDO_CLIMB]) if (!has(id)) throw new Error(`다시 만들 그림인데 파일이 없음: ${id}`);

// ── 새로 만들 그림 ────────────────────────────────────────────
const todo = (rows) => rows.filter((r) => !SKIP.has(r.id));
const sceneOf = (r) => SAFE[r.id] ?? r.scene ?? '';
const table = (rows) =>
  '| id | 단어 | 품사 | 뜻 | 장면(비어 있으면 참고 문장을 그대로 한 장면으로) | 참고 문장 | 만들어졌나 |\n|---|---|---|---|---|---|---|\n' +
  rows.map((r) => `| \`${r.id}\` | ${r.word} | ${r.pos} | ${r.meaning} | ${sceneOf(r)} | ${r.example} | ${has(r.id) ? '완료' : ''} |`).join('\n') +
  '\n';
const redoTable = (rows) =>
  '| id | 뜻 | 이렇게 다시 |\n|---|---|---|\n' + rows.map(([id, meaning, scene]) => `| \`${id}\` | ${meaning} | ${scene} |`).join('\n') + '\n';

const upper = [...MOE_MID_TARGETS, ...MOE_HIGH_TARGETS];
const groups = [
  ['2. 중학·고등 — 눈에 보이는 사물·장면', todo(upper.filter((r) => r.kind !== 'none')), '장면이 이미 적혀 있다. 그대로 그린다.'],
  ['3. 초등 추상어', todo(MOE_ELEM_NONE_TARGETS), '초등 단어라 가장 쉽고 귀엽게.'],
  ['4. 숙어·표현', todo(IDIOM_TARGETS), '표현을 쓰는 상황을 아이들 장면으로.'],
  ['5. 중학 추상어 (Lv.5)', todo(MOE_MID_TARGETS.filter((r) => r.kind === 'none')), ''],
  ['6. 고등 추상어 (Lv.6)', todo(MOE_HIGH_TARGETS.filter((r) => r.kind === 'none')), ''],
];
const left = (rows) => rows.filter((r) => !has(r.id)).length;
const totalNew = groups.reduce((n, [, rows]) => n + rows.length, 0);
const totalLeft = groups.reduce((n, [, rows]) => n + left(rows), 0);
const redoCount = REDO_APPLE.length + REDO_TEXT.length + REDO_CLIMB.length;

const md = `# 단어 사전 그림 — 비어 있는 자리 전부 채우기

작성: Claude Code (2026-10-02). 대상 폴더: \`app/public/word-bank-images/\`.
이 문서 하나만 보면 된다(예전 \`CURSOR_IMAGE_HANDOFF*.md\`의 규격을 여기에 다시 적었고, **이 문서가 우선**이다).

- 다시 만들 그림: **${redoCount}장** (+ 숫자 ${NUMBERS.length}장은 사용자에게 물어본 뒤)
- 새로 만들 그림: **${totalNew}장** (남은 ${totalLeft}장)
- 그리지 않는 단어: ${[...SKIP].map((s) => `\`${s}\``).join(', ')} — 빈 자리로 둔다.

## 가장 중요한 규칙: 사과로 만들지 않는다

지난 작업에서 화풍 참고로 준 \`apple.webp\`의 **모양까지** 따라가서, 사과와 상관없는 단어가 사과 모양·사과 색·사과 꼭지와 잎을 달고 나왔다(망원경에 잎이 달리거나, 나라·뿌리가 사과 안에 들어가는 식). 같은 이유로 \`climb.webp\`(나무를 타는 아이)의 장면이 엉뚱한 단어에 그대로 들어가기도 했다.

1. **\`apple.webp\`를 참고 이미지로 넣지 않는다.** 참고 그림은 아래 "화풍 참고"에 적힌 두 장만, 사람이 나오는 그림에만 붙인다. 사물이 있는 그림(의자·버스·시계·가방·돌고래 등)을 참고로 주면 그 물건이 엉뚱한 단어에 끼어든다(실제로 그랬다).
2. 참고 그림에서 가져올 것은 **질감·조명·색감·배경 처리뿐**이다. 모양, 구도, 등장하는 물건·인물의 자세는 가져오지 않는다.
3. 단어의 뜻이나 참고 문장에 사과가 **실제로 나올 때만** 사과를 그린다. 그 밖의 그림에는 사과, 빨갛고 둥근 과일 모양 몸통, 과일 꼭지, 꼭지 옆 초록 잎을 넣지 않는다. 소품으로도 넣지 않는다(책상 위, 선반 위, 화면 속, 책 속 그림 등).
4. 수를 보여 줄 때는 사과 대신 공·블록·별·단추 등 단어마다 다른 물건을 쓴다.
5. 나무를 타는 아이는 \`climb\`에만 나온다. 다른 단어에 나무 타는 장면을 넣지 않는다.
6. 프롬프트마다 이 문장을 붙인다: \`no apple, no apple shape, no fruit stem, no leaf on top, do not copy the composition of the reference image\`.
7. 한 묶음(50장)을 만들 때마다 썸네일을 모아 훑어본다. 사과·사과 잎·나무 타는 아이가 보이거나 글자가 박혀 있으면 그 자리에서 다시 만든다.

## 규격

- **화풍**: 점토(클레이) 3D 질감, 머리가 크고 통통한 3등신 인물(어른도 같은 비율로 조금 클 뿐), 밝고 따뜻한 파스텔 단색 배경.
- **화풍 참고**: 사람이 나오는 그림에만 \`lean.webp\`·\`muscle.webp\`(아이 한 명만 서 있어 베낄 물건이 없다) — 인물 비율·얼굴·점토 질감·배경 색감만 가져오고 자세·옷·머리는 장면에 맞게. 사물·풍경 그림은 참고 없이 글로만: \`chunky plasticine clay figures, big round head about half of body height, short arms and legs, toddler-like proportions, big round black eyes, rosy cheeks, soft matte clay texture, plain warm pastel background, soft lighting\`. 참고를 아예 빼면 인물이 키 큰 5~6등신으로 바뀐다(실제로 그랬다).
- **색**: 사물은 선명하고 다양한 색으로(베이지 한 가지로 칠하지 않는다). 배경은 크림·살구·연노랑·연두·연하늘색을 번갈아, 진한 색은 쓰지 않는다.
- **크기·형식**: 1024×1024 정사각 WebP, 장당 약 100~150KB.
- **파일명**: 표의 \`id\` 그대로 \`<id>.webp\`. 표에 없는 이름은 쓰지 않는다(사전과 연결이 안 된다).
- **글자·숫자·로고·말풍선 금지.** 간판, 책 표지, 화면, 옷, 차 옆면, 달력, 눈금 모두 글자 없이. 줄·색 띠·그림 모양으로 대신한다. ✓, 화살표, 음표, 하트 같은 **모양**은 괜찮다.
- **한 장에 뜻 하나**: 주제를 가운데 크게. 배경은 단순하게(같은 들판·구름 배경을 모든 그림에 반복하지 않는다).
- **인물**: 클레이 아이·어른 1~4명. 표정과 몸짓을 크게. 여러 아이가 고루 나오게(남자아이 한 명만 반복하지 않는다).
- **밝고 안전하게**: 피, 다친 모습, 우는 얼굴 클로즈업, 사람을 겨누는 무기, 술 마시는 모습, 담배 피우는 모습을 그리지 않는다. 무거운 뜻은 표의 "장면"에 적어 둔 대로만 그린다.

## 추상어를 그리는 법 (장면 칸이 비어 있는 단어)

중학·고등 단어 대부분은 눈에 보이는 물건이 아니다. 이렇게 한다.

1. **참고 문장을 그대로 한 장면으로 그린다.** 예: \`able\` "She is able to speak three languages." → 세 나라 아이와 번갈아 이야기하며 웃는 여자아이.
2. 그 장면 안에서 **그 단어의 뜻이 가장 크게 보이게** 한다. 동사는 그 동작을 하는 순간, 형용사는 그 상태가 과장되게, 명사는 그 대상이 가운데.
3. 문장이 그림으로 옮기기 어려우면 뜻을 보여 주는 **더 쉬운 일상 장면**으로 바꿔도 된다(학교, 집, 놀이터, 가게). 문장을 글자로 쓰지는 않는다.
4. 접속사·전치사·조동사처럼 뜻만으로는 그림이 안 되는 낱말도 참고 문장의 장면을 그린다. 화살표·점선 같은 단순한 모양을 하나 곁들여도 된다.
5. 뜻이 비슷한 단어끼리 같은 그림이 되지 않게, 참고 문장의 구체적인 물건·장소를 살린다.

## 하지 말 것

- 아래 "1. 다시 만들 그림"에 없는 기존 그림은 건드리지 않는다.
- 코드, SQL, 번역 문구는 고치지 않는다. 그림 파일만 추가·교체한다.
- 커밋·푸시·배포는 하지 않는다(사용자가 Claude Code에 요청한다).

## 순서

1번부터 차례로. 한 번에 50장씩 만들고, 묶음이 끝날 때마다 몇 장 했는지와 건너뛴 단어를 알려 준다.
\`node app/scripts/vocab/build-image-fill-all.mjs\`를 다시 돌리면 "만들어졌나" 칸이 채워져 남은 것을 볼 수 있다.

## 1. 다시 만들 그림 (${redoCount}장 — 같은 파일 이름으로 덮어쓴다)

### 1-1. 사과가 끼어든 그림 (${REDO_APPLE.length}장)

${redoTable(REDO_APPLE)}
### 1-2. 글자·숫자가 박힌 그림 (${REDO_TEXT.length}장)

${redoTable(REDO_TEXT)}
### 1-3. 나무 타는 아이가 엉뚱하게 들어간 그림 (${REDO_CLIMB.length}장)

${redoTable(REDO_CLIMB)}
### 1-4. 숫자 ${NUMBERS.length}장 — 사용자에게 먼저 물어볼 것

${NUMBERS.map((n) => `\`${n}\``).join(' ')}

지금은 전부 사과 개수로 그려져 있다(예전 안내서가 그렇게 시켰다). 사용자가 바꾸자고 하면 단어마다 다른 물건(공, 블록, 별, 단추, 구슬, 연필, 조개 등)으로 다시 만든다. 큰 수(thirty~ninety)는 열 개씩 묶은 블록 줄로. 숫자 글자는 넣지 않는다.

${groups
  .map(([title, rows, note]) => `## ${title} (${rows.length}장, 남은 ${left(rows)}장)\n\n${note ? note + '\n\n' : ''}${table(rows)}`)
  .join('\n')}
## 다 만든 뒤

\`node app/scripts/vocab/make-image-url-sql.mjs\`를 돌리면 그림 파일이 생긴 단어만 골라 \`supabase/023_word_bank_new_image_urls.sql\`이 만들어진다. 그 SQL 실행과 배포는 사용자가 한다(다시 만든 그림은 주소가 그대로라 SQL이 필요 없다).
`;

writeFileSync(join(repo, 'CURSOR_IMAGE_HANDOFF_FILL_ALL.md'), md);
console.log(`다시 ${redoCount} (+숫자 ${NUMBERS.length}) · 새로 ${totalNew} (남은 ${totalLeft}) · 건너뜀 ${[...SKIP].length}`);
for (const [title, rows] of groups) console.log(`  ${title}: ${rows.length}`);
const unusedSafe = Object.keys(SAFE).filter((id) => !groups.some(([, rows]) => rows.some((r) => r.id === id)));
if (unusedSafe.length) console.log('  SAFE에만 있는 id:', unusedSafe.join(', '));
