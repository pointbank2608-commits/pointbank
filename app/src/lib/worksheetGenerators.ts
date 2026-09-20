import { toLetterGameText } from './gameText';
import { decorIdsFor, lineartUrlForWord } from './lineart';
import type { FullCardItem } from './types';

/**
 * 단어 목록 → 인쇄용 워크시트 데이터. 화면 그리기는 components/worksheets/ 가 맡고, 여기는 문제를
 * 만드는 순수 함수만 둔다. 같은 seed 면 같은 결과라서 미리보기와 인쇄가 어긋나지 않고, "다시 섞기"는
 * seed 만 바꾸면 된다. 글자를 다루는 유형(낱말 찾기·글자 순서 바꾸기)은 lib/gameText.ts 의
 * toLetterGameText 규칙(구두점 제거·대문자·공백 있는 구/너무 짧거나 긴 단어 제외)을 그대로 쓴다.
 */

export type Rng = () => number;

/** 같은 seed → 같은 난수열(mulberry32). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* ---------------- 선 잇기 ---------------- */

export interface MatchSide {
  image: string | null;
  text: string;
}

export interface MatchPage {
  left: MatchSide[];
  /** 섞인 오른쪽 목록 */
  right: MatchSide[];
  /** answer[i] = left[i] 와 이어지는 right 의 인덱스 */
  answer: number[];
}

/** 그림이 있으면 "그림 ↔ 단어", 없으면 "단어 ↔ 뜻". 둘 다 없는 단어는 뺀다. */
export function buildMatchPages(words: FullCardItem[], rng: Rng, perPage = 6): MatchPage[] {
  const usable = words
    .map((w) => {
      const left: MatchSide | null = w.imageUrl ? { image: w.imageUrl, text: '' } : w.word ? { image: null, text: w.word } : null;
      const rightText = w.imageUrl ? w.word : w.meaning;
      return left && rightText ? { left, right: { image: null, text: rightText } as MatchSide } : null;
    })
    .filter((x): x is { left: MatchSide; right: MatchSide } => x !== null);
  return chunk(usable, perPage).map((rows) => {
    const order = shuffled(
      rows.map((_, i) => i),
      rng,
    );
    const answer = rows.map((_, i) => order.indexOf(i));
    return { left: rows.map((r) => r.left), right: order.map((i) => rows[i].right), answer };
  });
}

/* ---------------- 낱말 찾기 ---------------- */

export interface WordSearchPage {
  size: number;
  grid: string[][];
  words: { display: string; text: string; cells: [number, number][] }[];
  /** 자리를 못 찾아서 빠진 단어(표시용) */
  skipped: string[];
}

const SEARCH_DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function eligibleLetterWords(words: FullCardItem[], range = { min: 2, max: 12 }): { display: string; text: string }[] {
  const seen = new Set<string>();
  const out: { display: string; text: string }[] = [];
  for (const w of words) {
    const text = toLetterGameText(w.word, range);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ display: w.word, text });
  }
  return out;
}

export function buildWordSearchPages(words: FullCardItem[], rng: Rng, perPage = 10): WordSearchPage[] {
  const eligible = eligibleLetterWords(words, { min: 3, max: 12 });
  return chunk(eligible, perPage).map((group) => {
    const total = group.reduce((n, g) => n + g.text.length, 0);
    const longest = Math.max(...group.map((g) => g.text.length));
    const size = Math.min(14, Math.max(longest, Math.ceil(Math.sqrt(total * 2.6)), 9));
    const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
    const placed: WordSearchPage['words'] = [];
    const skipped: string[] = [];
    for (const entry of [...group].sort((a, b) => b.text.length - a.text.length)) {
      let cells: [number, number][] | null = null;
      for (let attempt = 0; attempt < 300 && !cells; attempt++) {
        const [dr, dc] = SEARCH_DIRS[Math.floor(rng() * SEARCH_DIRS.length)];
        const r = Math.floor(rng() * size);
        const c = Math.floor(rng() * size);
        const endR = r + dr * (entry.text.length - 1);
        const endC = c + dc * (entry.text.length - 1);
        if (endR >= size || endC >= size) continue;
        const line: [number, number][] = [...entry.text].map((_, k) => [r + dr * k, c + dc * k]);
        if (line.every(([rr, cc], k) => grid[rr][cc] === '' || grid[rr][cc] === entry.text[k])) cells = line;
      }
      if (!cells) {
        skipped.push(entry.display);
        continue;
      }
      cells.forEach(([rr, cc], k) => {
        grid[rr][cc] = entry.text[k];
      });
      placed.push({ display: entry.display, text: entry.text, cells });
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) if (grid[r][c] === '') grid[r][c] = ALPHABET[Math.floor(rng() * 26)];
    }
    // 목록은 원래 입력 순서대로 보여준다.
    placed.sort((a, b) => group.findIndex((g) => g.text === a.text) - group.findIndex((g) => g.text === b.text));
    return { size, grid, words: placed, skipped };
  });
}

/* ---------------- 글자 순서 바꾸기 ---------------- */

export interface UnscrambleRow {
  word: string;
  scrambled: string;
  imageUrl: string | null;
  meaning: string;
}

function scramble(text: string, rng: Rng): string {
  const chars = [...text];
  if (new Set(chars).size < 2) return text;
  let out = text;
  for (let i = 0; i < 30 && out === text; i++) out = shuffled(chars, rng).join('');
  return out;
}

export function buildUnscramblePages(words: FullCardItem[], rng: Rng, perPage = 8): UnscrambleRow[][] {
  const rows: UnscrambleRow[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const text = toLetterGameText(w.word, { min: 3, max: 12 });
    if (!text || seen.has(text)) continue;
    seen.add(text);
    rows.push({ word: w.word, scrambled: scramble(text, rng), imageUrl: w.imageUrl, meaning: w.meaning });
  }
  return chunk(rows, perPage);
}

/* ---------------- 빈칸 채우기 ---------------- */

export interface BlankRow {
  word: string;
  /** 글자별로 가려졌는지 */
  slots: { ch: string; blank: boolean }[];
  imageUrl: string | null;
  meaning: string;
}

const LETTER = /\p{L}/u;

export function buildFillBlankPages(words: FullCardItem[], rng: Rng, perPage = 8): BlankRow[][] {
  const rows: BlankRow[] = [];
  for (const w of words) {
    const chars = [...w.word.normalize('NFKC').trim()];
    const letterIdx = chars.map((ch, i) => (LETTER.test(ch) ? i : -1)).filter((i) => i >= 0);
    if (letterIdx.length < 2) continue;
    // 첫 글자는 힌트로 남기고, 나머지 글자의 약 40%를 가린다(최소 1개).
    const candidates = letterIdx.slice(1);
    const hideCount = Math.min(candidates.length, Math.max(1, Math.round(letterIdx.length * 0.4)));
    const hidden = new Set(shuffled(candidates, rng).slice(0, hideCount));
    rows.push({
      word: w.word,
      slots: chars.map((ch, i) => ({ ch, blank: hidden.has(i) })),
      imageUrl: w.imageUrl,
      meaning: w.meaning,
    });
  }
  return chunk(rows, perPage);
}

/* ---------------- 분류하기 ---------------- */

export interface GroupingSheet {
  groups: { name: string; words: FullCardItem[] }[];
  /** 섞인 보기 단어들 */
  pool: FullCardItem[];
}

/** 카테고리가 있는 단어 중 가장 많은 카테고리 최대 3개로 묶는다. 2개 미만이면 null. */
export function buildGroupingSheet(words: FullCardItem[], rng: Rng, maxGroups = 3, maxPerGroup = 5): GroupingSheet | null {
  const byCat = new Map<string, FullCardItem[]>();
  for (const w of words) {
    if (!w.category) continue;
    if (!byCat.has(w.category)) byCat.set(w.category, []);
    byCat.get(w.category)!.push(w);
  }
  const groups = [...byCat.entries()]
    .filter(([, list]) => list.length >= 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxGroups)
    .map(([name, list]) => ({ name, words: list.slice(0, maxPerGroup) }));
  if (groups.length < 2) return null;
  return { groups, pool: shuffled(groups.flatMap((g) => g.words), rng) };
}

/* ---------------- 오려 붙이기 ---------------- */

export interface CutPastePage {
  /** 붙일 칸 순서(정답 순서). 그림이 있는 단어만 쓴다. */
  targets: FullCardItem[];
  /** 오려 낼 그림 조각(섞인 순서) */
  pieces: FullCardItem[];
}

export function buildCutPastePages(words: FullCardItem[], rng: Rng, perPage = 6): CutPastePage[] {
  const withImage = words.filter((w) => w.imageUrl);
  return chunk(withImage, perPage).map((targets) => ({ targets, pieces: shuffled(targets, rng) }));
}

/* ---------------- 한데 묶기 ---------------- */

/* ---------------- 색칠하기 ---------------- */

export type ColoringLabelMode = 'word' | 'write' | 'none';
export type ColoringPerPage = 4 | 6 | 8 | 9;

export interface ColoringOptions {
  title: string;
  labelMode: ColoringLabelMode;
  perPage: ColoringPerPage;
  /** 장식 주제(공통 부품은 항상 후보). null 이면 공통만. */
  decorTheme: string | null;
}

export const DEFAULT_COLORING_OPTIONS: ColoringOptions = {
  title: "Let's Color!",
  labelMode: 'word',
  perPage: 6,
  decorTheme: null,
};

export interface ColoringPage {
  items: { word: string; src: string }[];
  cols: number;
  rows: number;
  /** 장식 부품 id — 앞에서부터 [왼쪽 위, 오른쪽 위, 아래 왼쪽, 아래 가운데, 아래 오른쪽] 자리 */
  decor: string[];
}

const COLORING_GRID: Record<ColoringPerPage, [number, number]> = { 4: [2, 2], 6: [2, 3], 8: [2, 4], 9: [3, 3] };

/** 선화가 있는 단어만 쓴다(없는 단어는 skipped 로 돌려줘서 화면에 알려준다). */
export function buildColoringPages(words: FullCardItem[], rng: Rng, options: ColoringOptions) {
  const usable: { word: string; src: string }[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const src = lineartUrlForWord(w.word);
    if (!src) {
      skipped.push(w.word);
      continue;
    }
    if (seen.has(src)) continue;
    seen.add(src);
    usable.push({ word: w.word, src });
  }
  const [cols, rows] = COLORING_GRID[options.perPage];
  const candidates = decorIdsFor(options.decorTheme);
  const pages: ColoringPage[] = chunk(usable, options.perPage).map((items) => {
    const pool = shuffled(candidates, rng);
    // 부품 수가 자리보다 적으면 앞에서부터 돌려 쓴다(같은 부품이 여러 자리에 나올 수 있다).
    const decor = pool.length === 0 ? [] : Array.from({ length: 5 }, (_, i) => pool[i % pool.length]);
    return { items, cols, rows, decor };
  });
  return { pages, skipped };
}


/* ---------------- 문장 순서 바꾸기 ---------------- */

export interface SentenceRow {
  /** 섞인 낱말들 */
  tokens: string[];
  /** 정답 문장(끝 구두점 포함) */
  answer: string;
}

/** 예문을 낱말로 쪼갠다. 3~9낱말인 문장만 쓴다(너무 짧거나 길면 순서 맞추기가 안 된다). 끝 구두점은 뗀다. */
export function sentenceTokens(example: string | null | undefined): string[] | null {
  const text = (example ?? '').normalize('NFKC').trim();
  if (!text) return null;
  const tokens = text.replace(/[.!?]+$/u, '').split(/\s+/).filter(Boolean);
  return tokens.length >= 3 && tokens.length <= 9 ? tokens : null;
}

export function buildSentencePages(words: FullCardItem[], rng: Rng, perPage = 7): SentenceRow[][] {
  const rows: SentenceRow[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const tokens = sentenceTokens(w.example);
    if (!tokens || seen.has(tokens.join(' '))) continue;
    seen.add(tokens.join(' '));
    let order = shuffled(tokens, rng);
    for (let i = 0; i < 20 && order.join(' ') === tokens.join(' '); i++) order = shuffled(tokens, rng);
    rows.push({ tokens: order, answer: (w.example ?? '').trim() });
  }
  return chunk(rows, perPage);
}

/* ---------------- 객관식 / 참·거짓 공통 ---------------- */

/** 그림이 있으면 "그림 ↔ 단어", 없으면 "단어 ↔ 뜻"으로 묻는다. 둘 다 없는 단어는 뺀다. */
export function choiceUsable(words: FullCardItem[]): FullCardItem[] {
  return words.filter((w) => w.word && (w.imageUrl || w.meaning));
}

function pickDistractors(pool: string[], correct: string, count: number, rng: Rng): string[] {
  const unique = [...new Set(pool.filter((p) => p && p.toLowerCase() !== correct.toLowerCase()))];
  return shuffled(unique, rng).slice(0, count);
}

/* ---------------- 객관식 ---------------- */

export interface ChoiceRow {
  imageUrl: string | null;
  /** 그림이 없을 때 물어볼 단어 */
  prompt: string;
  /** 그림이 있고 예문에 그 단어가 들어 있으면 그 자리를 비운 문장(그림이 정답을 하나로 정해준다). */
  sentence: string | null;
  choices: string[];
  correct: number;
}

/** 예문에서 단어(통째로 일치, 대소문자 무시)를 빈칸으로 바꾼다. 못 찾으면(변형형 등) null. */
export function blankOutWord(example: string | null | undefined, word: string): string | null {
  const text = (example ?? '').trim();
  if (!text || !word.trim() || /\s/.test(word.trim())) return null;
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}])(${escaped})(?![\\p{L}])`, 'iu');
  return re.test(text) ? text.replace(re, '$1_______') : null;
}

export function buildChoicePages(words: FullCardItem[], rng: Rng, perPage = 6): ChoiceRow[][] {
  const usable = choiceUsable(words);
  if (usable.length < 3) return [];
  const allWords = usable.map((w) => w.word);
  const allMeanings = usable.map((w) => w.meaning).filter(Boolean);
  const rows: ChoiceRow[] = usable.map((w) => {
    const imageMode = !!w.imageUrl;
    const correct = imageMode ? w.word : w.meaning;
    const wrong = pickDistractors(imageMode ? allWords : allMeanings, correct, 2, rng);
    const choices = shuffled([correct, ...wrong], rng);
    return {
      imageUrl: imageMode ? w.imageUrl : null,
      prompt: imageMode ? '' : w.word,
      sentence: imageMode ? blankOutWord(w.example, w.word) : null,
      choices,
      correct: choices.indexOf(correct),
    };
  });
  return chunk(rows, perPage);
}

/* ---------------- 참·거짓 ---------------- */

export interface TrueFalseRow {
  imageUrl: string | null;
  /** 그림이 없을 때 위에 보여줄 단어 */
  prompt: string;
  /** 그림(또는 단어) 옆에 붙는 말 — 맞는 짝이거나 다른 단어의 것 */
  shown: string;
  answer: boolean;
}

export function buildTrueFalsePages(words: FullCardItem[], rng: Rng, perPage = 8): TrueFalseRow[][] {
  const usable = choiceUsable(words);
  if (usable.length < 2) return [];
  const allWords = usable.map((w) => w.word);
  const allMeanings = usable.map((w) => w.meaning).filter(Boolean);
  // 참/거짓이 한쪽으로 쏠리지 않게 절반씩 배정한 뒤 섞는다.
  const flags = shuffled(usable.map((_, i) => i % 2 === 0), rng);
  const rows: TrueFalseRow[] = usable.map((w, i) => {
    const imageMode = !!w.imageUrl;
    const correct = imageMode ? w.word : w.meaning;
    let shown = correct;
    let answer = true;
    if (!flags[i]) {
      const other = pickDistractors(imageMode ? allWords : allMeanings, correct, 1, rng)[0];
      if (other) {
        shown = other;
        answer = false;
      }
    }
    return { imageUrl: imageMode ? w.imageUrl : null, prompt: imageMode ? '' : w.word, shown, answer };
  });
  return chunk(shuffled(rows, rng), perPage);
}


/* ---------------- 3차: 미니북 ---------------- */

export interface MiniBookPanel {
  word: string;
  meaning: string;
  imageUrl: string | null;
  example: string | null;
}

export interface MiniBook {
  title: string;
  coverImage: string | null;
  /** 2~7쪽에 들어갈 단어(최대 6개, 모자라면 뒤는 null = 그림·쓰기 칸) */
  pages: (MiniBookPanel | null)[];
}

/** 한 장(A4 가로)을 접어 만드는 8쪽 미니북. 표지 + 단어 6쪽 + 뒷표지. 단어가 6개를 넘으면 책이 여러 권이 된다. */
export function buildMiniBooks(words: FullCardItem[], rng: Rng, title: string): MiniBook[] {
  void rng;
  const usable = words.filter((w) => w.word);
  return chunk(usable, 6).map((group) => ({
    title,
    coverImage: group.find((w) => w.imageUrl)?.imageUrl ?? null,
    pages: Array.from({ length: 6 }, (_, i) => {
      const w = group[i];
      return w ? { word: w.word, meaning: w.meaning, imageUrl: w.imageUrl, example: w.example ?? null } : null;
    }),
  }));
}

/* ---------------- 3차: 짝 인터뷰 (Ask & Answer) ---------------- */

export type AskTemplate = 'like' | 'have' | 'see';

export interface AskRow {
  word: string;
  imageUrl: string | null;
}

export function buildAskPages(words: FullCardItem[], perPage = 8): AskRow[][] {
  return chunk(
    words.filter((w) => w.word).map((w) => ({ word: w.word, imageUrl: w.imageUrl })),
    perPage,
  );
}

/* ---------------- 3차: 보드게임 ---------------- */

export type BoardCell =
  | { n: number; kind: 'start' | 'finish' | 'again' | 'back' | 'skip' }
  | { n: number; kind: 'word'; word: string; imageUrl: string | null };

export const BOARD_COLS = 5;
export const BOARD_ROWS = 6;

/** 5×6 = 30칸 뱀 모양 보드. 칸 번호는 1(START)~30(FINISH)이고 사이 칸에 단어를 돌려 넣는다. 단어 3개 이상 필요. */
export function buildBoardGame(words: FullCardItem[], rng: Rng): BoardCell[] | null {
  const usable = words.filter((w) => w.word);
  if (usable.length < 3) return null;
  const total = BOARD_COLS * BOARD_ROWS;
  const special: Record<number, 'again' | 'back' | 'skip'> = { 8: 'again', 14: 'back', 20: 'skip', 24: 'again', 27: 'back' };
  const cells: BoardCell[] = [];
  let bag: FullCardItem[] = [];
  for (let n = 1; n <= total; n++) {
    if (n === 1) cells.push({ n, kind: 'start' });
    else if (n === total) cells.push({ n, kind: 'finish' });
    else if (special[n]) cells.push({ n, kind: special[n] });
    else {
      if (bag.length === 0) {
        bag = shuffled(usable, rng);
        // 새로 섞은 첫 낱말이 바로 앞 칸과 같지 않게 한다.
        const prev = cells[cells.length - 1];
        if (prev?.kind === 'word' && bag[bag.length - 1].word === prev.word) bag.unshift(bag.pop()!);
      }
      const w = bag.pop()!;
      cells.push({ n, kind: 'word', word: w.word, imageUrl: w.imageUrl });
    }
  }
  return cells;
}

/* ---------------- 3차: 문장 읽고 잇기 (Read & Match) ---------------- */

/** 예문(왼쪽) ↔ 그림(오른쪽). 그림과 예문이 둘 다 있는 단어만 쓴다. */
export function buildReadMatchPages(words: FullCardItem[], rng: Rng, perPage = 5): MatchPage[] {
  const usable = words.filter((w) => w.imageUrl && (w.example ?? '').trim());
  return chunk(usable, perPage).map((rows) => {
    const order = shuffled(
      rows.map((_, i) => i),
      rng,
    );
    return {
      left: rows.map((r) => ({ image: null, text: (r.example ?? '').trim() })),
      right: order.map((i) => ({ image: rows[i].imageUrl, text: '' })),
      answer: rows.map((_, i) => order.indexOf(i)),
    };
  });
}

export const NEW_WORKSHEET_KINDS = [
  'coloring',
  'match',
  'wordSearch',
  'unscramble',
  'fillBlank',
  'grouping',
  'cutPaste',
  'sentence',
  'multipleChoice',
  'trueFalse',
  'miniBook',
  'askAnswer',
  'boardGame',
  'readMatch',
] as const;
export type NewWorksheetKind = (typeof NEW_WORKSHEET_KINDS)[number];

export type WorksheetData =
  | { kind: 'coloring'; pages: ColoringPage[]; skipped: string[]; options: ColoringOptions }
  | { kind: 'match'; pages: MatchPage[] }
  | { kind: 'wordSearch'; pages: WordSearchPage[] }
  | { kind: 'unscramble'; pages: UnscrambleRow[][] }
  | { kind: 'fillBlank'; pages: BlankRow[][] }
  | { kind: 'grouping'; sheet: GroupingSheet | null }
  | { kind: 'cutPaste'; pages: CutPastePage[] }
  | { kind: 'sentence'; pages: SentenceRow[][] }
  | { kind: 'multipleChoice'; pages: ChoiceRow[][] }
  | { kind: 'trueFalse'; pages: TrueFalseRow[][] }
  | { kind: 'miniBook'; books: MiniBook[] }
  | { kind: 'askAnswer'; pages: AskRow[][]; template: AskTemplate }
  | { kind: 'boardGame'; cells: BoardCell[] | null; title: string }
  | { kind: 'readMatch'; pages: MatchPage[] };

export interface WorksheetOptions {
  coloring?: ColoringOptions;
  /** 미니북·보드게임 제목(색칠하기 제목 입력칸과 같은 값을 쓴다) */
  sheetTitle?: string;
  askTemplate?: AskTemplate;
}

export function buildWorksheet(
  kind: NewWorksheetKind,
  words: FullCardItem[],
  seed: number,
  options: WorksheetOptions = {},
): WorksheetData {
  const rng = makeRng(seed);
  switch (kind) {
    case 'coloring': {
      const coloring = options.coloring ?? DEFAULT_COLORING_OPTIONS;
      return { kind, ...buildColoringPages(words, rng, coloring), options: coloring };
    }
    case 'match':
      return { kind, pages: buildMatchPages(words, rng) };
    case 'wordSearch':
      return { kind, pages: buildWordSearchPages(words, rng) };
    case 'unscramble':
      return { kind, pages: buildUnscramblePages(words, rng) };
    case 'fillBlank':
      return { kind, pages: buildFillBlankPages(words, rng) };
    case 'grouping':
      return { kind, sheet: buildGroupingSheet(words, rng) };
    case 'cutPaste':
      return { kind, pages: buildCutPastePages(words, rng) };
    case 'sentence':
      return { kind, pages: buildSentencePages(words, rng) };
    case 'multipleChoice':
      return { kind, pages: buildChoicePages(words, rng) };
    case 'trueFalse':
      return { kind, pages: buildTrueFalsePages(words, rng) };
    case 'miniBook':
      return { kind, books: buildMiniBooks(words, rng, options.sheetTitle || 'My Mini Book') };
    case 'askAnswer':
      return { kind, pages: buildAskPages(words), template: options.askTemplate ?? 'like' };
    case 'boardGame':
      return { kind, cells: buildBoardGame(words, rng), title: options.sheetTitle || 'Board Game' };
    case 'readMatch':
      return { kind, pages: buildReadMatchPages(words, rng) };
  }
}

export function isWorksheetEmpty(data: WorksheetData): boolean {
  if (data.kind === 'grouping') return data.sheet === null;
  if (data.kind === 'miniBook') return data.books.length === 0;
  if (data.kind === 'boardGame') return data.cells === null;
  return data.pages.length === 0;
}

/** 비어 있을 때 보여줄 안내문 i18n 키(materials.worksheet.<키>). */
export const EMPTY_HINT_KEY: Record<NewWorksheetKind, string> = {
  coloring: 'needLineart',
  match: 'needMatchable',
  wordSearch: 'needLetterWords',
  unscramble: 'needLetterWords',
  fillBlank: 'needLetterWords',
  grouping: 'needCategories',
  cutPaste: 'needImages',
  sentence: 'needSentences',
  multipleChoice: 'needChoices',
  trueFalse: 'needTwoChoices',
  miniBook: 'needAtLeastOne',
  askAnswer: 'needAtLeastOne',
  boardGame: 'needThreeWords',
  readMatch: 'needReadMatch',
};
