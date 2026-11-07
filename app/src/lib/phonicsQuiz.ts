/**
 * 파닉스 퀴즈 문제 자동 만들기(2026-11-08) — 파닉스에서 담은 단어(소리 규칙 글자를 {}로 표시한 patternMarked + 규칙 이름 category)로
 * 규칙 기반 4지선다 문제를 만든다(AI 없음). 퀴즈·팀 대항 퀴즈·점수 걸기 퀴즈·줄다리기 대결이 같은 문제 구조(QuizQuestion)를 쓴다.
 *
 * 문제 종류
 *  - blank   : 소리 규칙 글자를 가린 낱말에서 빈칸에 들어갈 글자 고르기  (r__n → ai)
 *  - sameRule: 같은 소리 규칙이 들어간 낱말 고르기
 *  - rhyme   : 라임(끝소리)이 같은 낱말 고르기
 *  - odd     : 소리 규칙이 다른 하나 찾기
 * 재료가 모자란 종류는 건너뛰고, 낱말마다 종류를 돌려 가며 만든다.
 */
import { markedGroups, parsePattern, rimeOf } from './phonicsPattern';
import type { QuizQuestion } from './types';

export interface PhonicsCard {
  id: string;
  word: string;
  meaning?: string | null;
  category?: string | null;
  patternMarked?: string | null;
}

export type PhonicsQuestionKind = 'blank' | 'sameRule' | 'rhyme' | 'odd';
export type Rng = () => number;

const KINDS: PhonicsQuestionKind[] = ['blank', 'sameRule', 'rhyme', 'blank', 'odd'];
/** 오답을 채울 때 쓰는 흔한 소리 글자(같은 글자 수끼리만 섞는다) */
const FILLER = ['a', 'e', 'i', 'o', 'u', 'ai', 'ay', 'ee', 'ea', 'oa', 'ow', 'oo', 'sh', 'ch', 'th', 'ck', 'ar', 'or', 'er', 'ou', 'oi', 'ie'];
export const PHONICS_MAX_QUESTIONS = 40;

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) => s.trim().toLowerCase();

/** 파닉스 단어 목록인지(소리 규칙 표기가 있는 낱말이 60% 이상이고 4개 이상) */
export function isPhonicsCards(cards: readonly PhonicsCard[]): boolean {
  const usable = cards.filter((c) => c.word.trim());
  if (usable.length < 4) return false;
  const marked = usable.filter((c) => markedGroups(c.patternMarked).length > 0).length;
  return marked >= Math.ceil(usable.length * 0.6);
}

const groupKey = (c: PhonicsCard) => markedGroups(c.patternMarked).join(' … ');
const ruleKey = (c: PhonicsCard) => norm(c.category?.trim() || groupKey(c));

/** 규칙 글자를 빈칸으로 가린 낱말(r{ai}n → r__n, b{a}k{e} → b__k__) */
export function maskPattern(pattern: string): string {
  return parsePattern(pattern)
    .map((p) => (p.marked ? '__' : p.text))
    .join('');
}

function finish(id: string, question: string, answer: string, wrong: string[], rng: Rng): QuizQuestion | null {
  const seen = new Set([norm(answer)]);
  const picks: string[] = [];
  for (const w of wrong) {
    if (!w.trim() || seen.has(norm(w))) continue;
    seen.add(norm(w));
    picks.push(w);
    if (picks.length >= 3) break;
  }
  if (picks.length < 3) return null;
  const choices = shuffle([answer, ...picks], rng);
  return { id, question, choices, correctIndex: choices.indexOf(answer) };
}

function blankQuestion(c: PhonicsCard, all: readonly PhonicsCard[], id: string, rng: Rng): QuizQuestion | null {
  const groups = markedGroups(c.patternMarked);
  if (groups.length === 0 || !c.patternMarked) return null;
  const answer = groups.join(' … ');
  const pool = new Set<string>();
  for (const o of all) {
    const g = markedGroups(o.patternMarked);
    if (g.length === groups.length && o.id !== c.id) pool.add(g.join(' … '));
  }
  // 같은 글자 수의 흔한 소리 글자로 오답을 더 만든다
  const fabricated: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    fabricated.push(
      groups
        .map((g) => {
          const same = FILLER.filter((f) => f.length === g.length && f !== g.toLowerCase());
          return same.length ? same[Math.floor(rng() * same.length)] : g;
        })
        .join(' … '),
    );
  }
  const wrong = shuffle([...pool, ...fabricated], rng).filter((w) => norm(w) !== norm(answer));
  const hint = c.meaning?.trim() ? `  (${c.meaning.trim()})` : '';
  const q = finish(id, `빈칸에 들어갈 소리 글자는?\n${maskPattern(c.patternMarked)}${hint}`, answer, wrong, rng);
  return q;
}

function sameRuleQuestion(c: PhonicsCard, all: readonly PhonicsCard[], id: string, rng: Rng): QuizQuestion | null {
  const rule = ruleKey(c);
  if (!rule) return null;
  const peers = all.filter((o) => o.id !== c.id && ruleKey(o) === rule && norm(o.word) !== norm(c.word));
  const others = all.filter((o) => ruleKey(o) && ruleKey(o) !== rule);
  if (peers.length === 0 || others.length < 3) return null;
  const answer = shuffle(peers, rng)[0].word.trim();
  // 알파벳 단계(규칙 이름이 글자 하나)는 첫소리가 같은 낱말을 묻는다
  const first = rule.length === 1;
  return finish(id, first ? `'${c.word.trim()}'처럼 첫소리가 같은 낱말은?` : `'${c.word.trim()}'처럼 같은 소리 규칙이 들어간 낱말은?`, answer, shuffle(others, rng).map((o) => o.word.trim()), rng);
}

function rhymeQuestion(c: PhonicsCard, all: readonly PhonicsCard[], id: string, rng: Rng): QuizQuestion | null {
  const rime = rimeOf(c.word);
  if (!rime) return null;
  const peers = all.filter((o) => o.id !== c.id && norm(o.word) !== norm(c.word) && rimeOf(o.word) === rime);
  const others = all.filter((o) => {
    const r = rimeOf(o.word);
    return !!r && r !== rime;
  });
  if (peers.length === 0 || others.length < 3) return null;
  const answer = shuffle(peers, rng)[0].word.trim();
  return finish(id, `'${c.word.trim()}'처럼 끝소리(라임)가 같은 낱말은?`, answer, shuffle(others, rng).map((o) => o.word.trim()), rng);
}

function oddQuestion(c: PhonicsCard, all: readonly PhonicsCard[], id: string, rng: Rng): QuizQuestion | null {
  const rule = ruleKey(c);
  if (!rule) return null;
  const same = all.filter((o) => ruleKey(o) === rule);
  const others = all.filter((o) => ruleKey(o) && ruleKey(o) !== rule);
  if (same.length < 3 || others.length < 1) return null;
  const group = shuffle(same, rng).slice(0, 3).map((o) => o.word.trim());
  const odd = shuffle(others, rng)[0].word.trim();
  if (group.some((w) => norm(w) === norm(odd))) return null;
  const choices = shuffle([odd, ...group], rng);
  return { id, question: rule.length === 1 ? '첫소리가 다른 하나는?' : '소리 규칙이 다른 하나는?', choices, correctIndex: choices.indexOf(odd) };
}

/**
 * 파닉스 단어 목록으로 문제를 만든다. 낱말마다 종류를 돌려 가며 시도하고, 재료가 모자란 종류는 건너뛴다.
 * 같은 문제 글은 한 번만 나온다. 파닉스 단어 목록이 아니면 빈 배열.
 */
export function buildPhonicsQuestions(cards: readonly PhonicsCard[], rng: Rng = Math.random, max = PHONICS_MAX_QUESTIONS): QuizQuestion[] {
  const usable = cards.filter((c) => c.word.trim());
  if (!isPhonicsCards(usable)) return [];
  const out: QuizQuestion[] = [];
  const seen = new Set<string>();
  const order = shuffle(usable, rng);
  let rotation = 0;
  for (const c of order) {
    if (out.length >= max) break;
    for (let t = 0; t < KINDS.length; t += 1) {
      const kind = KINDS[(rotation + t) % KINDS.length];
      const id = `ph-${out.length}-${c.id}`;
      const q =
        kind === 'blank' ? blankQuestion(c, usable, id, rng)
        : kind === 'sameRule' ? sameRuleQuestion(c, usable, id, rng)
        : kind === 'rhyme' ? rhymeQuestion(c, usable, id, rng)
        : oddQuestion(c, usable, id, rng);
      if (!q) continue;
      const key = `${q.question}|${q.choices[q.correctIndex]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
      rotation = (rotation + t + 1) % KINDS.length;
      break;
    }
  }
  return out;
}
