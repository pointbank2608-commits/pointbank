/**
 * 전자칠판(2026-10-24) 순수 로직 — 오늘 수업 자료(단어·문장)를 카드로 만들고, 칠판 도구(퀴즈·예문 읽기)가 쓸 재료를 계산한다.
 * 화면은 pages/WhiteboardPage.tsx 와 components/board/*. 서버·DB 변경은 없다(자료는 이 탭 sessionStorage 에만 남긴다).
 */
import type { FullCardItem, WordBankEntry } from './types';
import { parsePastedWords } from './quickLesson';

export type BoardKind = 'word' | 'sentence';
export interface BoardMaterial {
  cards: FullCardItem[];
  kind: BoardKind;
}

export const BOARD_MATERIAL_KEY = 'classbank.board.material.v1';
export const BOARD_RETURN_KEY = 'classbank.board.return.v1';
export const BOARD_THEME_KEY = 'classbank.board.theme.v1';
export const BOARD_STROKES_KEY = 'classbank.board.strokes.v1';

/** 낱말이 3개 이상 이어진 줄이 절반을 넘으면 문장 자료 */
export function detectKind(cards: readonly FullCardItem[]): BoardKind {
  if (!cards.length) return 'word';
  const longs = cards.filter((c) => c.word.trim().split(/\s+/).length >= 3).length;
  return longs * 2 > cards.length ? 'sentence' : 'word';
}

/** 붙여넣은 글 → 카드. 한 줄에 하나: `apple 사과`·`apple | 사과`·`I like apples. | 나는 사과를 좋아해요`·영어만 */
export function parseBoardText(text: string, bank: WordBankEntry[] = []): BoardMaterial {
  const cards = parsePastedWords(text, bank).slice(0, 60);
  return { cards, kind: detectKind(cards) };
}

/** 문장 은행·단어장에서 담은 `영어 | 해석` 줄들 */
export function cardsFromLines(lines: readonly string[]): FullCardItem[] {
  return parsePastedWords(lines.join('\n'), []).slice(0, 60);
}

export function mergeCards(a: readonly FullCardItem[], b: readonly FullCardItem[]): FullCardItem[] {
  const seen = new Set(a.map((c) => c.word.trim().toLowerCase()));
  const out = [...a];
  for (const c of b) {
    const k = c.word.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out.slice(0, 60);
}

export const BOARD_SAMPLE_WORDS = ['apple | 사과', 'banana | 바나나', 'cat | 고양이', 'dog | 강아지', 'book | 책', 'sun | 해'];

/* ---------------- 저장(이 탭에서만) ---------------- */

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 못 해도 이번 화면에서는 그대로 쓴다 */
  }
}

export function loadBoardMaterial(): BoardMaterial | null {
  const m = readJson<BoardMaterial>(BOARD_MATERIAL_KEY);
  if (!m || !Array.isArray(m.cards)) return null;
  const cards = m.cards.filter((c) => c && typeof c.word === 'string' && c.word.trim());
  return cards.length ? { cards, kind: detectKind(cards) } : null;
}
export function saveBoardMaterial(m: BoardMaterial | null) {
  try {
    if (!m || !m.cards.length) sessionStorage.removeItem(BOARD_MATERIAL_KEY);
    else writeJson(BOARD_MATERIAL_KEY, m);
  } catch {
    /* 무시 */
  }
}

/** 칠판에서 게임·활동지로 나갔다가 "칠판으로 돌아가기" 띠를 보여 주기 위한 표시 */
export function markBoardReturn() {
  writeJson(BOARD_RETURN_KEY, { at: Date.now() });
}
export function hasBoardReturn(): boolean {
  const v = readJson<{ at: number }>(BOARD_RETURN_KEY);
  return !!v && Date.now() - v.at < 6 * 60 * 60 * 1000;
}
export function clearBoardReturn() {
  try {
    sessionStorage.removeItem(BOARD_RETURN_KEY);
  } catch {
    /* 무시 */
  }
}

/* ---------------- 퀴즈 ---------------- */

export interface BoardQuestion {
  id: string;
  /** 문제로 보여 줄 영어 */
  prompt: string;
  /** 보기(우리말 뜻) */
  choices: string[];
  correct: number;
}

export type Rng = () => number;

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 영어 → 우리말 뜻 고르기. 뜻이 있는 카드만 쓰고, 보기는 같은 자료의 다른 뜻에서 뽑는다(같은 뜻은 한 번).
 * 뜻이 서로 다른 카드가 2개 미만이면 만들 수 없다(빈 배열).
 */
export function buildBoardQuiz(cards: readonly FullCardItem[], count = 8, rng: Rng = Math.random): BoardQuestion[] {
  const usable = cards.filter((c) => c.word.trim() && c.meaning.trim());
  const meanings = [...new Set(usable.map((c) => c.meaning.trim()))];
  if (usable.length < 2 || meanings.length < 2) return [];
  const picks = shuffled(usable, rng).slice(0, Math.max(1, count));
  return picks.map((card) => {
    const right = card.meaning.trim();
    const wrong = shuffled(
      meanings.filter((m) => m !== right),
      rng,
    ).slice(0, Math.min(3, meanings.length - 1));
    const choices = shuffled([right, ...wrong], rng);
    return { id: card.id, prompt: card.word.trim(), choices, correct: choices.indexOf(right) };
  });
}

export function quizScoreText(correct: number, total: number): string {
  return `${correct} / ${total}`;
}
