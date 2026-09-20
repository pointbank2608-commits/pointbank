// 색칠 워크시트용 선화(윤곽선 그림)를 만들 단어 — 유치~초등 저학년이 색칠하기 좋은 구체적인 명사만 골랐다.
// 클레이 그림이 이미 있는 단어라서 커서가 같은 대상을 같은 구도로 선화로 옮기면 된다.
//   node app/scripts/vocab/lineart-words.mjs  →  CURSOR_LINEART_HANDOFF.md
// 목록은 카테고리 단위로 자유롭게 늘리거나 줄여도 된다(같은 단어가 여러 카테고리에 있으면 한 번만 만든다).

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const w = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export const LINEART_WORDS = {
  동물: w(`dog, cat, rabbit, mouse, bear, monkey, lion, tiger, elephant, giraffe, zebra, horse, cow, pig, sheep, duck, chicken,
    bird, frog, turtle, fish, whale, dolphin, shark, octopus, crab, butterfly, bee, penguin, panda, snake, owl`),
  음식: w(`apple, banana, orange, grape, strawberry, watermelon, pineapple, lemon, cherry, peach, carrot, tomato, potato, corn,
    broccoli, mushroom, egg, bread, pizza, hamburger, hot dog, sandwich, cake, cookie, ice cream, candy, milk, juice, rice, cheese`),
  몸: w(`body, head, eye, ear, nose, mouth, hand, finger, arm, leg, foot, hair, tooth, knee, shoulder, heart`),
  옷: w(`shirt, pants, skirt, dress, jacket, coat, hat, cap, socks, shoes, boots, gloves, scarf, umbrella, backpack, glasses`),
  장소: w(`school, hospital, library, park, bank, zoo, farm, restaurant, supermarket, airport, museum, church, bridge`),
  '학교/문구': w(`pencil, pen, eraser, ruler, scissors, glue, crayon, notebook, book, desk, chair, clock, computer`),
  '집/가구': w(`house, door, window, bed, table, sofa, lamp, mirror, refrigerator, television, cup, plate, bowl, spoon, fork, knife, toothbrush, towel`),
  교통: w(`car, bus, taxi, truck, train, bicycle, motorcycle, plane, helicopter, ship, boat, rocket, traffic light`),
  장난감: w(`ball, doll, teddy bear, robot, block, kite, balloon, yo-yo, skateboard, dice, jump rope, scooter`),
  직업: w(`doctor, nurse, teacher, police officer, firefighter, farmer, chef, pilot, singer, dancer, artist, baker`),
  '자연/날씨': w(`sun, moon, star, cloud, rain, snow, wind, rainbow, mountain, river, sea, beach, tree, flower, leaf, rock, fire, snowflake, lightning`),
  스포츠: w(`soccer, baseball, basketball, volleyball, tennis, badminton, golf, swimming, skiing, bowling, bat, racket, glove`),
  음악: w(`piano, guitar, violin, drum, flute, trumpet, recorder, bell, microphone, xylophone, harmonica`),
  우주: w(`earth, planet, spaceship, astronaut, alien, telescope, satellite`),
  '사람/가족': w(`baby, boy, girl, man, woman, mom, dad, brother, sister, grandma, grandpa, family, friend`),
};

/**
 * 색칠 페이지를 코드로 조립할 때 쓰는 장식 부품(주제별). "id: 설명" 형식이고, 파일은
 * app/public/word-bank-lineart/decor/<id>.webp. 단어 선화와 같은 규격(흰 배경, 굵은 검정 선, 닫힌 칸).
 */
export const DECOR_SETS = {
  공통: {
    'decor-sun': '웃는 얼굴 없이 둥근 해와 짧은 햇살',
    'decor-cloud': '몽글몽글한 구름 한 덩이',
    'decor-grass': '풀 무더기(작은 풀잎 3~5개)',
    'decor-flower': '꽃 한 송이(줄기와 잎 포함)',
    'decor-star': '별 하나',
    'decor-heart': '하트 하나',
  },
  농장: {
    'decor-barn': '헛간(지붕과 X자 문)',
    'decor-fence': '나무 울타리 한 토막',
    'decor-haystack': '건초더미',
    'decor-tractor': '트랙터',
    'decor-pond': '작은 연못과 갈대',
  },
  바다: {
    'decor-waves': '물결 무늬 3줄',
    'decor-bubbles': '물방울 여러 개',
    'decor-seaweed': '해초 두세 가닥',
    'decor-seashell': '조개껍데기',
    'decor-coral': '산호',
    'decor-sailboat': '돛단배',
  },
  숲: {
    'decor-bush': '덤불',
    'decor-log': '쓰러진 통나무',
    'decor-vine': '덩굴과 잎',
    'decor-rocks': '돌멩이 몇 개',
    'decor-stump': '나무 그루터기',
  },
  우주: {
    'decor-comet': '꼬리 있는 혜성',
    'decor-planet-ring': '고리가 있는 행성',
    'decor-stars': '작은 별 여러 개',
    'decor-ufo': '접시 모양 우주선',
    'decor-crater': '분화구 있는 달 표면',
  },
  마을: {
    'decor-road': '구불구불한 길 한 토막',
    'decor-cone': '삼각 표지 콘',
    'decor-streetlight': '가로등',
    'decor-building': '건물 한 채(창문 몇 개)',
    'decor-hydrant': '소화전',
  },
  소풍: {
    'decor-blanket': '체크무늬 돗자리(무늬는 굵은 선으로 단순하게)',
    'decor-picnic-basket': '소풍 바구니',
    'decor-pot': '냄비',
    'decor-tray': '쟁반',
  },
  학교: {
    'decor-blackboard': '글자 없는 칠판(틀만)',
    'decor-bookshelf': '책이 꽂힌 책장',
    'decor-globe': '지구본',
    'decor-school-bell': '종',
  },
  집: {
    'decor-rug': '동그란 러그',
    'decor-potted-plant': '화분',
    'decor-curtains': '커튼이 달린 창문',
    'decor-photo-frame': '빈 액자',
    'decor-fireplace': '벽난로',
  },
  운동장: {
    'decor-soccer-goal': '축구 골대와 그물',
    'decor-slide': '미끄럼틀',
    'decor-swing': '그네',
    'decor-seesaw': '시소',
    'decor-hoop': '농구 골대',
  },
  파티: {
    'decor-party-hat': '고깔모자',
    'decor-gift': '리본 달린 선물 상자',
    'decor-bunting': '삼각 깃발 줄(깃발에 글자 없음)',
    'decor-confetti': '색종이 조각 흩날림',
  },
  계절: {
    'decor-snow-pile': '눈 쌓인 언덕',
    'decor-raindrops': '빗방울',
    'decor-autumn-leaves': '낙엽 몇 장',
    'decor-sunflower': '해바라기',
    'decor-blossoms': '벚꽃 가지',
  },
};

export function decorTargets() {
  return Object.entries(DECOR_SETS).flatMap(([theme, items]) =>
    Object.entries(items).map(([id, desc]) => ({ theme, id, desc })),
  );
}

const slug = (word) => word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function lineartTargets() {
  const seen = new Set();
  const out = [];
  for (const [category, words] of Object.entries(LINEART_WORDS)) {
    for (const word of words) {
      const id = slug(word);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ category, word, id });
    }
  }
  return out;
}

// 직접 실행했을 때만 인계 문서를 만든다(다른 파일에서 import 할 때는 실행하지 않는다).
if (process.argv[1] && process.argv[1].endsWith('lineart-words.mjs')) {
  const here = dirname(fileURLToPath(import.meta.url));
  const repo = join(here, '..', '..', '..');
  const clay = new Set(readdirSync(join(repo, 'app', 'public', 'word-bank-images')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  let have = new Set();
  try {
    have = new Set(readdirSync(join(repo, 'app', 'public', 'word-bank-lineart')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  } catch {
    // 폴더가 아직 없으면 전부 미완료
  }
  const targets = lineartTargets();
  const missingClay = targets.filter((t) => !clay.has(t.id));
  if (missingClay.length) {
    console.error('클레이 그림이 없는 id:', missingClay.map((t) => t.id).join(', '));
    process.exit(1);
  }
  const todo = targets.filter((t) => !have.has(t.id));
  let haveDecor = new Set();
  try {
    haveDecor = new Set(readdirSync(join(repo, 'app', 'public', 'word-bank-lineart', 'decor')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  } catch {
    // 폴더가 아직 없으면 전부 미완료
  }
  const decor = decorTargets();
  const todoDecor = decor.filter((d) => !haveDecor.has(d.id));

  const lines = [];
  lines.push('# 클래스뱅크 색칠용 선화 제작 인계');
  lines.push('');
  lines.push('작성: Claude Code. 커밋·푸시·배포는 하지 않았고, 이미지 제작 후 사용자가 Claude Code에 요청한다.');
  lines.push('');
  lines.push('## 무엇을 만드나');
  lines.push('');
  lines.push(
    `색칠 워크시트에 쓸 **윤곽선(선화) 그림 ${targets.length}개**(아직 없는 ${todo.length}개). 대상은 유치~초등 저학년이 색칠하기 좋은 구체적인 명사만 골랐다. ` +
      '각 단어마다 이미 클레이 그림이 `app/public/word-bank-images/<id>.webp` 에 있으니, **같은 대상을 같은 구도**로 색칠하기 좋은 선화로 옮겨 그린다.',
  );
  lines.push('');
  lines.push(
    `색칠 페이지는 이 **단어 선화 + 주제별 장식 부품(${decor.length}개, 아직 없는 ${todoDecor.length}개)** 을 코드가 조립해서 만든다. 제목·단어 라벨·테두리는 앱이 그리므로 그림에 글자를 넣지 않는다.`,
  );
  lines.push('');
  lines.push('## 화풍 기준 (견본: `app/scripts/vocab/ref/lineart-style-sample.webp`)');
  lines.push('');
  lines.push('견본은 이 프로젝트가 AI로 만든 색칠용 예시다. **선의 굵기, 둥글고 통통한 비율, 단순한 형태**를 이 견본에 맞춘다. 견본의 글자(제목·단어)는 흉내 내지 않는다.');
  lines.push('');
  lines.push('- 동물·사람: 동그란 눈과 작은 미소가 있는 귀여운 얼굴, 짧고 통통한 다리, 털·무늬는 큰 덩어리 몇 개로만(견본의 젖소 무늬처럼 칠할 수 있는 크기).');
  lines.push('- 물건·음식·탈 것: 표정 없이 단순하고 둥근 윤곽. 바퀴·창문 같은 부속은 큼직하게 하나씩만.');
  lines.push('- 견본처럼 바닥선·그림자·배경 소품은 그리지 않는다(그건 앱이 조립할 때 장식 부품으로 붙인다).');
  lines.push('');
  lines.push('## 규격 (반드시 지킬 것)');
  lines.push('');
  lines.push('- **저장 위치·파일명**: `app/public/word-bank-lineart/<id>.webp` (폴더가 없으면 만든다). 표의 `id` 그대로. 클레이 그림과 같은 id를 쓰는 게 핵심이다.');
  lines.push('- **크기·형식**: 1024×1024 정사각 WebP, 순백(#FFFFFF) 배경. 장당 100KB 이하(선화라 작게 나온다).');
  lines.push('- **선**: 순검정, **굵고 균일한 선**(1024px 기준 약 8~10px), 둥근 끝. 색칠 칸이 **모두 닫혀 있게** 그린다(선이 끊겨 있으면 색칠할 때 번진다).');
  lines.push('- **채우기·그림자·회색·질감·그라데이션 금지**. 오직 흰 바탕에 검은 윤곽선만. 클레이의 입체감은 전부 뺀다.');
  lines.push('- **단순화**: 색칠하는 아이(만 4~8세)가 크레용으로 칠할 수 있게 디테일을 줄인다. 털 한 올 한 올, 작은 무늬, 복잡한 배경은 그리지 않는다. 색칠 칸이 너무 작으면 안 된다.');
  lines.push('- **구도**: 대상 하나를 화면 가운데에 크게(화면의 약 70~80%). 배경 소품은 넣지 않는다. 사람·동물은 귀엽고 둥근 비율, 정면 또는 옆면 중 알아보기 쉬운 쪽.');
  lines.push('- **그림 안에 글자·숫자·로고를 절대 넣지 않는다.** (단어 라벨은 앱이 따로 붙인다.)');
  lines.push('- **장식 부품**은 위와 같은 규격이고 `app/public/word-bank-lineart/decor/<id>.webp` 에 저장한다. 부품 하나에 대상 하나(헛간이면 헛간만), 화면 가운데에 크게.');
  lines.push('- **저작권**: 다른 사이트(잉글리시 플러스, 티처플러스, Twinkl 등)의 그림을 따라 그리거나 트레이싱하지 않는다. 클레이 그림 원본을 보고 새로 그린 순수 창작 선화만 쓴다.');
  lines.push('');
  lines.push('## 하지 말 것');
  lines.push('');
  lines.push('- `word-bank-images/` 의 기존 클레이 이미지를 수정하거나 덮어쓰지 않는다. 코드, SQL, i18n 수정 금지 — 이미지 파일 추가만.');
  lines.push('- 표에 없는 id로 파일 이름을 짓지 않는다.');
  lines.push('');
  lines.push('## 진행 방식');
  lines.push('');
  lines.push('- 카테고리 단위로 진행하고, 한 카테고리를 끝낼 때마다 만든 개수와 건너뛴 id를 보고한다. 이미 만든 파일은 다시 만들지 않는다.');
  lines.push('- **처음 카테고리(동물)를 4~5장 + 장식 부품(공통) 3~4장을 만든 시점에 멈추고 사용자에게 화풍을 확인받는다.** 선 굵기와 단순화 정도가 마음에 들어야 나머지를 이어서 만든다.');
  lines.push('- 순서: 단어 선화(카테고리별) → 장식 부품(주제별).');
  lines.push('');
  const byCat = new Map();
  for (const t of targets) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category).push(t);
  }
  for (const [category, list] of byCat) {
    lines.push(`## ${category} (${list.length}개, 남은 ${list.filter((t) => !have.has(t.id)).length}개)`);
    lines.push('');
    lines.push('| id | 단어 | 만들어졌나 |');
    lines.push('|---|---|---|');
    for (const t of list) lines.push(`| \`${t.id}\` | ${t.word} | ${have.has(t.id) ? '완료' : ''} |`);
    lines.push('');
  }
  lines.push('# 장식 부품');
  lines.push('');
  const byTheme = new Map();
  for (const d of decor) {
    if (!byTheme.has(d.theme)) byTheme.set(d.theme, []);
    byTheme.get(d.theme).push(d);
  }
  for (const [theme, list] of byTheme) {
    lines.push(`## 장식 · ${theme} (${list.length}개, 남은 ${list.filter((d) => !haveDecor.has(d.id)).length}개)`);
    lines.push('');
    lines.push('| id | 그릴 것 | 만들어졌나 |');
    lines.push('|---|---|---|');
    for (const d of list) lines.push(`| \`${d.id}\` | ${d.desc} | ${haveDecor.has(d.id) ? '완료' : ''} |`);
    lines.push('');
  }
  writeFileSync(join(repo, 'CURSOR_LINEART_HANDOFF.md'), lines.join('\n'));
  console.log(`CURSOR_LINEART_HANDOFF.md 생성 — 단어 선화 ${targets.length}개(남은 ${todo.length}), 장식 ${decor.length}개(남은 ${todoDecor.length})`);
}
