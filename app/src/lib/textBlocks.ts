import { evenIndexes } from './soloLessons';
import type { SoloClip, SoloStep } from './soloLessons';
import { parseShadowText } from './shadowLines';
import { extractYoutubeId } from './youtube';

/**
 * 글 블록(2026-10-12) — 선생님이 붙여 넣은 가사·대사·지문에서 문제를 뽑는다. 두 블록:
 *  - 가사·대사 빈칸: 줄마다 낱말 하나를 비운다. 쉬운 판은 보기에서 고르고(영상이 있으면 그 줄을 들려 줌), 어려운 판은 직접 쓴다.
 *    "문법 겨냥"을 고르면 그 문법이 쓰인 줄의 그 낱말만 비운다(예: 현재완료 → 과거분사).
 *  - 줄 순서: 이어지는 줄 3~6개를 섞어 순서대로 맞춘다.
 * 만든 문제는 개별수업 단계(gapType·lyricBlank·fillBlank·lineOrder)이므로 화면 풀이·서버 채점·인쇄(soloPrint.ts)가 같은 내용을 쓴다.
 * 글은 이 선생님의 수업 안에만 저장된다 — 공용 자료로 모으지 않는다(저작권).
 */

export interface TextLine {
  en: string;
  ko: string;
  start: number;
  end: number;
}

export interface ParsedText {
  lines: TextLine[];
  /** 시간표([분:초])가 있어서 영상 줄 듣기를 쓸 수 있나 */
  timed: boolean;
}

const MARK = /\*\*/g;

/**
 * 붙여넣은 글 → 줄. 대사표 형식([분:초] 영어 | 해석), 유튜브 스크립트·SRT, 그냥 줄글을 모두 읽는다.
 * 줄바꿈 없이 한 덩어리 문단이면 문장 단위로 나눈다.
 */
export function parseTextSource(source: string): ParsedText {
  const raw = source.trim();
  if (!raw) return { lines: [], timed: false };
  const parsed = parseShadowText(raw).map((l) => ({ en: l.en.replace(MARK, '').trim(), ko: l.ko, start: l.start, end: l.end }));
  const timed = /^\s*\[\d{1,2}:\d{2}/m.test(raw) || (parsed.length > 1 && /^\s*\d{1,2}:\d{2}/m.test(raw)) || /-->/.test(raw);
  let lines = parsed.filter((l) => l.en);
  // 한 덩어리 문단이면 문장으로 나눈다
  if (lines.length === 1 && lines[0].en.split(/\s+/).length > 14) {
    const sentences = lines[0].en.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    if (sentences.length > 1) lines = sentences.map((en, i) => ({ en, ko: '', start: i * 3, end: i * 3 + 3 }));
  }
  return { lines, timed };
}

/* ---------------- 문법 겨냥 ---------------- */

export interface GrammarTarget {
  id: string;
  ko: string;
  en: string;
  /** 줄에서 비울 낱말(글자 위치 포함)을 찾는다. 없으면 null. */
  find: (line: string) => { start: number; end: number } | null;
}

const IRREG_PP = 'been|gone|done|seen|known|given|taken|made|come|become|eaten|written|broken|chosen|spoken|forgotten|driven|shown|stolen|hidden|fallen|begun|sung|swum|worn|torn|born|grown|thrown|flown|drawn|ridden|risen|woken|bought|brought|caught|taught|thought|found|sold|told|held|kept|left|lost|met|paid|read|said|sent|spent|stood|won|heard|felt|built|got|had|put|set|let|cut|hit|run|sat|slept|understood|lent|led|meant|dug|hung|shot|swept|wept';
const IRREG_PAST = 'went|saw|ate|had|did|took|made|came|got|gave|told|thought|found|knew|felt|left|said|met|ran|wrote|sang|swam|wore|tore|grew|threw|flew|drew|rode|rose|woke|bought|brought|caught|taught|sold|held|kept|lost|paid|sent|spent|stood|won|heard|built|sat|slept|understood|lent|led|meant|dug|hung|shot|swept|wept|began|broke|chose|spoke|forgot|drove|showed|stole|hid|fell|was|were|became';

function rx(re: RegExp, group = 1): GrammarTarget['find'] {
  return (line) => {
    const flags = re.flags.includes('d') ? re.flags : `${re.flags}d`;
    const m = new RegExp(re.source, flags).exec(line) as (RegExpExecArray & { indices?: [number, number][] }) | null;
    if (!m || !m.indices || !m.indices[group]) return null;
    const [s, e] = m.indices[group];
    return { start: s, end: e };
  };
}

/** -ed 로 끝나지만 과거형·과거분사가 아닌 낱말 */
const NOT_ED = 'need|needs|feed|speed|seed|weed|breed|bleed|indeed|hundred|sacred|naked|wicked|kindred|exceed|proceed|succeed|bed|red|shed|sled|fed|wed|led|embed|tweed|reed|deed|steed|greed|creed|freed|bred|fled|sped|shred|inbred';

const NOT_VERB_AFTER_TO = 'the|a|an|my|your|his|her|our|their|its|me|you|him|us|them|it|this|that|these|those|one|each|every|school|work|bed|town|home|church|class|death|life|day|night|morning|america|korea|seoul|everyone|someone|nobody';

export const GRAMMAR_TARGETS: GrammarTarget[] = [
  { id: 'presentPerfect', ko: '현재완료 (have/has + 과거분사)', en: 'Present perfect', find: rx(new RegExp(String.raw`\b(?:have|has|haven't|hasn't|'ve)\s+(?:(?:never|ever|just|already|not|still|always|really)\s+)*(${IRREG_PP}|(?!(?:${NOT_ED})\b)[a-z]{2,}ed)\b`, 'i')) },
  { id: 'pastSimple', ko: '과거형 (-ed, 불규칙)', en: 'Simple past', find: rx(new RegExp(String.raw`\b(${IRREG_PAST}|(?!(?:${NOT_ED})\b)[a-z]{3,}ed)\b`, 'i')) },
  { id: 'progressive', ko: '진행형 (be + -ing)', en: 'Progressive', find: rx(/\b(?:am|is|are|was|were|'m|'re)\s+(?:(?:not|still|just|always|really)\s+)?((?!(?:king|ring|wing|thing|spring|string|swing|sing|bring|sling|ping|ding)\b)[a-z]{2,}ing)\b/i) },
  { id: 'toInfinitive', ko: 'to부정사 (to + 동사)', en: 'To-infinitive', find: rx(new RegExp(String.raw`\bto\s+(?!(?:${NOT_VERB_AFTER_TO})\b)([a-z]{2,})\b`, 'i')) },
  { id: 'gerund', ko: '동명사 (enjoy/like -ing)', en: 'Gerund', find: rx(/\b(?:enjoy|enjoys|enjoyed|like|likes|liked|love|loves|loved|hate|finish|finished|stop|stopped|start|started|keep|keeps|kept|mind|avoid|practice|go|goes|went|try|tried)\s+((?!(?:king|ring|wing|thing|spring|string|swing|sing|bring|sling|ping|ding)\b)[a-z]{2,}ing)\b/i) },
  { id: 'passive', ko: '수동태 (be + 과거분사)', en: 'Passive voice', find: rx(new RegExp(String.raw`\b(?:is|are|was|were|be|been|being|'s|'re)\s+(?:(?:not|never|also|always|often)\s+)?(${IRREG_PP}|(?!(?:${NOT_ED})\b)[a-z]{3,}ed)\b`, 'i')) },
  { id: 'comparative', ko: '비교급 (-er than, more … than)', en: 'Comparative', find: rx(/\b([a-z]{3,}er|more|less|better|worse)\s+(?:[a-z]+\s+)?than\b/i) },
  { id: 'superlative', ko: '최상급 (the -est, the most)', en: 'Superlative', find: rx(/\bthe\s+([a-z]{3,}est|most|best|worst|least)\b/i) },
  { id: 'modal', ko: '조동사 (can, will, should …)', en: 'Modal verbs', find: rx(/\b(can|could|will|would|should|must|may|might|shall|can't|won't|couldn't|wouldn't|shouldn't)\b/i) },
  { id: 'future', ko: '미래 (will, be going to)', en: 'Future', find: rx(/\b(will|won't|going)\b/i) },
  { id: 'be', ko: 'be동사 (am/is/are/was/were)', en: 'The verb be', find: rx(/\b(am|is|are|was|were)\b/i) },
  { id: 'thereBe', ko: 'There is/are', en: 'There is / are', find: rx(/\bthere\s+(is|are|was|were)\b/i) },
  { id: 'conjunction', ko: '접속사 (because, but, when, if …)', en: 'Conjunctions', find: rx(/\b(because|although|though|but|when|while|if|unless|until|before|after|since)\b/i) },
  { id: 'relative', ko: '관계대명사 (who, which, whose)', en: 'Relative pronouns', find: rx(/\b(who|which|whose|whom)\b/i) },
  { id: 'preposition', ko: '전치사 (in, on, at, under …)', en: 'Prepositions', find: rx(/\b(in|on|at|under|over|behind|between|beside|above|below|across|through|around|into|from|with|without|during)\b/i) },
  { id: 'article', ko: '관사 (a, an, the)', en: 'Articles', find: rx(/\b(a|an|the)\b/i) },
];

export const targetById = (id: string): GrammarTarget | null => GRAMMAR_TARGETS.find((g) => g.id === id) ?? null;

/* ---------------- 빈칸 고르기 ---------------- */

const STOP = new Set(
  `the and you your are was were have has had for but not with that this they them their there then than from what when where who why how can could would should will just like love baby oh yeah cause gonna wanna gotta ain't don't can't won't i'm i'll i've you're we're it's that's let's one all any some too very more most only also even ever never always still down over under about into onto out off up`.split(/\s+/),
);

export interface BlankRequest {
  /** 문법 겨냥 id — 없으면 자동(내용어) */
  target?: string | null;
  /** 직접 지정한 낱말(쉼표로 나눈 목록에서) — 있으면 그 낱말이 쓰인 줄만 */
  words?: string[];
}

export interface GapItem {
  /** 원문 한 줄 */
  line: TextLine;
  /** 빈칸으로 바꾼 문장(_____ 하나) */
  sentence: string;
  /** 빈칸의 정답 */
  answer: string;
}

const BLANK = '_____';

function blankAt(line: string, start: number, end: number): { sentence: string; answer: string } {
  return { sentence: `${line.slice(0, start)}${BLANK}${line.slice(end)}`, answer: line.slice(start, end) };
}

function pickBlank(line: string, req: BlankRequest): { start: number; end: number } | null {
  const wordsArr = (req.words ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (wordsArr.length > 0) {
    for (const w of wordsArr) {
      const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = new RegExp(`(?<![A-Za-z'])${esc}(?![A-Za-z'])`, 'i').exec(line);
      if (m) return { start: m.index, end: m.index + m[0].length };
    }
    return null;
  }
  if (req.target) {
    const g = targetById(req.target);
    return g ? g.find(line) : null;
  }
  // 자동: 내용어 중 하나(앞쪽에서 고르게 흩어지도록 가운데 근처 우선)
  const cands: { start: number; end: number; w: string }[] = [];
  const re = /[A-Za-z][A-Za-z']*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const w = m[0].toLowerCase();
    if (w.length >= 4 && !STOP.has(w)) cands.push({ start: m.index, end: m.index + m[0].length, w });
  }
  if (cands.length === 0) return null;
  const mid = cands[Math.floor(cands.length / 2)];
  return { start: mid.start, end: mid.end };
}

/** 줄마다 빈칸 한 개를 만든다. 겨냥(문법·낱말)에 안 걸리는 줄은 뺀다. 같은 낱말이 너무 겹치면 앞쪽을 우선한다. */
export function buildGapItems(lines: TextLine[], req: BlankRequest, count: number): GapItem[] {
  const usable = lines.filter((l) => l.en.split(/\s+/).filter(Boolean).length >= 3);
  const all: GapItem[] = [];
  for (const line of usable) {
    const at = pickBlank(line.en, req);
    if (!at) continue;
    const { sentence, answer } = blankAt(line.en, at.start, at.end);
    if (!/[A-Za-z]/.test(answer)) continue;
    all.push({ line, sentence, answer });
  }
  if (all.length <= count) return all;
  return evenIndexes(all.length, count).map((i) => all[i]);
}

/** 쉬운 판의 보기: 정답 + 같은 글에서 나온 다른 빈칸 정답·내용어 */
function distractors(answer: string, items: GapItem[], lines: TextLine[], need: number): string[] {
  const key = answer.toLowerCase();
  const pool: string[] = [];
  for (const it of items) pool.push(it.answer);
  for (const l of lines) for (const w of l.en.match(/[A-Za-z][A-Za-z']{2,}/g) ?? []) if (!STOP.has(w.toLowerCase())) pool.push(w);
  const seen = new Set([key]);
  const out: string[] = [];
  // 정답과 길이가 비슷한 것을 먼저(보기가 눈에 띄게 다르지 않도록)
  const sorted = [...new Set(pool)].sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length) || a.localeCompare(b));
  for (const w of sorted) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= need * 3) break;
  }
  // 앞쪽 후보에서 무작위로 need 개
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, need);
}

function shuffleOf<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface TextBlockContext {
  videoId: string | null;
  /** 시간표가 있어 영상 줄 듣기를 쓸 수 있나 */
  timed: boolean;
  /** 원문 전체 줄(보기·낱말 은행 재료) */
  lines: TextLine[];
}

const clipOf = (ctx: TextBlockContext, l: { start: number; end: number }): SoloClip | undefined =>
  ctx.videoId && ctx.timed ? { videoId: ctx.videoId, start: l.start, end: l.end } : undefined;

export function videoIdOf(url: string): string | null {
  return url.trim() ? extractYoutubeId(url) : null;
}

/** 빈칸 문제 단계들. level easy = 보기에서 고르기, hard = 직접 쓰기. */
export function buildGapSteps(items: GapItem[], level: 'easy' | 'hard', ctx: TextBlockContext): SoloStep[] {
  return items.map((it): SoloStep => {
    const clip = clipOf(ctx, it.line);
    if (level === 'hard') {
      const w = it.answer;
      return { t: 'gapType', sentence: it.sentence, word: w, ko: it.line.ko, length: w.length, first: w[0] ?? '', ...(clip ? { clip } : {}) };
    }
    const wrong = distractors(it.answer, items, ctx.lines, 3);
    const list = shuffleOf([it.answer, ...wrong]);
    const answer = list.indexOf(it.answer);
    if (clip) return { t: 'lyricBlank', clip, sentence: it.sentence, ko: it.line.ko, options: list, answer };
    return { t: 'fillBlank', sentence: it.sentence, meaning: it.line.ko, options: list, answer };
  });
}

/** 줄 순서 문제 단계들: 이어지는 줄을 size 개씩(마지막이 3개 미만이면 앞과 합친다) */
export function buildLineOrderSteps(lines: TextLine[], size: number, ctx: TextBlockContext, maxQuestions = 12): SoloStep[] {
  const usable = lines.filter((l) => l.en.split(/\s+/).filter(Boolean).length >= 2);
  const n = Math.max(3, Math.min(6, Math.round(size)));
  const groups: TextLine[][] = [];
  for (let i = 0; i < usable.length; i += n) groups.push(usable.slice(i, i + n));
  if (groups.length > 1 && groups[groups.length - 1].length < 3) {
    const last = groups.pop() ?? [];
    groups[groups.length - 1].push(...last);
  }
  const ok = groups.filter((g) => g.length >= 3 && new Set(g.map((l) => l.en.toLowerCase())).size >= 3);
  const picked = ok.length <= maxQuestions ? ok : evenIndexes(ok.length, maxQuestions).map((i) => ok[i]);
  return picked.map((g): SoloStep => {
    const texts = g.map((l) => l.en);
    let pieces = shuffleOf(texts);
    for (let i = 0; i < 8 && pieces.join('|') === texts.join('|'); i++) pieces = shuffleOf(texts);
    const clip = ctx.videoId && ctx.timed ? { videoId: ctx.videoId, start: g[0].start, end: g[g.length - 1].end } : undefined;
    return { t: 'lineOrder', lines: texts, pieces, ...(clip ? { clip } : {}) };
  });
}
