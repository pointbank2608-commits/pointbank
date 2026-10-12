import { evenIndexes, type SoloStep, type WriteCondition } from './soloLessons';
import { GRAMMAR_POINTS, plainText, type GrammarPoint } from './grammar';
import type { TextLine } from './textBlocks';

/**
 * 영작 블록(2026-10-12) — 우리말 해석이 있는 영어 문장에서 두 가지 쓰기 문제를 만든다(AI 없음).
 *  - 단어 배열 영작(orderWrite): 우리말 뜻 + 섞인 낱말 → 학생이 영어 문장을 쓴다(낱말 칸을 눌러 이어 붙이거나 직접 쓴다).
 *  - 조건 영작(condWrite): 우리말 + 조건(단어 수·꼭 쓸 낱말·문장 틀 안내) → 조건에 맞게 쓴다.
 *    서버는 낱말·단어 수만 자동 검사하고, 의미가 맞는지는 예시 답을 보고 선생님이 확인한다.
 * 재료: ① 문법 항목의 예문과 해석(검수됨, translations) ② 선생님이 붙여 넣은 가사·대사 중 해석(| 뒤)이 있는 줄.
 */

export interface TranslatedSentence {
  en: string;
  ko: string;
  /** 문법 항목의 문장 틀(조건 영작의 안내 조건용) */
  pattern?: string;
  source: string;
}

const STOP = new Set(
  `a an the and or but so to of in on at for with from by is am are was were be been being do does did have has had i you he she it we they me him her us them my your his its our their this that these those there here not no yes can will would should could may might must just very too also`.split(/\s+/),
);

/** 해석 끝의 역할 메모 "(주격)" 을 뗀다 */
const cleanKo = (s: string): string => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** 문법 항목들의 예문 + 해석 */
export function sentencesFromPoints(points: GrammarPoint[]): TranslatedSentence[] {
  const out: TranslatedSentence[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const tr = p.translations ?? [];
    p.examples.forEach((ex, i) => {
      const en = plainText(ex).replace(/\s+/g, ' ').trim();
      const ko = cleanKo(tr[i] ?? '');
      const words = en.split(/\s+/).filter(Boolean).length;
      if (!en || !ko || words < 3 || words > 14) return;
      const key = en.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ en, ko, pattern: plainText(p.pattern), source: p.name });
    });
  }
  return out;
}

/** 선생님이 붙여 넣은 줄 중 해석이 있는 줄 */
export function sentencesFromLines(lines: TextLine[]): TranslatedSentence[] {
  return lines
    .filter((l) => l.ko.trim() && l.en.split(/\s+/).filter(Boolean).length >= 3 && l.en.split(/\s+/).length <= 14)
    .map((l) => ({ en: l.en.replace(/\s+/g, ' ').trim(), ko: l.ko.trim(), source: '' }));
}

/** 낱말 칸: 문장부호는 떼고 낱말만(대소문자는 그대로) */
export function wordTokens(sentence: string): string[] {
  return sentence
    .replace(/\s+\/\s+.*$/, '')
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, ''))
    .filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(all: T[], count: number): T[] {
  return all.length <= count ? all : evenIndexes(all.length, count).map((i) => all[i]);
}

/** 단어 배열 영작 문제들 */
export function buildOrderWriteSteps(sentences: TranslatedSentence[], count: number): SoloStep[] {
  return pick(sentences, count).map((s): SoloStep => {
    const toks = wordTokens(s.en);
    let words = shuffle(toks);
    for (let i = 0; i < 8 && words.join('|') === toks.join('|'); i++) words = shuffle(toks);
    return { t: 'orderWrite', ko: s.ko, words, answer: s.en };
  });
}

/** 조건 영작의 조건: 단어 수(±1) + 꼭 쓸 낱말 1~2개 + (있으면) 문장 틀 안내 */
export function conditionsFor(s: TranslatedSentence): WriteCondition[] {
  const toks = wordTokens(s.en);
  const n = toks.length;
  const conds: WriteCondition[] = [{ text: `${Math.max(1, n - 1)}~${n + 1}단어로 쓸 것`, min: Math.max(1, n - 1), max: n + 1 }];
  const content = toks.filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  const must = [...new Set(content.map((w) => w.toLowerCase()))];
  const chosen = must.length <= 2 ? must : [must[0], must[must.length - 1]];
  for (const w of chosen) conds.push({ text: `꼭 쓸 낱말: ${w}`, words: [w] });
  if (s.pattern) conds.push({ text: `문장 틀: ${s.pattern}` });
  return conds;
}

/** 조건 영작 문제들 */
export function buildCondWriteSteps(sentences: TranslatedSentence[], count: number): SoloStep[] {
  return pick(sentences, count).map((s): SoloStep => ({ t: 'condWrite', ko: s.ko, conditions: conditionsFor(s), model: s.en }));
}

/** 문법 항목 id → 영작 재료 문장 */
export function sentencesForPointIds(ids: string[]): TranslatedSentence[] {
  const points = ids.map((id) => GRAMMAR_POINTS.find((g) => g.id === id)).filter((p): p is GrammarPoint => !!p);
  return sentencesFromPoints(points);
}

/** 해석이 있는 예문이 있는 문법 항목의 문장 수 */
export const writeSentenceCount = (p: GrammarPoint): number => sentencesFromPoints([p]).length;
