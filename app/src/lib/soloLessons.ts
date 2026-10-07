import { GRAMMAR_POINTS, grammarLevelTag, plainText, sentencesForUnscramble, type GrammarPoint } from './grammar';
import { LESSON_SETS, pickSetWords } from './lessonSets';
import type { FullCardItem, WordBankEntry } from './types';

/**
 * 개별수업("오늘의 수업") — 화면이 선생님이 되어 학생이 혼자 한다. 단체수업의 슬라이드(선생님이 보여 주는 자료)와 달리
 * 모든 단계에 학생이 직접 하는 행동이 하나씩 있다(듣고 따라 말하기·고르기·듣고 고르기·쓰기·문장 만들기).
 * 서버(047·049·050 SQL)가 같은 모양의 단계를 채점한다 — 정답 필드는 학생에게 가지 않는다(solo_public_step).
 *
 *  단어(그림 중심): intro · meet · pickWord · pickMeaning · listenPick · spell
 *  단어(쓰기 중심, 중학생용): meet · pickMeaning · typeWord · fillBlank · dictation
 *  문법: intro · rule · example · translatePick · pickCorrect · unscramble
 */
export type SoloStep =
  | { t: 'intro'; title: string; text: string }
  | { t: 'meet'; word: string; meaning: string; imageUrl: string | null; example: string | null }
  | { t: 'pickWord'; imageUrl: string | null; meaning: string; options: string[]; answer: number }
  | { t: 'pickMeaning'; word: string; imageUrl: string | null; options: string[]; answer: number }
  | { t: 'listenPick'; word: string; options: string[]; images: (string | null)[]; answer: number }
  | { t: 'spell'; word: string; meaning: string; imageUrl: string | null; letters: string[] }
  | { t: 'typeWord'; word: string; meaning: string; imageUrl: string | null; length: number; first: string }
  | { t: 'fillBlank'; sentence: string; meaning: string; options: string[]; answer: number }
  | { t: 'dictation'; word: string; length: number }
  | { t: 'rule'; title: string; pattern: string; explain: string; lines: string[]; tip: string }
  | { t: 'example'; sentence: string; ko: string }
  | { t: 'translatePick'; sentence: string; options: string[]; answer: number }
  | { t: 'pickCorrect'; options: string[]; answer: number; why: string }
  | { t: 'unscramble'; sentence: string; words: string[] };

/** 학생에게 가는 모양(정답 없음) */
export type SoloPublicStep =
  | { t: 'intro'; title: string; text: string }
  | { t: 'meet'; word: string; meaning: string; imageUrl: string | null; example: string | null }
  | { t: 'pickWord'; imageUrl: string | null; meaning: string; options: string[] }
  | { t: 'pickMeaning'; word: string; imageUrl: string | null; options: string[] }
  | { t: 'listenPick'; word: string; options: string[]; images: (string | null)[] }
  | { t: 'spell'; meaning: string; imageUrl: string | null; letters: string[] }
  | { t: 'typeWord'; meaning: string; imageUrl: string | null; length: number; first: string }
  | { t: 'fillBlank'; sentence: string; meaning: string; options: string[] }
  | { t: 'dictation'; word: string; length: number }
  | { t: 'rule'; title: string; pattern: string; explain: string; lines: string[]; tip: string }
  | { t: 'example'; sentence: string; ko: string }
  | { t: 'translatePick'; sentence: string; options: string[] }
  | { t: 'pickCorrect'; options: string[]; why: string }
  | { t: 'unscramble'; words: string[] };

/** 보기에서 번호로 고르는 단계 */
export const SOLO_CHOICE_TYPES = ['pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect'] as const;
/** 글자로 답하는 단계 */
export const SOLO_TEXT_TYPES = ['spell', 'typeWord', 'dictation', 'unscramble'] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 정답 하나 + 풀의 다른 값으로 보기 만들기(정답 자리는 무작위) */
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

/* ---------------- 단어: 그림 중심(초등) ---------------- */

/**
 * 단어 수업 단계(약 15분): 소개 → (낱말 5개씩) 만나기 → 그림 보고 고르기 → 듣고 고르기 → … → 뜻 고르기 → 철자 쓰기.
 * pool 은 보기를 만들 낱말 풀(없으면 이 수업의 낱말). 낱말은 4개 이상 필요하다.
 */
export function buildSoloWordSteps(title: string, words: FullCardItem[], pool?: FullCardItem[]): SoloStep[] {
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  const poolWords = (pool ?? usable).filter((w) => w.word.trim() && w.meaning.trim());
  const steps: SoloStep[] = [{ t: 'intro', title, text: `${usable.length}` }];
  const wordsOnly = poolWords.map((w) => w.word);
  const meanings = poolWords.map((w) => w.meaning);
  for (let i = 0; i < usable.length; i += 5) {
    const chunk = usable.slice(i, i + 5);
    for (const w of chunk) steps.push({ t: 'meet', word: w.word, meaning: w.meaning, imageUrl: w.imageUrl, example: w.example ?? null });
    for (const w of shuffle(chunk)) {
      const o = options(w.word, wordsOnly);
      steps.push({ t: 'pickWord', imageUrl: w.imageUrl, meaning: w.meaning, options: o.list, answer: o.answer });
    }
    for (const w of shuffle(chunk)) {
      const others = shuffle(poolWords.filter((x) => x.word !== w.word)).slice(0, 3);
      const list = shuffle([w, ...others]);
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

/* ---------------- 단어: 쓰기 중심(중학생용) ---------------- */

/** 예문에서 낱말을 ____ 로 비운다(낱말 그대로 나올 때만). 못 비우면 null. */
export function blankSentence(sentence: string, word: string): string | null {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${esc}\\b`, 'i');
  if (!re.test(sentence)) return null;
  return sentence.replace(re, '_____');
}

/**
 * 쓰기 중심 단어 수업 — 뜻을 보고 쓰기·빈칸 채우기·듣고 받아쓰기. 그림이 없어도 된다.
 * 소개 → 낱말 만나기(소리·뜻·예문) → 뜻 고르기 → 뜻 보고 쓰기 → 예문 빈칸 → 받아쓰기.
 */
export function buildSoloWritingSteps(title: string, words: FullCardItem[], pool?: FullCardItem[]): SoloStep[] {
  const usable = words.filter((w) => w.word.trim() && w.meaning.trim());
  const poolWords = (pool ?? usable).filter((w) => w.word.trim() && w.meaning.trim());
  const steps: SoloStep[] = [{ t: 'intro', title, text: `${usable.length}` }];
  const meanings = poolWords.map((w) => w.meaning);
  for (const w of usable) steps.push({ t: 'meet', word: w.word, meaning: w.meaning, imageUrl: w.imageUrl, example: w.example ?? null });
  for (const w of shuffle(usable)) {
    const o = options(w.meaning, meanings);
    steps.push({ t: 'pickMeaning', word: w.word, imageUrl: w.imageUrl, options: o.list, answer: o.answer });
  }
  const typable = usable.filter((w) => /^[a-z' .-]{1,20}$/i.test(w.word.trim()));
  for (const w of shuffle(typable)) {
    const word = w.word.trim().toLowerCase();
    steps.push({ t: 'typeWord', word, meaning: w.meaning, imageUrl: w.imageUrl, length: word.length, first: word[0] ?? '' });
  }
  const sentenced = shuffle(usable).flatMap((w) => {
    const blank = w.example ? blankSentence(w.example, w.word.trim()) : null;
    return blank ? [{ w, blank }] : [];
  });
  for (const { w, blank } of sentenced.slice(0, 6)) {
    const same = poolWords.filter((x) => x.word !== w.word && x.partOfSpeech && x.partOfSpeech === w.partOfSpeech).map((x) => x.word);
    const others = (same.length >= 3 ? same : poolWords.filter((x) => x.word !== w.word).map((x) => x.word));
    const o = options(w.word, [w.word, ...others]);
    steps.push({ t: 'fillBlank', sentence: blank, meaning: w.meaning, options: o.list, answer: o.answer });
  }
  for (const w of shuffle(typable).slice(0, Math.min(5, typable.length))) {
    const word = w.word.trim().toLowerCase();
    steps.push({ t: 'dictation', word, length: word.length });
  }
  return steps;
}

/* ---------------- 교육부 초등 800: DAY별 ---------------- */

/** 교육부 초등 800 목록의 DAY(1~16) 낱말 — 목록 번호 순서, 한 낱말에 뜻이 둘이면 첫 뜻만 */
export function moe800Words(bank: WordBankEntry[], day: number): FullCardItem[] {
  const seen = new Set<string>();
  return bank
    .filter((e) => e.moe800_day === day && e.part_of_speech !== '숙어' && e.part_of_speech !== '표현' && e.meaning)
    .sort((a, b) => (a.moe800_no ?? 0) - (b.moe800_no ?? 0) || a.sense_number - b.sense_number)
    .filter((e) => {
      const k = e.word.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((e) => ({
      id: e.id,
      word: e.word,
      meaning: e.meaning,
      imageUrl: e.image_url,
      category: e.category,
      example: e.example_sentence,
      partOfSpeech: e.part_of_speech,
    }));
}

export type SoloWordStyle = 'picture' | 'writing';

/**
 * 한 DAY(50낱말)를 perLesson 개씩 나눠 개별수업 여러 개로 만든다. 마지막 조각이 3개 이하면 앞 조각에 합친다.
 * style: picture = 그림 중심(초등), writing = 쓰기 중심(중학생).
 */
export function buildSoloDayLessons(
  bank: WordBankEntry[],
  opts: { day: number; perLesson: number; style: SoloWordStyle; baseName: string },
): { name: string; steps: SoloStep[]; minutes: number }[] {
  const all = moe800Words(bank, opts.day);
  if (all.length < 4) return [];
  const per = Math.max(4, opts.perLesson);
  const chunks: FullCardItem[][] = [];
  for (let i = 0; i < all.length; i += per) chunks.push(all.slice(i, i + per));
  if (chunks.length > 1 && chunks[chunks.length - 1].length <= 3) {
    const last = chunks.pop() ?? [];
    chunks[chunks.length - 1].push(...last);
  }
  return chunks.map((chunk, i) => {
    const name = chunks.length > 1 ? `${opts.baseName} (${i + 1}/${chunks.length})` : opts.baseName;
    const steps = opts.style === 'writing' ? buildSoloWritingSteps(name, chunk, all) : buildSoloWordSteps(name, chunk, all);
    return { name, steps, minutes: Math.max(5, Math.round(steps.length * 0.4)) };
  });
}

/* ---------------- 문법 ---------------- */

/** 해석에 붙은 역할 메모 "(주격)" 같은 꼬리를 뗀다 */
function cleanKo(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** 예문(여러 문장이 한 줄에 있으면 그대로) → 읽기 단계용 문장 */
function exampleSteps(point: GrammarPoint): { sentence: string; ko: string }[] {
  const tr = point.translations ?? [];
  return point.examples.map((e, i) => ({ sentence: plainText(e).trim(), ko: cleanKo(tr[i] ?? '') })).filter((x) => x.sentence);
}

/**
 * 문법 항목 하나 → 개별수업: 소개 → 규칙 → 예문 읽기(소리·해석) → 해석 고르기 → 맞는 문장 고르기 → 문장 배열하기.
 * 해석 보기에 쓸 다른 해석은 같은 단계(초등/중등)의 다른 항목 해석에서 가져온다.
 */
export function buildSoloGrammarLesson(point: GrammarPoint): { name: string; steps: SoloStep[]; minutes: number } {
  const name = point.name;
  const steps: SoloStep[] = [{ t: 'intro', title: name, text: point.tip ?? point.explain }];
  const lines = [...(point.usage ?? []), ...(point.detail ?? []), ...(point.rule ?? [])].map(plainText);
  steps.push({ t: 'rule', title: name, pattern: plainText(point.pattern), explain: point.explain, lines, tip: point.tip ?? '' });
  const ex = exampleSteps(point);
  for (const e of ex) steps.push({ t: 'example', sentence: e.sentence, ko: e.ko });

  const koPool = GRAMMAR_POINTS.filter((p) => p.stage === point.stage && p.id !== point.id)
    .flatMap((p) => (p.translations ?? []).map(cleanKo))
    .filter((k) => k.length > 0);
  const ownKo = ex.filter((e) => e.ko);
  for (const e of shuffle(ownKo).slice(0, 3)) {
    const o = options(e.ko, [e.ko, ...ex.map((x) => x.ko).filter((k) => k && k !== e.ko), ...koPool]);
    if (o.list.length >= 3) steps.push({ t: 'translatePick', sentence: e.sentence, options: o.list, answer: o.answer });
  }
  for (const p of (point.pitfalls ?? []).slice(0, 3)) {
    const right = plainText(p.right).replace(/\s*\([^)]*\)\s*$/, '').trim();
    const wrong = plainText(p.wrong).replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!right || !wrong || right === wrong) continue;
    const list = shuffle([right, wrong]);
    steps.push({ t: 'pickCorrect', options: list, answer: list.indexOf(right), why: p.why ?? '' });
  }
  for (const s of shuffle(sentencesForUnscramble(point, [])).slice(0, 4)) {
    const words = s.split(/\s+/);
    if (words.length < 3 || words.length > 10) continue;
    let sc = shuffle(words);
    for (let i = 0; i < 5 && sc.join(' ') === words.join(' '); i++) sc = shuffle(words);
    steps.push({ t: 'unscramble', sentence: words.join(' '), words: sc });
  }
  return { name, steps, minutes: Math.max(8, Math.round(steps.length * 0.7)) };
}

/** 개별수업으로 만들 수 있는 문법: 초등·중등 */
export const SOLO_GRAMMAR_POINTS = GRAMMAR_POINTS.filter((p) => p.stage === 'elementary' || p.stage === 'middle');
export { grammarLevelTag };

/* ---------------- 미리보기 채점·공개 ---------------- */

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** 서버와 같은 규칙으로 미리보기에서 채점 */
export function gradeSoloLocal(step: SoloStep, value: string): boolean | null {
  if ((SOLO_CHOICE_TYPES as readonly string[]).includes(step.t)) return Number(value) === (step as { answer: number }).answer;
  if (step.t === 'spell' || step.t === 'typeWord' || step.t === 'dictation') return norm(step.word) === norm(value);
  if (step.t === 'unscramble') return norm(step.sentence) === norm(value);
  return null;
}

export function soloCorrectText(step: SoloStep): string | null {
  if ((SOLO_CHOICE_TYPES as readonly string[]).includes(step.t)) {
    const s = step as { options: string[]; answer: number };
    return s.options[s.answer] ?? null;
  }
  if (step.t === 'spell' || step.t === 'typeWord' || step.t === 'dictation') return step.word;
  if (step.t === 'unscramble') return step.sentence;
  return null;
}

export function toPublicStep(step: SoloStep): SoloPublicStep {
  switch (step.t) {
    case 'pickWord':
      return { t: step.t, imageUrl: step.imageUrl, meaning: step.meaning, options: step.options };
    case 'pickMeaning':
      return { t: step.t, word: step.word, imageUrl: step.imageUrl, options: step.options };
    case 'listenPick':
      return { t: step.t, word: step.word, options: step.options, images: step.images };
    case 'spell':
      return { t: step.t, meaning: step.meaning, imageUrl: step.imageUrl, letters: step.letters };
    case 'typeWord':
      return { t: step.t, meaning: step.meaning, imageUrl: step.imageUrl, length: step.length, first: step.first };
    case 'fillBlank':
      return { t: step.t, sentence: step.sentence, meaning: step.meaning, options: step.options };
    case 'translatePick':
      return { t: step.t, sentence: step.sentence, options: step.options };
    case 'pickCorrect':
      return { t: step.t, options: step.options, why: step.why };
    case 'unscramble':
      return { t: step.t, words: step.words };
    default:
      return step;
  }
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
  { id: 'solo-v-short', track: 'video', level: 'Level 1', ko: '짧은 영상 보고 대답하기', en: 'Watch a short clip and answer', koDesc: '5~10분 영상을 보고 질문에 답해요', enDesc: 'Watch a 5-10 minute clip and answer questions', minutes: 10, icon: 'movie', soon: true },
];

/** 카탈로그 항목 → 개별수업 단계(그림 중심 단어 수업). 낱말이 모자라면 null. */
export function buildSoloFromCatalog(item: SoloCatalogItem, bank: WordBankEntry[], lang: string): { name: string; steps: SoloStep[] } | null {
  if (item.track !== 'word' || !item.setId) return null;
  const set = LESSON_SETS.find((s) => s.id === item.setId);
  if (!set) return null;
  const words = pickSetWords(set, bank);
  if (words.length < 4) return null;
  const name = lang.startsWith('ko') ? item.ko : item.en;
  return { name, steps: buildSoloWordSteps(name, words) };
}
