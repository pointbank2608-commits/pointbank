/**
 * 숙제 내용 만들기(순수 함수) — 단어 카드·영상 장면 + 활동 구성(HwPlan) → 활동 목록(HwItemDraft[]).
 * 문제마다 서버 채점용 정답(correct)·스탯 태그(skill)·낱말 카드 스냅샷(card)을 담는다.
 * 빈칸 보기 고르기는 대회 퀴즈쇼의 규칙(pickBlankDistractors·blankSentence)을 그대로 쓴다.
 */
import { blankSentence, pickBlankDistractors } from '../liveQuiz';
import { parseShadowText } from '../shadowLines';
import type { FullCardItem } from '../types';
import type { HwCard, HwItemDraft, HwPlan, HwQuestion, HwShadowLine } from './types';

export const GEN_VERSION = 'hw2-2026-10';

/** 스탯 태그 — 041 learning_events.skill, 학습 카드 이름표와 같은 값 */
export const SKILL = {
  meaning: 'vocab.meaning',
  picture: 'vocab.picture',
  listen: 'listening.word',
  spelling: 'vocab.spelling',
  context: 'vocab.context',
  sentence: 'sentence.order',
  content: 'listening.content',
} as const;

export type Rng = () => number;

export function shuffleWith<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const uid = () => crypto.randomUUID();
const clean = (s: string | null | undefined) => (s ?? '').trim();
const isLetters = (w: string) => /^[a-z]{3,10}$/i.test(w.trim());

export const cardOf = (c: FullCardItem): HwCard => ({ word: clean(c.word), meaning: clean(c.meaning), imageUrl: c.imageUrl ?? null, example: c.example ?? null });

const base = (c: FullCardItem, skill: string, difficulty = 1) => ({
  id: uid(),
  skill,
  word: clean(c.word),
  contentId: `word:${clean(c.word).toLowerCase()}`,
  difficulty,
  gen: GEN_VERSION,
  card: cardOf(c),
});

/** 오답 보기: 같은 뜻·같은 낱말을 빼고 무작위로 */
function otherValues(pool: FullCardItem[], c: FullCardItem, pick: (x: FullCardItem) => string, n: number, rng: Rng): string[] {
  const own = pick(c).toLowerCase();
  const seen = new Set<string>([own]);
  const out: string[] = [];
  for (const x of shuffleWith(pool, rng)) {
    const v = clean(pick(x));
    if (!v || seen.has(v.toLowerCase()) || clean(x.meaning) === clean(c.meaning)) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

function choiceQ(c: FullCardItem, right: string, wrong: string[], rng: Rng, extra: Partial<HwQuestion> & { skill: string }): HwQuestion | null {
  if (wrong.length === 0) return null;
  const choices = shuffleWith([right, ...wrong], rng);
  return { ...base(c, extra.skill), qtype: 'choice', prompt: '', ...extra, choices, correct: choices.indexOf(right) };
}

export const meaningQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  choiceQ(c, clean(c.meaning), otherValues(pool, c, (x) => x.meaning, 3, rng), rng, { skill: SKILL.meaning, style: 'meaning', prompt: clean(c.word), speak: clean(c.word) });

export const reverseQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.meaning, style: 'reverse', prompt: clean(c.meaning) });

export const listenQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.listen, style: 'listen', prompt: '', speak: clean(c.word), difficulty: 2 });

export const pictureQ = (c: FullCardItem, pool: FullCardItem[], rng: Rng) =>
  c.imageUrl ? choiceQ(c, clean(c.word), otherValues(pool, c, (x) => x.word, 3, rng), rng, { skill: SKILL.picture, style: 'picture', prompt: '', imageUrl: c.imageUrl }) : null;

export function blankQ(c: FullCardItem, pool: FullCardItem[], rng: Rng): HwQuestion | null {
  const sentence = blankSentence(c.example, c.word);
  if (!sentence) return null;
  const wrong = pickBlankDistractors(c, sentence, pool, 3);
  const q = choiceQ(c, clean(c.word), wrong, rng, { skill: SKILL.context, style: 'blank', prompt: sentence, sub: clean(c.meaning), difficulty: 2 });
  return q;
}

/** 예문 낱말 순서(3~8낱말) */
export function sentenceOrderQ(c: FullCardItem, rng: Rng): HwQuestion | null {
  const words = clean(c.example).split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 8) return null;
  let tokens = shuffleWith(words, rng);
  for (let i = 0; i < 6 && tokens.join(' ') === words.join(' '); i++) tokens = shuffleWith(words, rng);
  return { ...base(c, SKILL.sentence, 3), qtype: 'order', style: 'sentence', prompt: clean(c.meaning), tokens, correct: words, joiner: ' ' };
}

/** 글자 순서(애너그램) */
export function lettersQ(c: FullCardItem, rng: Rng): HwQuestion | null {
  const w = clean(c.word).toLowerCase();
  if (!isLetters(w)) return null;
  const letters = [...w];
  let tokens = shuffleWith(letters, rng);
  for (let i = 0; i < 8 && tokens.join('') === w; i++) tokens = shuffleWith(letters, rng);
  return { ...base(c, SKILL.spelling, 2), qtype: 'order', style: 'letters', prompt: clean(c.meaning), imageUrl: c.imageUrl ?? null, tokens, correct: letters, joiner: '' };
}

/** 철자 입력 */
export function spellQ(c: FullCardItem): HwQuestion | null {
  const w = clean(c.word);
  if (!/^[a-z][a-z' -]{1,20}$/i.test(w)) return null;
  return { ...base(c, SKILL.spelling, 3), qtype: 'text', style: 'spell', prompt: clean(c.meaning), imageUrl: c.imageUrl ?? null, speak: w, correct: w };
}

/** 매치업: 5개씩 한 판, 판마다 같은 뜻 보기(순서 같음) */
export function matchupQs(cards: FullCardItem[], rng: Rng): HwQuestion[] {
  const out: HwQuestion[] = [];
  for (let i = 0; i < cards.length; i += 5) {
    const chunk = cards.slice(i, i + 5);
    if (chunk.length < 2) break;
    const meanings = shuffleWith(
      chunk.map((c) => clean(c.meaning)),
      rng,
    );
    chunk.forEach((c) => out.push({ ...base(c, SKILL.meaning), qtype: 'choice', style: 'match', prompt: clean(c.word), choices: meanings, correct: meanings.indexOf(clean(c.meaning)), round: String(i / 5) }));
  }
  return out;
}

/** 쉐도잉 뒤 내용 확인: 질문마다 장면의 다른 질문들의 답을 오답 보기로 */
export function contentQs(questions: { q: string; a: string; qKo?: string; aKo?: string }[], rng: Rng): HwQuestion[] {
  if (questions.length < 2) return [];
  return questions.map((x, i) => {
    const wrong = questions.filter((_, j) => j !== i).map((y) => y.a);
    const choices = shuffleWith([x.a, ...wrong].slice(0, 4), rng);
    return {
      id: uid(),
      qtype: 'choice' as const,
      style: 'content' as const,
      prompt: x.q,
      sub: x.qKo,
      choices,
      correct: choices.indexOf(x.a),
      skill: SKILL.content,
      word: '',
      contentId: `clip-question:${i}`,
      difficulty: 2,
      gen: GEN_VERSION,
    };
  });
}

/** 카드를 n개 고르기(모자라면 다시 섞어 채우되 같은 활동에서 같은 낱말은 되도록 안 겹치게) */
export function takeCards(cards: FullCardItem[], n: number, rng: Rng, ok: (c: FullCardItem) => boolean = () => true): FullCardItem[] {
  const usable = cards.filter(ok);
  if (usable.length === 0 || n <= 0) return [];
  return shuffleWith(usable, rng).slice(0, Math.min(n, usable.length));
}

export interface ClipSource {
  id: string;
  youtube_id: string;
  title: string;
  script: string;
  pack?: { questions?: { q: string; a: string; qKo?: string; aKo?: string }[] } | null;
}

export interface BuildLabels {
  quiz: string;
  worksheet: string;
  matchup: string;
  anagram: string;
  spelling: string;
  shadowing: string;
}

/** 활동 구성 → 활동 목록. 쉐도잉 → 단어 퀴즈 → 워크시트 → 게임 순서. 만들 수 없는 활동은 빠진다. */
export function buildItems(cards: FullCardItem[], plan: HwPlan, labels: BuildLabels, clip: ClipSource | null = null, rng: Rng = Math.random): HwItemDraft[] {
  const pool = cards.filter((c) => clean(c.word) && clean(c.meaning));
  const items: HwItemDraft[] = [];

  if (clip && plan.shadowLines > 0) {
    const lines: HwShadowLine[] = parseShadowText(clip.script)
      .slice(0, plan.shadowLines)
      .map((l) => ({ s: l.start, e: l.end, en: l.en.replace(/\*\*/g, ''), ko: l.ko || undefined, speaker: l.speaker }));
    if (lines.length > 0) {
      items.push({
        kind: 'shadowing',
        title: labels.shadowing,
        config: {},
        content: { videoId: clip.youtube_id, clipId: clip.id, lines, questions: plan.contentCheck ? contentQs(clip.pack?.questions ?? [], rng) : [] },
      });
    }
  }

  const quiz: HwQuestion[] = [];
  for (const c of takeCards(pool, plan.quizMeaning, rng)) {
    const q = meaningQ(c, pool, rng);
    if (q) quiz.push(q);
  }
  for (const c of takeCards(pool, plan.quizListen, rng)) {
    const q = listenQ(c, pool, rng);
    if (q) quiz.push(q);
  }
  for (const c of takeCards(pool, plan.quizPicture, rng, (x) => !!x.imageUrl)) {
    const q = pictureQ(c, pool, rng);
    if (q) quiz.push(q);
  }
  if (quiz.length) items.push({ kind: 'quiz', title: labels.quiz, config: {}, content: { questions: quiz } });

  const sheet: HwQuestion[] = [];
  const sheets: ('choose' | 'blank' | 'order')[] = [];
  const chooseQs = takeCards(pool, plan.sheetChoose, rng)
    .map((c) => (c.imageUrl ? pictureQ(c, pool, rng) : reverseQ(c, pool, rng)))
    .filter((q): q is HwQuestion => !!q);
  if (chooseQs.length) sheets.push('choose');
  const blankQs = takeCards(pool, plan.sheetBlank, rng, (c) => !!blankSentence(c.example, c.word))
    .map((c) => blankQ(c, pool, rng))
    .filter((q): q is HwQuestion => !!q);
  if (blankQs.length) sheets.push('blank');
  let orderQs = takeCards(pool, plan.sheetOrder, rng, (c) => {
    const n = clean(c.example).split(/\s+/).filter(Boolean).length;
    return n >= 3 && n <= 8;
  })
    .map((c) => sentenceOrderQ(c, rng))
    .filter((q): q is HwQuestion => !!q);
  // 예문이 없는 단어장이면 글자 순서로 대신
  if (orderQs.length === 0 && plan.sheetOrder > 0)
    orderQs = takeCards(pool, plan.sheetOrder, rng, (c) => isLetters(c.word))
      .map((c) => lettersQ(c, rng))
      .filter((q): q is HwQuestion => !!q);
  if (orderQs.length) sheets.push('order');
  sheet.push(...chooseQs, ...blankQs, ...orderQs);
  if (sheet.length) items.push({ kind: 'worksheet', title: labels.worksheet, config: { sheets }, content: { questions: sheet } });

  if (plan.gameMatchup >= 2) {
    const qs = matchupQs(takeCards(pool, plan.gameMatchup, rng), rng);
    if (qs.length) items.push({ kind: 'game', title: labels.matchup, config: { game: 'matchup' }, content: { questions: qs } });
  }
  if (plan.gameAnagram > 0) {
    const qs = takeCards(pool, plan.gameAnagram, rng, (c) => isLetters(c.word))
      .map((c) => lettersQ(c, rng))
      .filter((q): q is HwQuestion => !!q);
    if (qs.length) items.push({ kind: 'game', title: labels.anagram, config: { game: 'anagram' }, content: { questions: qs } });
  }
  if (plan.gameSpelling > 0) {
    const qs = takeCards(pool, plan.gameSpelling, rng)
      .map((c) => spellQ(c))
      .filter((q): q is HwQuestion => !!q);
    if (qs.length) items.push({ kind: 'game', title: labels.spelling, config: { game: 'spelling' }, content: { questions: qs } });
  }
  return items;
}

/* ---------- 5·10·15분 추천 구성 ---------- */

export const EMPTY_PLAN: HwPlan = {
  quizMeaning: 0,
  quizListen: 0,
  quizPicture: 0,
  sheetChoose: 0,
  sheetBlank: 0,
  sheetOrder: 0,
  gameMatchup: 0,
  gameAnagram: 0,
  gameSpelling: 0,
  shadowLines: 0,
  contentCheck: false,
};

export type HwDuration = 5 | 10 | 15;

export function presetPlan(minutes: HwDuration, cards: FullCardItem[], hasClip: boolean): HwPlan {
  const hasExamples = cards.some((c) => !!blankSentence(c.example, c.word));
  const hasImages = cards.some((c) => !!c.imageUrl);
  if (hasClip) {
    if (minutes === 5) return { ...EMPTY_PLAN, shadowLines: 6, contentCheck: true };
    if (minutes === 10) return { ...EMPTY_PLAN, shadowLines: 10, contentCheck: true, quizMeaning: cards.length >= 4 ? 5 : 0 };
    return { ...EMPTY_PLAN, shadowLines: 16, contentCheck: true, quizMeaning: cards.length >= 4 ? 5 : 0, gameMatchup: cards.length >= 4 ? 5 : 0 };
  }
  if (minutes === 5) return { ...EMPTY_PLAN, quizMeaning: 5, gameMatchup: 5 };
  if (minutes === 10)
    return { ...EMPTY_PLAN, quizMeaning: 4, quizListen: 3, sheetBlank: hasExamples ? 3 : 0, sheetChoose: hasExamples ? 0 : 3, sheetOrder: 3, gameAnagram: 4 };
  return { ...EMPTY_PLAN, quizMeaning: 5, quizListen: 4, quizPicture: hasImages ? 3 : 0, sheetChoose: 4, sheetBlank: hasExamples ? 4 : 0, sheetOrder: 4, gameMatchup: 5, gameSpelling: 5 };
}

/** 예상 시간(분) — 문제마다 대략 걸리는 초를 더한다(5·10·15분 버튼 아래 안내와 확인 화면) */
export function estimateMinutes(items: HwItemDraft[]): number {
  let sec = 0;
  for (const it of items) {
    if (it.kind === 'shadowing') sec += (it.content.lines?.length ?? 0) * 45;
    for (const q of it.content.questions)
      sec += q.style === 'match' ? 12 : q.style === 'sentence' ? 40 : q.style === 'letters' ? 30 : q.style === 'spell' ? 35 : q.style === 'blank' ? 30 : q.style === 'content' ? 25 : 20;
  }
  return Math.max(1, Math.round(sec / 60));
}

export const countQuestions = (items: HwItemDraft[]) => items.reduce((n, it) => n + it.content.questions.length, 0);
