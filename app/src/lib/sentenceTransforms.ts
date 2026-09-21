/**
 * 수박 문장 게임이 합친 뒤에 단어 모양을 고치는 규칙.
 * 합치기(슬롯 순서)와 분리돼 있어서, 나중에 am/is/are · 의문문 · 과거형도
 * 여기 함수만 추가하면 된다.
 */

import type { SentenceSlot, SentenceToken } from './sentencePatterns';

export interface TokenChange {
  index: number;
  slot: SentenceSlot;
  from: string;
  to: string;
}

export interface TransformResult {
  tokens: SentenceToken[];
  changes: TokenChange[];
}

const NOT_THIRD_SINGULAR = new Set(['i', 'you', 'we', 'they']);

/** 불규칙·이미 3인칭인 형태. 새 단어가 필요하면 여기만 보강. */
const PRESENT_THIRD: Record<string, string> = {
  be: 'is',
  am: 'is',
  are: 'is',
  is: 'is',
  have: 'has',
  has: 'has',
  do: 'does',
  does: 'does',
  go: 'goes',
  goes: 'goes',
  say: 'says',
  says: 'says',
};

export function isThirdPersonSingular(subject: string): boolean {
  const head = subject.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return Boolean(head) && !NOT_THIRD_SINGULAR.has(head);
}

function matchCase(source: string, next: string): string {
  if (!source) return next;
  if (source === source.toUpperCase() && source.length > 1) return next.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return next.charAt(0).toUpperCase() + next.slice(1);
  return next;
}

function addPresentS(verb: string): string {
  if (/(?:s|x|z|ch|sh|o)$/.test(verb)) return `${verb}es`;
  if (/[bcdfghjklmnpqrstvwxz]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

function isAlreadyPresentThird(lower: string): boolean {
  if (Object.values(PRESENT_THIRD).includes(lower) || PRESENT_THIRD[lower] === lower) return true;
  if (lower.endsWith('ies')) return addPresentS(`${lower.slice(0, -3)}y`) === lower;
  if (lower.endsWith('es')) {
    return [lower.slice(0, -2), lower.slice(0, -1)].some((base) => base.length > 0 && addPresentS(base) === lower);
  }
  if (lower.endsWith('s') && !lower.endsWith('ss')) return addPresentS(lower.slice(0, -1)) === lower;
  return false;
}

/** 원형(또는 이미 3인칭) → 현재 3인칭 단수. 이미 맞으면 그대로. */
export function toPresentThird(verb: string): string {
  const raw = verb.trim();
  if (!raw) return raw;
  const parts = raw.split(/\s+/);
  const head = parts[0];
  const rest = parts.slice(1).join(' ');
  const lower = head.toLowerCase();
  const mapped = PRESENT_THIRD[lower] ?? (isAlreadyPresentThird(lower) ? lower : addPresentS(lower));
  const nextHead = matchCase(head, mapped);
  return rest ? `${nextHead} ${rest}` : nextHead;
}

/**
 * 주어+동사가 함께 있으면 3인칭 단수 현재 일치를 적용한다.
 * I/you/we/they 는 그대로 두고, He/She/It·이름 등은 동사에 -s/-es 를 붙인다.
 */
export function applyPresentAgreement(tokens: SentenceToken[]): TransformResult {
  const subjectIndex = tokens.findIndex((t) => t.slot === 'subject');
  const verbIndex = tokens.findIndex((t) => t.slot === 'verb');
  if (subjectIndex < 0 || verbIndex < 0) return { tokens, changes: [] };

  const subject = tokens[subjectIndex].word;
  if (!isThirdPersonSingular(subject)) return { tokens, changes: [] };

  const verb = tokens[verbIndex];
  const from = verb.word;
  const to = toPresentThird(from);
  if (to.toLowerCase() === from.trim().toLowerCase()) return { tokens, changes: [] };

  const next = tokens.map((t, i) => (i === verbIndex ? { ...t, word: to } : t));
  return { tokens: next, changes: [{ index: verbIndex, slot: 'verb', from, to }] };
}

/** 합친 뒤 한 번에 돌리는 변환. 새 규칙을 넣을 때 여기 한 줄 추가. */
export function applySentenceTransforms(tokens: SentenceToken[]): TransformResult {
  return applyPresentAgreement(tokens);
}

/** 바뀐 글자(sees 의 s, watches 의 es, studies 의 ies)를 하이라이트하기 위한 쪼개기. */
export function splitChangedAffix(from: string, to: string): { stem: string; affix: string } | null {
  const a = from.trim();
  const b = to.trim();
  if (!a || !b || a.toLowerCase() === b.toLowerCase()) return null;
  let i = 0;
  const max = Math.min(a.length, b.length);
  while (i < max && a[i].toLowerCase() === b[i].toLowerCase()) i += 1;
  if (i === 0) return { stem: '', affix: b };
  return { stem: b.slice(0, i), affix: b.slice(i) };
}

export type AgreementFlight =
  | { mode: 'append'; stem: string; affix: string }
  | { mode: 'replace'; from: string; stem: string; affix: string };

/**
 * 교실용 연출: 원형 동사를 먼저 두고, 붙는 글자(s/es/ies)만 날려 합친다.
 * have→has 처럼 원형이 접두가 아니면 원형이 사라진 뒤 새 형태가 남는다.
 */
export function agreementFlightParts(from: string, to: string): AgreementFlight | null {
  const a = from.trim();
  const b = to.trim();
  if (!a || !b || a.toLowerCase() === b.toLowerCase()) return null;
  if (b.length > a.length && b.toLowerCase().startsWith(a.toLowerCase())) {
    return { mode: 'append', stem: a, affix: b.slice(a.length) };
  }
  const split = splitChangedAffix(a, b);
  return { mode: 'replace', from: a, stem: split?.stem ?? '', affix: split?.affix ?? b };
}
