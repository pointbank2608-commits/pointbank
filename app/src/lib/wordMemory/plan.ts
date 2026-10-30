/**
 * 단어암기숙제 배정 화면용 순수 계산 — 서버 규칙(wm-v1)과 같은 숫자를 쓰되, 시간은 "약"으로만 보여 준다(학생마다 다르다).
 *  · 하루 문항(상한): 가볍게 12 · 보통 20 / 새 낱말: 3 · 5 / 어려운 낱말 다시 묻기 몫: 2 · 4
 */
import type { FullCardItem } from '../types';
import type { WmCard, WmDailyMode } from './types';

export const WM_RULE_VERSION = 'wm-v1';
export const WM_MIN_WORDS = 4;
export const WM_MAX_WORDS = 1000;

export interface DailyBudget {
  asks: number;
  newMax: number;
  retryReserve: number;
}

export const dailyBudget = (mode: WmDailyMode): DailyBudget => (mode === 'light' ? { asks: 12, newMax: 3, retryReserve: 2 } : mode === 'plus' ? { asks: 30, newMax: 10, retryReserve: 5 } : { asks: 20, newMax: 5, retryReserve: 4 });

/** 서버 wm_key 와 같은 열쇠(낱말|뜻, 소문자·공백 정리) */
export const cardKey = (word: string, meaning: string) => `${word.trim().replace(/\s+/g, ' ').toLowerCase()}|${meaning.trim().replace(/\s+/g, ' ').toLowerCase()}`;

/** 단어장 카드 → 배정용 카드(낱말·뜻이 모두 있는 것만, 같은 낱말|뜻은 한 번) */
export function toWmCards(cards: readonly FullCardItem[]): WmCard[] {
  const seen = new Set<string>();
  const out: WmCard[] = [];
  for (const c of cards) {
    const word = (c.word ?? '').trim();
    const meaning = (c.meaning ?? '').trim();
    if (!word || !meaning) continue;
    const k = cardKey(word, meaning);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ word, meaning, pos: c.partOfSpeech ?? null, imageUrl: c.imageUrl ?? null, example: c.example ?? null });
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 서버가 빈칸 문제를 만들 수 있는 예문인지(낱말이 활용형 아닌 그대로 들어 있을 때) */
export function canMakeBlank(card: WmCard): boolean {
  const ex = (card.example ?? '').trim();
  const word = card.word.trim();
  if (!ex) return false;
  // 서버(\m…\M)와 같다: 낱말의 처음·끝이 글자·숫자가 아니면 경계를 잡을 수 없어 빈칸을 만들지 않는다
  if (!/^[\p{L}\p{N}_]/u.test(word) || !/[\p{L}\p{N}_]$/u.test(word)) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRe(card.word.trim())}($|[^\\p{L}\\p{N}_])`, 'iu').test(ex);
}

export interface CardAnalysis {
  total: number;
  withImage: number;
  withExample: number;
  /** 예문이 있어도 낱말이 활용형이라 빈칸을 못 만드는 수 */
  exampleUnusable: number;
  blankUsable: number;
  /** 글자 배열을 만들 수 있는 낱말(글자 3개 이상) */
  lettersUsable: number;
  /** 같은 철자·다른 뜻 묶음 수 */
  homographs: number;
  issues: ('too_few' | 'too_many')[];
}

export function analyzeCards(cards: readonly WmCard[]): CardAnalysis {
  const withImage = cards.filter((c) => (c.imageUrl ?? '').trim()).length;
  const withExample = cards.filter((c) => (c.example ?? '').trim()).length;
  const blankUsable = cards.filter(canMakeBlank).length;
  const lettersUsable = cards.filter((c) => (c.word.includes(' ') ? c.word.split(' ').length : c.word.length) >= 3).length;
  const byWord = new Map<string, number>();
  for (const c of cards) byWord.set(c.word.trim().toLowerCase(), (byWord.get(c.word.trim().toLowerCase()) ?? 0) + 1);
  const homographs = [...byWord.values()].filter((n) => n > 1).length;
  const issues: CardAnalysis['issues'] = [];
  if (cards.length < WM_MIN_WORDS) issues.push('too_few');
  if (cards.length > WM_MAX_WORDS) issues.push('too_many');
  return { total: cards.length, withImage, withExample, exampleUnusable: withExample - blankUsable, blankUsable, lettersUsable, homographs, issues };
}

/** 낱말을 모두 소개하는 데 걸리는 날 수(새 낱말 상한 기준) */
export const introDays = (words: number, mode: WmDailyMode) => Math.max(1, Math.ceil(words / dailyBudget(mode).newMax));

/** 공부 기간 기본값: 소개에 걸리는 날 + 여유, 7~240일 */
export const defaultStudyDays = (words: number, mode: WmDailyMode) => Math.min(240, Math.max(7, introDays(words, mode) + 3));

/** 하루 문항 한 개에 15~30초쯤 걸린다고 어림한 분(학생마다 다르다 — 정확한 시간이 아니다) */
export function estimateMinutes(mode: WmDailyMode): { min: number; max: number } {
  const asks = dailyBudget(mode).asks;
  return { min: Math.max(2, Math.round((asks * 15) / 60)), max: Math.round((asks * 30) / 60) };
}
