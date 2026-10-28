import type { GrammarPoint } from './grammar';
import { plainText } from './grammar';
import type { BuildItem, ChooseItem, CorrectItem, GrammarSheetContent, ReviewItem, SayItem, SetContent } from '../data/grammarSheets/types';

/** 시트의 의도(개념 → 심화 순서). 'robot' 은 검수된 추리 미션이 있는 주제에서만 쓴다. */
export const SHEET_KINDS = ['discover', 'choose', 'build', 'correct', 'say', 'review'] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];
/** 연습 세트: A·B 는 서로 다른 문장으로 같은 문법을 한 번 더 연습한다 */
export type SheetSet = 'A' | 'B';
export const SHEET_SETS: SheetSet[] = ['A', 'B'];
/** 의도별 시트가 몇 쪽인지(문항이 많아 두 쪽으로 나뉘는 시트가 있다) */
export const KIND_PAGES: Record<SheetKind, number> = { discover: 1, choose: 1, build: 2, correct: 1, say: 1, review: 1 };
/** 한 쪽에 담는 문항 수 */
export const PER_PAGE = { choose: 10, fill: 4, order: 4, say: 6, review: 6 } as const;
/** 교사용 정답지 쪽 수(세트마다) */
export const KEY_PAGES = 1;
/** 도움 수준: 1 = 도움 많음, 2 = 기본, 3 = 도전 */
export type Support = 1 | 2 | 3;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
export function shuffled<T>(items: T[], seed: string, avoidSame = true): T[] {
  const a = [...items];
  const rand = rng(hash(seed));
  for (let tries = 0; tries < 6; tries++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (!avoidSame || a.length < 2 || a.some((x, i) => x !== items[i])) break;
  }
  return a;
}

export interface MarkedExample {
  /** 원문(굵게 표시 포함) */
  raw: string;
  plain: string;
  ko: string;
  /** 굵게 표시된 부분들 */
  marks: string[];
  /** 굵게 표시된 부분을 ____ 로 바꾼 문장 */
  blanked: string;
}
export function markedExamples(point: GrammarPoint): MarkedExample[] {
  return markedFrom(point.examples.map((raw, i) => ({ en: raw, ko: point.translations?.[i] ?? '' })));
}
/** 굵은 표시가 있는 영어 문장과 해석 목록 → 표시 정보 */
export function markedFrom(list: BuildItem[]): MarkedExample[] {
  return list.map(({ en: raw, ko }) => {
    const marks: string[] = [];
    const blanked = raw.replace(/\*\*(.+?)\*\*/g, (_, m: string) => {
      marks.push(m);
      return '____';
    });
    return { raw, plain: plainText(raw), ko: stripRole(ko), marks, blanked };
  });
}
/** 해석 끝의 역할 메모 "(have → has)" 같은 괄호는 지시문에 방해가 되어 떼지 않고 그대로 둔다 — 학생에게 힌트가 되는 설명이다. */
function stripRole(text: string): string {
  return text.trim();
}

/** 규칙 발견 시트에 쓸 예문(굵은 표시가 있는 것 우선, 최대 6) */
export function discoverExamples(all: MarkedExample[]): MarkedExample[] {
  const marked = all.filter((e) => e.marks.length > 0);
  return (marked.length >= 3 ? marked : all).slice(0, 6);
}

export interface FillItem {
  prompt: string;
  ko: string;
  answer: string;
  /** 도움 수준 1·2에서 보여 줄 괄호 힌트: 낱말 앞부분(어미만 바뀌는 경우) 또는 첫 글자 */
  hint: string;
}
/**
 * 빈칸: 굵은 표시가 있는 예문. 표시가 낱말 일부(어미)여도 그 낱말 전체를 비우고, 정답은 낱말 전체,
 * 힌트는 어미 앞부분(like**s** → like) 또는 첫 글자다. 정답이 여럿이면 " / "로 잇는다.
 */
export function fillItems(examples: MarkedExample[], max = 8): FillItem[] {
  const out: FillItem[] = [];
  for (const e of examples) {
    const tokens = e.raw.split(/\s+/);
    const answers: string[] = [];
    const hints: string[] = [];
    const blanked = tokens.map((tok) => {
      if (!tok.includes('**')) return tok;
      const core = tok.replace(/[.,?!]+$/, '');
      const tail = tok.slice(core.length);
      const plainTok = plainText(core);
      const prefix = core.split('**')[0];
      answers.push(plainTok);
      hints.push(prefix.length >= 2 ? prefix : plainTok.slice(0, 1) + '…');
      return '____' + tail;
    });
    if (answers.length === 0 || tokens.length < 2) continue;
    out.push({ prompt: blanked.join(' '), ko: e.ko, answer: answers.join(' / '), hint: hints.join(' / ') });
    if (out.length >= max) break;
  }
  return out;
}

export interface OrderItem {
  words: string[];
  answer: string;
  ko: string;
}
/** 배열: 3~9 낱말 예문, 최대 8개. 낱말 섞기는 항목마다 고정(같은 시트는 늘 같은 순서). */
export function orderItems(examples: MarkedExample[], seedId: string): OrderItem[] {
  return examples
    .filter((e) => {
      const n = e.plain.split(/\s+/).length;
      return n >= 3 && n <= 9;
    })
    .slice(0, 8)
    .map((e) => {
      const words = e.plain.replace(/[.?!]$/, '').split(/\s+/);
      const end = e.plain.match(/[.?!]$/)?.[0] ?? '.';
      const lower = words.map((w, i) => (i === 0 && !/^I$|^I'/.test(w) ? w.toLowerCase() : w));
      return { words: shuffled(lower, seedId + e.plain), answer: e.plain, ko: e.ko + (end === '?' ? '' : '') };
    });
}

export interface CorrectRow extends CorrectItem {}
/** 오류 고치기: 세트 A 는 데이터의 틀리기 쉬운 것 + 추가분, 세트 B 는 새로 쓴 문장. 최대 6개, 같은 틀린 문장은 한 번만. */
export function correctItems(point: GrammarPoint, content: GrammarSheetContent | undefined, set: SheetSet = 'A'): CorrectRow[] {
  const rows: CorrectRow[] = [];
  const seen = new Set<string>();
  const push = (w: string, r: string, why: string) => {
    const key = plainText(w).trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({ w: plainText(w).trim(), r: plainText(r).trim(), why: plainText(why).trim() });
  };
  if (set === 'B') {
    for (const c of content?.b?.correct ?? []) push(c.w, c.r, c.why);
    return rows.slice(0, 6);
  }
  const dropped = new Set((content?.dropPitfalls ?? []).map((w) => plainText(w).trim().toLowerCase()));
  for (const p of point.pitfalls ?? []) if (!dropped.has(plainText(p.wrong).trim().toLowerCase())) push(p.wrong, p.right, p.why);
  for (const c of content?.correct ?? []) push(c.w, c.r, c.why);
  return rows.slice(0, 6);
}

export interface SheetData {
  point: GrammarPoint;
  content: GrammarSheetContent;
  set: SheetSet;
  discover: { examples: MarkedExample[]; q: string; a: string };
  choose: ChooseItem[];
  fill: FillItem[];
  order: OrderItem[];
  correct: CorrectRow[];
  say: SayItem[];
  mission: GrammarSheetContent['mission'];
  review: ReviewItem[];
  /** 총정리 보강: 같은 단원의 다른 문법에서 가져온 고르기 */
  mixed: { from: string; item: ChooseItem }[];
}

/** 보기 순서를 문항마다 고정된 방식으로 섞는다(정답이 늘 첫 번째가 되지 않게). */
export function shuffleChoices(items: ChooseItem[], seed: string): ChooseItem[] {
  return items.map((q, i) => {
    const order = shuffled(q.c.map((_, k) => k), `${seed}#${i}#${q.p}`, false);
    // 정답이 한 자리에 몰리지 않게: 문항 번호로 정답 자리를 돌린다.
    const want = i % q.c.length;
    const at = order.indexOf(q.a);
    [order[at], order[want]] = [order[want], order[at]];
    return { ...q, c: order.map((k) => q.c[k]), a: want };
  });
}

function setContent(point: GrammarPoint, content: GrammarSheetContent, set: SheetSet): SetContent & { examples: BuildItem[] } {
  if (set === 'B' && content.b) return { ...content.b, examples: content.b.build };
  const base: BuildItem[] = point.examples.map((en, i) => ({ en, ko: point.translations?.[i] ?? '' }));
  return { discover: content.discover, choose: content.choose, build: [...base, ...(content.buildExtra ?? [])], correct: content.correct, say: content.say, mission: content.mission, review: content.review, examples: [...base, ...(content.buildExtra ?? [])] };
}

export function buildSheetData(
  point: GrammarPoint,
  content: GrammarSheetContent,
  neighbors: { name: string; content: GrammarSheetContent | undefined }[] = [],
  set: SheetSet = 'A',
): SheetData {
  const sc = setContent(point, content, set);
  const mixed: SheetData['mixed'] = [];
  for (const n of neighbors) {
    const nc = set === 'B' && n.content?.b ? n.content.b.choose : n.content?.choose;
    const item = nc?.[0];
    if (item) mixed.push({ from: n.name, item: shuffleChoices([item], `${n.name}${set}`)[0] });
    if (mixed.length >= 2) break;
  }
  const examples = markedFrom(sc.examples);
  return {
    point,
    content,
    set,
    discover: { examples: discoverExamples(examples), ...sc.discover },
    choose: shuffleChoices(sc.choose, `${point.id}${set}`),
    fill: fillItems(examples, 8),
    order: orderItems(examples, point.id + set),
    correct: correctItems(point, content, set),
    say: sc.say,
    mission: sc.mission,
    review: sc.review,
    mixed,
  };
}

/** 이 주제에 B 세트가 있는지 */
export function hasSetB(content: GrammarSheetContent | undefined): boolean {
  return !!content?.b;
}

/** 인쇄 쪽수: 선택한 세트마다 (학생용 시트 쪽수 합 + 교사용 정답 쪽수) */
export function pageCount(kinds: SheetKind[], teacher: boolean, student: boolean, sets: number): number {
  const studentPages = kinds.reduce((n, k) => n + KIND_PAGES[k], 0);
  return sets * ((student ? studentPages : 0) + (teacher && kinds.length ? KEY_PAGES : 0));
}
