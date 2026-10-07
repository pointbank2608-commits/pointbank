import { LESSON_SETS, pickSetWords } from './lessonSets';
import type { FullCardItem, WordBankEntry } from './types';

/**
 * 개별수업("오늘의 수업") — 화면이 선생님이 되어 학생이 혼자 한다. 단체수업의 슬라이드(선생님이 보여 주는 자료)와 달리
 * 모든 단계에 학생이 직접 하는 행동이 하나씩 있다(듣고 따라 말하기·고르기·듣고 고르기·철자 쓰기).
 * 서버(047_solo_lessons.sql)가 같은 모양의 단계를 채점한다 — 정답 필드(answer, spell 의 word)는 학생에게 가지 않는다.
 */
export type SoloStep =
  | { t: 'intro'; title: string; text: string }
  | { t: 'meet'; word: string; meaning: string; imageUrl: string | null; example: string | null }
  | { t: 'pickWord'; imageUrl: string | null; meaning: string; options: string[]; answer: number }
  | { t: 'pickMeaning'; word: string; imageUrl: string | null; options: string[]; answer: number }
  | { t: 'listenPick'; word: string; options: string[]; images: (string | null)[]; answer: number }
  | { t: 'spell'; word: string; meaning: string; imageUrl: string | null; letters: string[] };

/** 학생에게 가는 모양(정답 없음) */
export type SoloPublicStep =
  | { t: 'intro'; title: string; text: string }
  | { t: 'meet'; word: string; meaning: string; imageUrl: string | null; example: string | null }
  | { t: 'pickWord'; imageUrl: string | null; meaning: string; options: string[] }
  | { t: 'pickMeaning'; word: string; imageUrl: string | null; options: string[] }
  | { t: 'listenPick'; word: string; options: string[]; images: (string | null)[] }
  | { t: 'spell'; meaning: string; imageUrl: string | null; letters: string[] };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 정답 하나 + 같은 단어 묶음의 다른 낱말로 보기 만들기(정답 자리는 무작위) */
function options<T>(correct: T, pool: T[], n = 4): { list: T[]; answer: number } {
  const others = shuffle(pool.filter((x) => x !== correct)).slice(0, n - 1);
  const list = shuffle([correct, ...others]);
  return { list, answer: list.indexOf(correct) };
}

/** 철자 쓰기 타일: 낱말 글자를 섞되 원래 순서와 같지 않게 */
function scrambleLetters(word: string): string[] {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '').split('');
  if (letters.length < 2) return letters;
  for (let i = 0; i < 6; i++) {
    const s = shuffle(letters);
    if (s.join('') !== letters.join('')) return s;
  }
  return letters;
}

/**
 * 단어 수업 단계 만들기(약 15분): 소개 → (낱말 5개씩) 만나기 → 그림 보고 고르기 → 듣고 고르기 → … → 뜻 고르기 → 철자 쓰기.
 * 낱말은 4개 이상 필요하다(보기 4개).
 */
export function buildSoloWordSteps(title: string, words: FullCardItem[]): SoloStep[] {
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  const steps: SoloStep[] = [
    { t: 'intro', title, text: `${usable.length}` },
  ];
  const wordsOnly = usable.map((w) => w.word);
  const meanings = usable.map((w) => w.meaning);
  for (let i = 0; i < usable.length; i += 5) {
    const chunk = usable.slice(i, i + 5);
    for (const w of chunk) steps.push({ t: 'meet', word: w.word, meaning: w.meaning, imageUrl: w.imageUrl, example: w.example ?? null });
    for (const w of shuffle(chunk)) {
      const o = options(w.word, wordsOnly);
      steps.push({ t: 'pickWord', imageUrl: w.imageUrl, meaning: w.meaning, options: o.list, answer: o.answer });
    }
    for (const w of shuffle(chunk)) {
      const pool = shuffle(usable.filter((x) => x.word !== w.word)).slice(0, 3);
      const list = shuffle([w, ...pool]);
      steps.push({ t: 'listenPick', word: w.word, options: list.map((x) => x.word), images: list.map((x) => x.imageUrl), answer: list.indexOf(w) });
    }
  }
  for (const w of shuffle(usable).slice(0, Math.min(4, usable.length))) {
    const o = options(w.meaning, meanings);
    steps.push({ t: 'pickMeaning', word: w.word, imageUrl: w.imageUrl, options: o.list, answer: o.answer });
  }
  const spellable = usable.filter((w) => /^[a-z]{3,8}$/i.test(w.word.trim()));
  for (const w of shuffle(spellable).slice(0, 5)) {
    steps.push({ t: 'spell', word: w.word.trim().toLowerCase(), meaning: w.meaning, imageUrl: w.imageUrl, letters: scrambleLetters(w.word) });
  }
  return steps;
}

/** 서버와 같은 규칙으로 미리보기에서 채점 */
export function gradeSoloLocal(step: SoloStep, value: string): boolean | null {
  if (step.t === 'pickWord' || step.t === 'pickMeaning' || step.t === 'listenPick') return Number(value) === step.answer;
  if (step.t === 'spell') return step.word.trim().toLowerCase() === value.trim().toLowerCase();
  return null;
}

export function soloCorrectText(step: SoloStep): string | null {
  if (step.t === 'pickWord' || step.t === 'pickMeaning' || step.t === 'listenPick') return step.options[step.answer] ?? null;
  if (step.t === 'spell') return step.word;
  return null;
}

export function toPublicStep(step: SoloStep): SoloPublicStep {
  if (step.t === 'pickWord') return { t: step.t, imageUrl: step.imageUrl, meaning: step.meaning, options: step.options };
  if (step.t === 'pickMeaning') return { t: step.t, word: step.word, imageUrl: step.imageUrl, options: step.options };
  if (step.t === 'listenPick') return { t: step.t, word: step.word, options: step.options, images: step.images };
  if (step.t === 'spell') return { t: step.t, meaning: step.meaning, imageUrl: step.imageUrl, letters: step.letters };
  return step;
}

/* ---------------- 미리 만든 개별수업 커리큘럼(학습 경로) ---------------- */

export interface SoloCatalogItem {
  id: string;
  /** 레벨 경로의 줄: 단어 / 문법 / 영상 */
  track: 'word' | 'grammar' | 'video';
  level: string;
  ko: string;
  en: string;
  koDesc: string;
  enDesc: string;
  minutes: number;
  icon: string;
  /** 단어 수업은 수업 세트(lessonSets)의 낱말 묶음을 쓴다 */
  setId?: string;
  /** 아직 준비 중 */
  soon?: boolean;
}

export const SOLO_CATALOG: SoloCatalogItem[] = [
  { id: 'solo-fruit', track: 'word', level: 'Level 1', ko: '과일 단어', en: 'Fruit words', koDesc: '사과·바나나 같은 과일 10개를 듣고, 말하고, 고르고, 써 봐요', enDesc: 'Hear, say, pick and spell 10 fruits', minutes: 15, icon: 'nutrition', setId: 'w-fruit' },
  { id: 'solo-farm', track: 'word', level: 'Level 1', ko: '집·농장 동물 단어', en: 'Farm & pet animals', koDesc: '강아지·소·닭 같은 친근한 동물 10개', enDesc: '10 familiar animals', minutes: 15, icon: 'pets', setId: 'w-farm' },
  { id: 'solo-body', track: 'word', level: 'Level 1', ko: '몸 단어', en: 'Body words', koDesc: '눈·코·손·발 같은 몸 단어 10개', enDesc: '10 body words', minutes: 15, icon: 'face', setId: 'w-body' },
  { id: 'solo-color', track: 'word', level: 'Level 1', ko: '색깔 단어', en: 'Color words', koDesc: '빨강·파랑·노랑 같은 색깔 10개', enDesc: '10 colors', minutes: 15, icon: 'palette', setId: 'w-color' },
  { id: 'solo-family', track: 'word', level: 'Level 1', ko: '가족과 사람 단어', en: 'Family & people', koDesc: '엄마·아빠·친구 같은 단어 10개', enDesc: '10 family and people words', minutes: 15, icon: 'family_restroom', setId: 'w-family' },
  { id: 'solo-g-this-is', track: 'grammar', level: 'Level 1', ko: 'This is / That is', en: 'This is / That is', koDesc: '가까운 것, 먼 것 소개하기', enDesc: 'Introducing near and far things', minutes: 15, icon: 'rule', soon: true },
  { id: 'solo-g-i-like', track: 'grammar', level: 'Level 1', ko: 'I like ~', en: 'I like ~', koDesc: '좋아하는 것 말하기', enDesc: 'Saying what you like', minutes: 15, icon: 'rule', soon: true },
  { id: 'solo-v-short', track: 'video', level: 'Level 1', ko: '짧은 영상 보고 대답하기', en: 'Watch a short clip and answer', koDesc: '5~10분 영상을 보고 질문에 답해요', enDesc: 'Watch a 5-10 minute clip and answer questions', minutes: 10, icon: 'movie', soon: true },
];

/** 카탈로그 항목 → 개별수업 단계(단어 수업만 지금 만들 수 있다). 낱말이 모자라면 null. */
export function buildSoloFromCatalog(item: SoloCatalogItem, bank: WordBankEntry[], lang: string): { name: string; steps: SoloStep[] } | null {
  if (item.track !== 'word' || !item.setId) return null;
  const set = LESSON_SETS.find((s) => s.id === item.setId);
  if (!set) return null;
  const words = pickSetWords(set, bank);
  if (words.length < 4) return null;
  const name = lang.startsWith('ko') ? item.ko : item.en;
  return { name, steps: buildSoloWordSteps(name, words) };
}
