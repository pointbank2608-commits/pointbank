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

export const NEW_WORKSHEET_KINDS = ['coloring', 'match', 'wordSearch', 'unscramble', 'fillBlank', 'grouping', 'cutPaste'] as const;
export type NewWorksheetKind = (typeof NEW_WORKSHEET_KINDS)[number];

export type WorksheetData =
  | { kind: 'coloring'; pages: ColoringPage[]; skipped: string[]; options: ColoringOptions }
  | { kind: 'match'; pages: MatchPage[] }
  | { kind: 'wordSearch'; pages: WordSearchPage[] }
  | { kind: 'unscramble'; pages: UnscrambleRow[][] }
  | { kind: 'fillBlank'; pages: BlankRow[][] }
  | { kind: 'grouping'; sheet: GroupingSheet | null }
  | { kind: 'cutPaste'; pages: CutPastePage[] };

export interface WorksheetOptions {
  coloring?: ColoringOptions;
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
  }
}

export function isWorksheetEmpty(data: WorksheetData): boolean {
  return data.kind === 'grouping' ? data.sheet === null : data.pages.length === 0;
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
};
