import type { SoloStep } from './soloLessons';

/**
 * 복습·누적 테스트·다시 배우기(2026-10-11) — 학생이 자기 자리에서 하는 표준 50분 흐름의 1·2단계.
 * 재료는 서버가 주는 "내가 만난 낱말 기록"(solo_review_pool, 057)이고, 문제는 이 파일이 만든다(AI 없음).
 *  - daily      어제 수업 복습(약 3분): 최근 수업의 낱말 5개를 뜻 고르기 + 듣고 고르기
 *  - cumulative 누적 테스트(약 4분): 틀렸거나 모르겠다고 한 낱말 → 최근 낱말 → 오래 안 본 낱말 순으로 12개
 *  - relearn    틀린 낱말 다시 배우기: 만나기 → 뜻 고르기 → 철자
 */
export interface PoolWord {
  word: string;
  meaning: string;
  image_url: string | null;
  example: string | null;
  pos: string | null;
  right: number;
  wrong: number;
  unsure: number;
  last_at: string | null;
  recent: boolean;
  missed_here: boolean;
}

export type ReviewMode = 'daily' | 'cumulative' | 'relearn';

export interface ReviewLesson {
  name: string;
  minutes: number;
  steps: SoloStep[];
  /** 문제로 나온 낱말 */
  words: string[];
}

const STALE_DAYS = 14;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function options<T>(correct: T, pool: T[], n = 4): { list: T[]; answer: number } {
  const others = shuffle([...new Set(pool)].filter((x) => x !== correct)).slice(0, n - 1);
  const list = shuffle([correct, ...others]);
  return { list, answer: list.indexOf(correct) };
}

function scrambleLetters(word: string): string[] {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '').split('');
  if (letters.length < 2) return letters;
  for (let i = 0; i < 6; i++) {
    const s = shuffle(letters);
    if (s.join('') !== letters.join('')) return s;
  }
  return letters;
}

const weakScore = (w: PoolWord) => w.wrong * 2 + w.unsure * 2 - Math.min(w.right, 3);
const isWeak = (w: PoolWord) => w.wrong + w.unsure > 0 && weakScore(w) > 0;
const isStale = (w: PoolWord) => !w.last_at || Date.now() - new Date(w.last_at).getTime() > STALE_DAYS * 86400000;
const usable = (w: PoolWord) => !!w.word.trim() && !!w.meaning.trim();

/** 복습에 쓸 낱말 고르기 */
export function pickReviewWords(pool: PoolWord[], mode: ReviewMode): PoolWord[] {
  const all = pool.filter(usable);
  if (mode === 'relearn') return all.filter((w) => w.missed_here);
  if (mode === 'daily') {
    const recent = shuffle(all.filter((w) => w.recent));
    const rest = shuffle(all.filter((w) => !w.recent && isWeak(w)));
    return [...recent, ...rest].slice(0, 5);
  }
  const taken = new Set<string>();
  const out: PoolWord[] = [];
  const add = (list: PoolWord[], max: number) => {
    for (const w of list) {
      if (out.length >= 12 || max <= 0) return;
      if (taken.has(w.word)) continue;
      taken.add(w.word);
      out.push(w);
      max -= 1;
    }
  };
  add([...all.filter(isWeak)].sort((a, b) => weakScore(b) - weakScore(a)), 7);
  add(shuffle(all.filter((w) => w.recent)), 3);
  add(shuffle(all.filter(isStale)), 2);
  add(shuffle(all), 12 - out.length);
  return out;
}

/** 복습 수업 단계 만들기. 보기를 만들 낱말이 모자라면 null. */
export function buildReviewLesson(mode: ReviewMode, pool: PoolWord[], picked: PoolWord[], name: string): ReviewLesson | null {
  const all = pool.filter(usable);
  const meanings = all.map((w) => w.meaning);
  const words = all.map((w) => w.word);
  if (picked.length < (mode === 'relearn' ? 1 : 3) || all.length < 4) return null;

  const minutes = mode === 'daily' ? 3 : mode === 'cumulative' ? 4 : Math.max(3, picked.length);
  const intro: SoloStep = {
    t: 'intro',
    title: name,
    text:
      mode === 'daily'
        ? `${minutes}분 · 어제 배운 낱말을 짧게 다시 떠올려요`
        : mode === 'cumulative'
          ? `${minutes}분 · 지금까지 배운 낱말을 확인해요. 틀려도 괜찮아요, 끝나고 다시 배울 수 있어요`
          : `${minutes}분 · 틀린 낱말을 다시 만나고 한 번 더 풀어요`,
  };
  const steps: SoloStep[] = [intro];

  const pickMeaning = (w: PoolWord): SoloStep => {
    const o = options(w.meaning, meanings);
    return { t: 'pickMeaning', word: w.word, imageUrl: w.image_url, options: o.list, answer: o.answer };
  };
  const listenPick = (w: PoolWord): SoloStep => {
    const others = shuffle(all.filter((x) => x.word !== w.word)).slice(0, 3);
    const list = shuffle([w, ...others]);
    return { t: 'listenPick', word: w.word, options: list.map((x) => x.word), images: list.map((x) => x.image_url), answer: list.indexOf(w) };
  };
  const pickWord = (w: PoolWord): SoloStep => {
    const o = options(w.word, words);
    return { t: 'pickWord', imageUrl: w.image_url, meaning: w.meaning, options: o.list, answer: o.answer };
  };
  const spell = (w: PoolWord): SoloStep | null =>
    /^[a-z]{3,8}$/.test(w.word) ? { t: 'spell', word: w.word, meaning: w.meaning, imageUrl: w.image_url, letters: scrambleLetters(w.word) } : null;
  const meet = (w: PoolWord): SoloStep => ({ t: 'meet', word: w.word, meaning: w.meaning, imageUrl: w.image_url, example: w.example, pos: w.pos });

  if (mode === 'daily') {
    for (const w of picked) steps.push(pickMeaning(w), listenPick(w));
  } else if (mode === 'cumulative') {
    const kinds = [pickMeaning, listenPick, (w: PoolWord) => spell(w) ?? pickMeaning(w), pickWord];
    picked.forEach((w, i) => {
      // 약한 낱말은 쉬운 문제(뜻 고르기)부터, 나머지는 돌아가며
      const make = isWeak(w) && i % 2 === 0 ? pickMeaning : kinds[i % kinds.length];
      steps.push(make(w));
    });
  } else {
    for (const w of picked) {
      steps.push(meet(w), pickMeaning(w));
      const sp = spell(w);
      if (sp) steps.push(sp);
    }
  }
  return { name, minutes, steps, words: picked.map((w) => w.word) };
}
