import { auctionLots, detectiveCases, factorySources, labRounds, shuffleSeeded, verbRounds, writeRounds, type GrammarGameType } from './grammarGames';
import { baseOf, splitSimple, third } from './sentenceFactory';
import { COMPARE_DATA, FREQ_DAYS, HABIT_ACTS, HABIT_ORDER, HABIT_SUBJECTS, LINK_DATA, type Connector, type Freq } from './grammarGameData';

/** 문법별 게임 2차 묶음(2026-11-03): 문장 속 품사 탐험·문장 뼈대 조립소·비교급 챔피언·이유·결과 연결 다리·습관 캘린더. */

/* ---------- 문장 속 품사 탐험 ---------- */
export type PosCat = 'verb' | 'pronoun' | 'preposition' | 'determiner' | 'conjunction';
export const POS_CATS: PosCat[] = ['verb', 'pronoun', 'preposition', 'determiner', 'conjunction'];
const PRON = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them']);
const DET = new Set(['a', 'an', 'the', 'my', 'your', 'our', 'their']);
const PREP = new Set(['in', 'on', 'under', 'at', 'behind', 'between', 'near', 'from', 'with', 'by', 'into', 'over', 'of']);
const CONJ = new Set(['and', 'but', 'because', 'or']);
const AUX = new Set(['am', 'is', 'are', 'was', 'were', 'can', 'could', 'will', 'would', 'should', 'must', 'may', 'might', 'have', 'has', 'had', 'do', 'does', 'did']);
/** 명사로도 쓰이는 낱말(원형 그대로면 동사인지 확신할 수 없다) */
const HOMOGRAPH = new Set(['watch', 'show', 'walk', 'cook', 'call', 'help', 'look', 'work', 'study', 'play', 'paint', 'dance', 'talk', 'use', 'visit', 'plan', 'wish', 'kick', 'push', 'pull', 'cover', 'miss', 'laugh', 'smile', 'turn', 'stop', 'start', 'answer', 'move', 'wait', 'cry', 'hug', 'clap', 'like', 'love', 'share', 'practice', 'travel', 'save', 'drink', 'run', 'swim', 'sing', 'ride', 'read', 'drive', 'close', 'open', 'clean', 'wash', 'brush', 'jump', 'climb']);

export function posOf(word: string): PosCat | null {
  const w = word.toLowerCase();
  if (PRON.has(w)) return 'pronoun';
  if (DET.has(w)) return 'determiner';
  if (PREP.has(w)) return 'preposition';
  if (CONJ.has(w)) return 'conjunction';
  if (AUX.has(w)) return 'verb';
  const b = baseOf(word);
  if (!b) return null;
  if (b.tense === 'past' || b.third) return 'verb';
  return HOMOGRAPH.has(w) ? null : 'verb';
}

export interface PosRound { id: string; tokens: string[]; cat: PosCat; correct: number[] }
export function posRounds(grammarId: string, seed = 1, max = 10): PosRound[] {
  const used: Record<string, number> = {};
  const out: PosRound[] = [];
  for (const sent of shuffleSeeded(factorySources(grammarId), seed)) {
    const tokens = sent.replace(/[.?!,]/g, '').split(/\s+/).filter(Boolean);
    if (tokens.length < 3 || tokens.length > 10) continue;
    const tags = tokens.map((w) => posOf(w));
    const cats = POS_CATS.filter((c) => tags.includes(c)).sort((a, b) => (used[a] ?? 0) - (used[b] ?? 0));
    if (!cats.length) continue;
    const cat = cats[0];
    used[cat] = (used[cat] ?? 0) + 1;
    out.push({ id: `pos-${out.length}`, tokens, cat, correct: tags.map((t, i) => (t === cat ? i : -1)).filter((i) => i >= 0) });
    if (out.length >= max) break;
  }
  return out;
}

/* ---------- 문장 뼈대 조립소 ---------- */
export type FramePart = 'subject' | 'verb' | 'rest';
export interface FrameRound { id: string; sentence: string; subject: string; verb: string; rest: string; order: FramePart[] }
export function frameRounds(grammarId: string, seed = 1, max = 8): FrameRound[] {
  const out: FrameRound[] = [];
  for (const sent of shuffleSeeded(factorySources(grammarId), seed)) {
    const sp = splitSimple(sent);
    if (!sp) continue;
    out.push({ id: `frame-${out.length}`, sentence: sent, ...sp, order: shuffleSeeded<FramePart>(['subject', 'verb', 'rest'], seed + out.length) });
    if (out.length >= max) break;
  }
  return out;
}

/* ---------- 비교급 챔피언 ---------- */
const COMPARE_MODE: Record<string, 'comp' | 'sup' | 'both'> = {
  comparative: 'comp', 'm-comparative-emphasis': 'comp', superlative: 'sup', 'm-superlative-one-of': 'sup', 'm-comparison': 'both', 'h-comparison-advanced': 'both',
};
export interface CompareRound {
  id: string; kind: 'comp' | 'sup'; adj: string;
  things: { n: string; e: string; v: number; unit: string; pct: number }[];
  before: string; after: string; answer: string; options: string[];
}
export function compareRounds(grammarId: string, seed = 1, max = 8): CompareRound[] {
  const mode = COMPARE_MODE[grammarId];
  if (!mode) return [];
  const out: CompareRound[] = [];
  shuffleSeeded(COMPARE_DATA, seed).forEach((d, i) => {
    const sorted = [...d.things].sort((a, b) => (d.dir === 'max' ? b.v - a.v : a.v - b.v));
    const kind: 'comp' | 'sup' = mode === 'both' ? (i % 2 === 0 ? 'comp' : 'sup') : mode;
    const picked = kind === 'comp' ? [sorted[0], sorted[1 + (i % 2)]] : sorted;
    const vals = picked.map((t) => t.v);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const things = picked.map((t) => ({ ...t, unit: d.unit, pct: hi === lo ? 100 : 15 + (85 * (t.v - lo)) / (hi - lo) }));
    out.push({
      id: `cmp-${out.length}`, kind, adj: d.adj, things,
      before: kind === 'comp' ? `The ${picked[0].n} is` : `The ${picked[0].n} is the`,
      after: kind === 'comp' ? `than the ${picked[1].n}.` : 'of the three.',
      answer: kind === 'comp' ? d.comp : d.sup,
      options: shuffleSeeded([d.adj, d.comp, d.sup], seed + i),
    });
  });
  return out.slice(0, max).map((r, i) => ({ ...r, id: `cmp-${i}` }));
}

/* ---------- 이유·결과 연결 다리 ---------- */
const LINK_OPTIONS: Record<string, Connector[]> = { 'and-but': ['and', 'but'], because: ['because', 'so'], so: ['because', 'so'] };
const LINK_GRAMMARS = new Set(['and-but', 'because', 'so', 'm-conj-coordinating', 'pos-conjunction', 'm-conj-when-if-that']);
export interface LinkRound { id: string; a: string; b: string; answer: Connector; options: Connector[] }
export const linkSentence = (a: string, conn: Connector, b: string) => `${a}${conn === 'but' || conn === 'so' ? ',' : ''} ${conn} ${b}.`;
export function linkRounds(grammarId: string, seed = 1, max = 8): LinkRound[] {
  if (!LINK_GRAMMARS.has(grammarId)) return [];
  const allowed = LINK_OPTIONS[grammarId] ?? (['and', 'but', 'because', 'so'] as Connector[]);
  return shuffleSeeded(LINK_DATA.filter((p) => allowed.includes(p.conn)), seed).slice(0, max)
    .map((p, i) => ({ id: `link-${i}`, a: p.a, b: p.b, answer: p.conn, options: shuffleSeeded(allowed, seed + i) }));
}

/* ---------- 습관 캘린더 ---------- */
const HABIT_GRAMMARS = new Set(['frequency', 'tense-present']);
export type HabitRound =
  | { id: string; kind: 'calendar'; days: boolean[]; before: string; after: string; answer: Freq; options: Freq[] }
  | { id: string; kind: 'order'; options: string[]; answer: string };
export function habitRounds(grammarId: string, seed = 1, max = 8): HabitRound[] {
  if (!HABIT_GRAMMARS.has(grammarId)) return [];
  const freqs = Object.keys(FREQ_DAYS) as Freq[];
  const out: HabitRound[] = [];
  const acts = shuffleSeeded(HABIT_ACTS, seed);
  const calendarCount = grammarId === 'frequency' ? max - 2 : max;
  for (let i = 0; i < calendarCount; i++) {
    const answer = freqs[(i + seed) % freqs.length];
    const counts = FREQ_DAYS[answer];
    const n = counts[(i + seed) % counts.length];
    const subj = HABIT_SUBJECTS[(i + seed) % HABIT_SUBJECTS.length];
    const [verb, ...restWords] = acts[i % acts.length].split(' ');
    const rest = restWords.join(' ').replace(/\bmy\b/g, subj.poss);
    const verbForm = subj.subj === 'He' || subj.subj === 'She' ? third(verb) : verb;
    const chosen = shuffleSeeded([0, 1, 2, 3, 4, 5, 6], seed * 7 + i).slice(0, n);
    const others = shuffleSeeded(freqs.filter((f) => f !== answer), seed + i).slice(0, 2);
    out.push({
      id: '', kind: 'calendar', days: [0, 1, 2, 3, 4, 5, 6].map((d) => chosen.includes(d)),
      before: subj.subj, after: `${verbForm} ${rest}.`, answer, options: shuffleSeeded<Freq>([answer, ...others], seed + i),
    });
  }
  if (grammarId === 'frequency') {
    shuffleSeeded(HABIT_ORDER, seed).slice(0, 2).forEach((o, i) => out.push({ id: '', kind: 'order', answer: o.ok, options: shuffleSeeded([o.ok, o.bad], seed + i) }));
  }
  return out.map((r, i) => ({ ...r, id: `habit-${i}` }));
}

/** 이 문법으로 만들 수 있는 게임 (게임 종류별 문제 수) */
export function grammarGameSupport(grammarId: string): Record<GrammarGameType | 'detective', number> {
  return {
    grammarlab: labRounds(grammarId).length,
    grammarverb: verbRounds(grammarId).length,
    grammarauction: auctionLots(grammarId).length,
    grammarwrite: writeRounds(grammarId).length,
    grammarpos: posRounds(grammarId).length,
    grammarframe: frameRounds(grammarId).length,
    grammarcompare: compareRounds(grammarId).length,
    grammarlink: linkRounds(grammarId).length,
    grammarhabit: habitRounds(grammarId).length,
    detective: detectiveCases(grammarId).length,
  };
}
export const MIN_ROUNDS: Record<GrammarGameType | 'detective', number> = {
  grammarlab: 4, grammarverb: 4, grammarauction: 4, grammarwrite: 3, grammarpos: 4, grammarframe: 4, grammarcompare: 4, grammarlink: 4, grammarhabit: 4, detective: 2,
};
