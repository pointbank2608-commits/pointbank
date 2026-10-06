import { entryInCategory } from './wordBankCategories';
import type { FullCardItem, WordBankEntry } from './types';
import type { VideoClip } from './videoClips';

/**
 * 수업 세트(2026-10-07) — 옷가게 마네킹처럼 "미리 만들어 둔 수업". 레시피(수업 종류)에 내용(단어 묶음·문법 항목·영상 장면)을
 * 미리 끼워 둔 것이라, 고르면 단어장·슬라이드가 한 번에 채워진다. 시범 30개: 단어 15 · 문법 10 · 영상 5.
 * 단어 세트의 낱말은 사전(word_bank) 검수된 Lv.1~2 중 그림이 있는 것만 고른다 — 사전이 고쳐지면 세트도 따라간다.
 * 새 세트 = 여기에 한 줄(+ 영상은 제목만 맞으면 됨). 학교 진도용은 뼈대(레시피) + 선생님 단어장이라 여기에 두지 않는다.
 */
export type LessonSetKind = 'word' | 'grammar' | 'video';

export interface LessonSet {
  id: string;
  kind: LessonSetKind;
  icon: string;
  minutes: number;
  ko: string;
  en: string;
  koDesc: string;
  enDesc: string;
  /** 단어 세트: 사전 분류(+세부 분류)로 낱말을 모은다 */
  pick?: { category: string; subs?: string[] }[];
  /** 단어 세트의 품사(기본 명사) — 기분·색깔은 형용사, 동작은 동사 */
  pos?: string;
  /** 뜻이 너무 넓거나 주제와 어긋나 빼는 낱말 */
  exclude?: string[];
  /** 문법 세트 */
  grammarId?: string;
  /** 영상 세트: 영상 라이브러리 장면 제목 */
  clipTitle?: string;
}

const WORDS_PER_SET = 10;

export const LESSON_SETS: LessonSet[] = [
  // ---- 단어 15 ----
  { id: 'w-farm', kind: 'word', icon: 'pets', minutes: 30, ko: '집·농장 동물', en: 'Farm & pet animals', koDesc: '강아지·소·닭 같은 친근한 동물 10개', enDesc: '10 familiar animals', pick: [{ category: '동물', subs: ['집·농장 동물'] }] },
  { id: 'w-wild', kind: 'word', icon: 'cruelty_free', minutes: 30, ko: '야생 동물', en: 'Wild animals', koDesc: '사자·코끼리 같은 동물원 동물 10개', enDesc: '10 zoo animals', pick: [{ category: '동물', subs: ['야생 동물'] }] },
  { id: 'w-sea', kind: 'word', icon: 'set_meal', minutes: 30, ko: '물속 동물과 벌레', en: 'Sea animals & bugs', koDesc: '고래·물고기·곤충 10개', enDesc: '10 sea animals and bugs', pick: [{ category: '동물', subs: ['물속 동물', '곤충·벌레'] }] },
  { id: 'w-fruit', kind: 'word', icon: 'nutrition', minutes: 30, ko: '과일', en: 'Fruit', koDesc: '사과·바나나 같은 과일 10개', enDesc: '10 fruits', pick: [{ category: '음식', subs: ['과일'] }], exclude: ['fruit'] },
  { id: 'w-veg', kind: 'word', icon: 'eco', minutes: 30, ko: '채소와 빵·밥', en: 'Vegetables & staples', koDesc: '채소·빵·면 10개', enDesc: '10 vegetables and staples', pick: [{ category: '음식', subs: ['채소', '곡물·빵·면'] }], exclude: ['vegetable', 'noodle'] },
  { id: 'w-snack', kind: 'word', icon: 'icecream', minutes: 30, ko: '간식과 음료', en: 'Snacks & drinks', koDesc: '아이스크림·주스 같은 간식 10개', enDesc: '10 snacks and drinks', pick: [{ category: '음식', subs: ['간식·디저트', '음료'] }] },
  { id: 'w-body', kind: 'word', icon: 'face', minutes: 30, ko: '몸', en: 'Body', koDesc: '눈·코·입·손·발 10개', enDesc: '10 body words', pick: [{ category: '몸' }] },
  { id: 'w-clothes', kind: 'word', icon: 'checkroom', minutes: 30, ko: '옷', en: 'Clothes', koDesc: '티셔츠·바지·모자 10개', enDesc: '10 clothing words', pick: [{ category: '옷' }], exclude: ['umbrella', 'backpack', 'glasses', 'button'] },
  { id: 'w-family', kind: 'word', icon: 'family_restroom', minutes: 30, ko: '가족과 사람', en: 'Family & people', koDesc: '엄마·아빠·친구 10개', enDesc: '10 family and people words', pick: [{ category: '사람/가족' }] },
  { id: 'w-school', kind: 'word', icon: 'school', minutes: 30, ko: '학교와 문구', en: 'School things', koDesc: '연필·책가방·교실 10개', enDesc: '10 school words', pick: [{ category: '학교/문구' }], exclude: ['lunch', 'music', 'class', 'computer'] },
  { id: 'w-home', kind: 'word', icon: 'chair', minutes: 30, ko: '우리 집', en: 'My home', koDesc: '침대·소파·냉장고 10개', enDesc: '10 home words', pick: [{ category: '집/가구' }] },
  { id: 'w-color', kind: 'word', icon: 'palette', minutes: 30, ko: '색깔', en: 'Colors', koDesc: '빨강·파랑·노랑 10개', enDesc: '10 colors', pick: [{ category: '색깔' }], pos: '형용사', exclude: ['color'] },
  { id: 'w-weather', kind: 'word', icon: 'partly_cloudy_day', minutes: 30, ko: '날씨와 자연', en: 'Weather & nature', koDesc: '해·비·눈·산·강 10개', enDesc: '10 weather and nature words', pick: [{ category: '자연/날씨' }] },
  { id: 'w-feeling', kind: 'word', icon: 'mood', minutes: 30, ko: '기분', en: 'Feelings', koDesc: '행복해·슬퍼·화나 같은 기분 10개', enDesc: '10 feeling words', pick: [{ category: '감정' }], pos: '형용사', exclude: ['favorite', 'sorry'] },
  { id: 'w-action', kind: 'word', icon: 'directions_run', minutes: 30, ko: '움직이는 말', en: 'Action words', koDesc: '달리다·먹다·앉다 같은 동작 10개', enDesc: '10 action verbs', pick: [{ category: '동작', subs: ['생활', '이동', '손으로 하는 동작'] }], pos: '동사' },
  // ---- 문법 10 ----
  { id: 'g-this-is', kind: 'grammar', icon: 'rule', minutes: 30, ko: 'This is / That is', en: 'This is / That is', koDesc: '가까운 것, 먼 것 소개하기', enDesc: 'Introducing near and far things', grammarId: 'this-is' },
  { id: 'g-a-an', kind: 'grammar', icon: 'rule', minutes: 30, ko: '관사 a / an', en: 'Articles a / an', koDesc: '하나일 때 a, 모음 소리 앞에서 an', enDesc: 'a / an', grammarId: 'a-an' },
  { id: 'g-plural', kind: 'grammar', icon: 'rule', minutes: 30, ko: '여러 개 (복수형)', en: 'Plural nouns', koDesc: '-s, -es 붙이기', enDesc: 'Adding -s and -es', grammarId: 'plural' },
  { id: 'g-i-am', kind: 'grammar', icon: 'rule', minutes: 30, ko: 'I am ~', en: 'I am ~', koDesc: '나를 소개하는 말', enDesc: 'Talking about yourself', grammarId: 'i-am' },
  { id: 'g-he-she-is', kind: 'grammar', icon: 'rule', minutes: 30, ko: 'He is / She is', en: 'He is / She is', koDesc: '다른 사람 소개하기', enDesc: 'Talking about other people', grammarId: 'he-she-is' },
  { id: 'g-i-like', kind: 'grammar', icon: 'rule', minutes: 30, ko: 'I like ~', en: 'I like ~', koDesc: '좋아하는 것 말하기', enDesc: 'Saying what you like', grammarId: 'i-like' },
  { id: 'g-i-have', kind: 'grammar', icon: 'rule', minutes: 30, ko: 'I have ~', en: 'I have ~', koDesc: '가지고 있는 것 말하기', enDesc: 'Saying what you have', grammarId: 'i-have' },
  { id: 'g-i-want', kind: 'grammar', icon: 'rule', minutes: 30, ko: 'I want ~', en: 'I want ~', koDesc: '갖고 싶은 것 말하기', enDesc: 'Saying what you want', grammarId: 'i-want' },
  { id: 'g-i-can', kind: 'grammar', icon: 'rule', minutes: 30, ko: 'I can ~ / Can you ~?', en: 'I can ~ / Can you ~?', koDesc: '할 수 있는 것 말하고 묻기', enDesc: 'Saying and asking what you can do', grammarId: 'i-can' },
  { id: 'g-lets', kind: 'grammar', icon: 'rule', minutes: 30, ko: "Let's ~", en: "Let's ~", koDesc: '같이 하자고 제안하기', enDesc: 'Making suggestions', grammarId: 'lets' },
  // ---- 영상 5 ----
  { id: 'v-donuts', kind: 'video', icon: 'movie', minutes: 45, ko: 'Peppa Makes Donuts', en: 'Peppa Makes Donuts', koDesc: '도넛 공장 견학 — have to', enDesc: 'A donut factory visit', clipTitle: 'Peppa Makes Donuts' },
  { id: 'v-morning', kind: 'video', icon: 'movie', minutes: 45, ko: "Peppa's Morning Rush", en: "Peppa's Morning Rush", koDesc: '바쁜 아침 — 명령문', enDesc: 'A busy morning', clipTitle: "Peppa's Morning Rush" },
  { id: 'v-bus', kind: 'video', icon: 'movie', minutes: 45, ko: 'Evie on the Bus', en: 'Evie on the Bus', koDesc: '버스 타기 — 명령문', enDesc: 'A bus ride', clipTitle: 'Evie on the Bus' },
  { id: 'v-icecream', kind: 'video', icon: 'movie', minutes: 45, ko: 'Ice Cream Time', en: 'Ice Cream Time', koDesc: '아이스크림 시간 — I am ~', enDesc: 'Ice cream time', clipTitle: 'Ice Cream Time' },
  { id: 'v-school', kind: 'video', icon: 'movie', minutes: 45, ko: 'Caillou Goes Back to School', en: 'Caillou Goes Back to School', koDesc: '새 학기 첫날 — I can ~', enDesc: 'The first day of school', clipTitle: 'Caillou Goes Back to School' },
];

export function lessonSetName(set: LessonSet, lang: string): string {
  return lang.startsWith('ko') ? set.ko : set.en;
}

export function lessonSetDesc(set: LessonSet, lang: string): string {
  return lang.startsWith('ko') ? set.koDesc : set.enDesc;
}

/** 단어 세트의 낱말: 사전 Lv.1~2에서 그림이 있고 숙어·표현이 아닌 것, 쉬운 단계·사전 순서대로 10개. 분류가 여럿이면 번갈아 섞어 고르게 담는다. */
export function pickSetWords(set: LessonSet, bank: WordBankEntry[]): FullCardItem[] {
  if (!set.pick) return [];
  const eligible = (e: WordBankEntry) =>
    (e.level ?? 9) <= 2 && !!e.image_url && e.part_of_speech === (set.pos ?? '명사') && !!e.meaning && !set.exclude?.includes(e.word.toLowerCase());
  const groups = set.pick.map((p) =>
    bank
      .filter((e) => eligible(e) && entryInCategory(e, p.category) && (!p.subs || (!!e.subcategory && p.subs.includes(e.subcategory))))
      .sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  );
  const out: WordBankEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < WORDS_PER_SET; i++) {
    let any = false;
    for (const g of groups) {
      const e = g[i];
      if (!e) continue;
      any = true;
      const k = e.word.toLowerCase();
      if (seen.has(k) || seen.has(`${k}s`) || seen.has(k.replace(/s$/, '')) || out.length >= WORDS_PER_SET) continue;
      seen.add(k);
      out.push(e);
    }
    if (!any) break;
  }
  return out.map((e) => ({
    id: crypto.randomUUID(),
    word: e.word,
    meaning: e.meaning,
    imageUrl: e.image_url,
    category: e.category,
    example: e.example_sentence,
    partOfSpeech: e.part_of_speech,
  }));
}

/** 영상 세트의 장면: 영상 라이브러리에서 제목이 같고 내려가지 않은 것 */
export function findSetClip(set: LessonSet, clips: VideoClip[]): VideoClip | null {
  if (!set.clipTitle) return null;
  const want = set.clipTitle.toLowerCase();
  return clips.find((c) => c.title.toLowerCase() === want && !c.hidden) ?? null;
}
