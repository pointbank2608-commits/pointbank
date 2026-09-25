import { useEffect, useMemo, useState } from 'react';
import grammarData from '../data/grammarPoints.json';
import { fetchWordBank } from './api';
import type { FullCardItem, WordBankEntry } from './types';

/**
 * 초등 영문법 43개(2026-09-26) — 문법 페이지(/grammar)·커리큘럼 "문법" 슬라이드의 데이터와 예문 도구.
 *
 * 데이터 원본은 src/data/grammarPoints.json(검수용 표: node app/scripts/grammar/build-review.mjs).
 * - 레벨은 문법 단원이 아니라 Language Level 1~4(Notice & Name → Tell & Explain) + band.
 * - 문법은 규칙보다 "문장 틀"로 먼저 보여준다 — pattern 의 [ ] 는 바뀌는 자리, ** ** 는 강조.
 * - 예문은 검수된 문장만. "우리 단어장으로 바꾸기"는 틀이 안전한 slots 만, 품사·카테고리가 맞는
 *   단어만 넣는다(AI 생성 없음 — 칠판에 틀린 문장이 뜨면 안 되니까).
 */

export interface GrammarSlot {
  /** {a_noun} {noun} {nouns} {verb} {verb_ing} {verb_s} {verb_ed} {adj} */
  template: string;
  pos: string[];
  categories: string[];
  regularOnly?: boolean;
}

/** 초등·중등·고등 + 따로 떼어 정리한 기초 개념(8품사·시제·5형식). */
export type GrammarStage = 'elementary' | 'middle' | 'high' | 'pos' | 'tense' | 'forms';

export interface GrammarPitfall {
  wrong: string;
  right: string;
  why: string;
}

export interface GrammarPoint {
  id: string;
  /** 초등은 Language Level 1~4, 중등은 학년 묶음 5(중1)·6(중2)·7(중3) — 중학교는 교과서·내신이 학년 단위라서.
   * 8품사 8 · 시제 9 · 5형식 10, 고등은 영역 묶음 11(동사) · 12(준동사) · 13(관계사·접속사) · 14(가정법·비교) · 15(특수 구문). */
  stage: GrammarStage;
  level: number;
  band: 'entry' | 'grow' | 'bridge';
  grade: string;
  name: string;
  pattern: string;
  explain: string;
  examples: string[];
  /** 중등: 형태 규칙(공식) 몇 줄 — 칠판의 "규칙" 상자 */
  rule?: string[];
  /** 중등: 시험에 잘 나오는 틀린 문장 → 고친 문장 */
  pitfalls?: GrammarPitfall[];
  /** 초보자용 자세한 설명(고등·기초 개념): 이럴 때 써요(사용 의도) */
  usage?: string[];
  /** 쉽게 이해하기 — 단계별 설명 */
  detail?: string[];
  /** 예문과 같은 순서의 한국어 해석(괄호 안에 역할 메모) */
  translations?: string[];
  /** 한 줄 정리 */
  tip?: string;
  slots: GrammarSlot[] | null;
}

export const GRAMMAR_POINTS = grammarData as GrammarPoint[];

export function grammarPoint(id: string | null | undefined): GrammarPoint | null {
  return GRAMMAR_POINTS.find((g) => g.id === id) ?? null;
}

export const GRAMMAR_STAGES: GrammarStage[] = ['elementary', 'middle', 'high', 'pos', 'tense', 'forms'];
export const GRAMMAR_LEVELS_BY_STAGE: Record<GrammarStage, number[]> = {
  elementary: [1, 2, 3, 4],
  middle: [5, 6, 7],
  high: [11, 12, 13, 14, 15],
  pos: [8],
  tense: [9],
  forms: [10],
};
/** 목록·칩에 쓰는 레벨 이름: 초등 "Lv.1", 중등은 학년 그대로. */
export function grammarLevelTag(point: Pick<GrammarPoint, 'stage' | 'level' | 'grade'>): string {
  return point.stage === 'elementary' ? `Lv.${point.level} · ${point.grade}` : point.grade;
}

/* ---------- ** 강조 표시 ---------- */

export interface MarkedSegment {
  text: string;
  strong: boolean;
}

export function parseMarked(text: string): MarkedSegment[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, strong: i % 2 === 1 }))
    .filter((seg) => seg.text !== '');
}

export function plainText(text: string): string {
  return text.replace(/\*\*/g, '');
}

/* ---------- 낱말 모양 규칙 ---------- */

const UNCOUNTABLE = new Set([
  'milk', 'water', 'juice', 'rice', 'bread', 'music', 'money', 'homework', 'soup', 'cheese', 'butter', 'sugar', 'salt',
  'tea', 'coffee', 'meat', 'air', 'rain', 'snow', 'paper', 'hair', 'furniture', 'information', 'news', 'ice',
]);
const IRREGULAR_PLURAL: Record<string, string> = {
  child: 'children', man: 'men', woman: 'women', person: 'people', mouse: 'mice', tooth: 'teeth', foot: 'feet',
  goose: 'geese', sheep: 'sheep', fish: 'fish', deer: 'deer', leaf: 'leaves', knife: 'knives', wolf: 'wolves',
  shelf: 'shelves', tomato: 'tomatoes', potato: 'potatoes', hero: 'heroes', ox: 'oxen',
};
const A_EXCEPTIONS = new Set(['unicorn', 'uniform', 'university', 'ukulele', 'unit', 'user', 'one', 'europe']);
const AN_EXCEPTIONS = new Set(['hour', 'honest', 'honor']);

/** 동사 슬롯에 넣어도 목적어 없이 자연스러운 동사만(예: "I can swim." ○ / "I can open." ×). */
const SAFE_VERBS = new Set([
  'swim', 'run', 'jump', 'dance', 'sing', 'sleep', 'walk', 'fly', 'skate', 'ski', 'cook', 'read', 'draw', 'write',
  'play', 'cry', 'smile', 'laugh', 'sit', 'stand', 'climb', 'study', 'eat', 'drink', 'shout', 'listen', 'talk',
  'paint', 'hop', 'skip', 'fish', 'hike', 'camp', 'rest', 'wait', 'work', 'clap', 'jog', 'ride', 'sail', 'surf',
  'shop', 'travel', 'win', 'exercise', 'relax', 'dive', 'bake', 'skateboard', 'swing', 'wake', 'yell', 'whistle',
]);
const IRREGULAR_PAST = new Set([
  'run', 'swim', 'sing', 'sleep', 'fly', 'eat', 'drink', 'read', 'draw', 'write', 'sit', 'stand', 'ride', 'win',
  'dive', 'swing', 'wake', 'go', 'come', 'see', 'make', 'have', 'take', 'buy', 'get', 'give', 'know', 'think',
]);
const DOUBLE_FINAL = new Set(['run', 'swim', 'hop', 'skip', 'sit', 'clap', 'stop', 'shop', 'jog', 'dig', 'cut', 'get', 'put', 'win', 'begin', 'swing']);

const isVowel = (c: string) => 'aeiou'.includes(c);

export function withArticle(noun: string): string {
  const w = noun.toLowerCase();
  const first = w.split(/\s+/)[0];
  const an = AN_EXCEPTIONS.has(first) || (isVowel(first[0]) && !A_EXCEPTIONS.has(first) && !first.startsWith('uni') && !first.startsWith('use'));
  return `${an ? 'an' : 'a'} ${noun}`;
}

export function pluralize(noun: string): string | null {
  const w = noun.toLowerCase();
  if (UNCOUNTABLE.has(w)) return null;
  if (IRREGULAR_PLURAL[w]) return IRREGULAR_PLURAL[w];
  if (/(s|x|z|ch|sh)$/.test(w)) return `${noun}es`;
  if (/[^aeiou]y$/.test(w)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export function ingForm(verb: string): string {
  const v = verb.toLowerCase();
  if (v.endsWith('ie')) return `${verb.slice(0, -2)}ying`;
  if (DOUBLE_FINAL.has(v)) return `${verb}${verb.slice(-1)}ing`;
  if (v.endsWith('e') && !v.endsWith('ee')) return `${verb.slice(0, -1)}ing`;
  return `${verb}ing`;
}

export function thirdPersonS(verb: string): string {
  const v = verb.toLowerCase();
  if (v === 'have') return 'has';
  if (/(s|x|z|ch|sh|o)$/.test(v)) return `${verb}es`;
  if (/[^aeiou]y$/.test(v)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

export function pastEd(verb: string): string | null {
  const v = verb.toLowerCase();
  if (IRREGULAR_PAST.has(v)) return null;
  if (v.endsWith('e')) return `${verb}d`;
  if (/[^aeiou]y$/.test(v)) return `${verb.slice(0, -1)}ied`;
  if (DOUBLE_FINAL.has(v)) return `${verb}${verb.slice(-1)}ed`;
  return `${verb}ed`;
}

/* ---------- 우리 단어장으로 예문 만들기 ---------- */

type Placeholder = 'a_noun' | 'noun' | 'nouns' | 'verb' | 'verb_ing' | 'verb_s' | 'verb_ed' | 'adj' | 'a_adj';

const PLACEHOLDER_POS: Record<Placeholder, string> = {
  a_noun: '명사',
  noun: '명사',
  nouns: '명사',
  verb: '동사',
  verb_ing: '동사',
  verb_s: '동사',
  verb_ed: '동사',
  adj: '형용사',
  a_adj: '형용사',
};

/** 한 낱말을 자리 모양으로 바꾼다. 못 바꾸면(셀 수 없는 명사의 복수, 불규칙 과거 등) null. */
function formFor(ph: Placeholder, word: string): string | null {
  const w = word.trim();
  if (!w) return null;
  switch (ph) {
    case 'a_noun':
      return UNCOUNTABLE.has(w.toLowerCase()) ? null : withArticle(w);
    case 'noun':
    case 'adj':
      return w;
    case 'a_adj':
      return withArticle(w);
    case 'nouns':
      return pluralize(w);
    case 'verb':
      return SAFE_VERBS.has(w.toLowerCase()) ? w : null;
    case 'verb_ing':
      return SAFE_VERBS.has(w.toLowerCase()) ? ingForm(w) : null;
    case 'verb_s':
      return SAFE_VERBS.has(w.toLowerCase()) ? thirdPersonS(w) : null;
    case 'verb_ed':
      return SAFE_VERBS.has(w.toLowerCase()) ? pastEd(w) : null;
  }
}

export interface GeneratedSentence {
  /** 화면에 보여줄 문장 — 단어장에서 넣은 낱말은 ** ** 로 감싸 강조한다. */
  marked: string;
  text: string;
}

/** 이 카드가 슬롯에 쓸 수 있는 정보(사전에서 담아 품사·카테고리가 있는지). */
export function cardUsableForGrammar(card: FullCardItem): boolean {
  return !!card.partOfSpeech && !!card.category;
}

/** 첫 글자를 대문자로 — 문장이 강조 표시(**)로 시작해도 글자를 찾아서. */
function capitalizeFirst(s: string): string {
  const i = s.search(/[a-zA-Z]/);
  return i < 0 ? s : s.slice(0, i) + s.charAt(i).toUpperCase() + s.slice(i + 1);
}

/**
 * 문법 틀에 수업 단어장 낱말을 넣어 예문을 만든다. 품사·카테고리가 맞고 모양 규칙을 확실히 적용할 수
 * 있는 낱말만 쓴다. seed 를 바꾸면 다른 조합이 나온다(같은 seed 면 같은 결과 — 미리보기=발표).
 */
export function buildWordListSentences(point: GrammarPoint, cards: FullCardItem[], max = 6, seed = 0): GeneratedSentence[] {
  if (!point.slots) return [];
  const usable = cards.filter(cardUsableForGrammar);
  const out: GeneratedSentence[] = [];
  // 검수된 기본 예문과 똑같은 문장은 다시 보여주지 않는다.
  const seen = new Set<string>(point.examples.map(plainText));

  for (const slot of point.slots) {
    const phs = [...slot.template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as Placeholder);
    // 자리마다 들어갈 수 있는 낱말 후보(모양까지 바꾼 값)
    const pools = phs.map((ph) =>
      usable
        .filter((c) => c.partOfSpeech === PLACEHOLDER_POS[ph] && slot.categories.includes(c.category as string))
        .map((c) => ({ word: c.word, category: c.category as string, form: formFor(ph, c.word) }))
        .filter((x): x is { word: string; category: string; form: string } => !!x.form),
    );
    if (pools.some((p) => p.length === 0)) continue;
    const first = pools[0];
    for (let i = 0; i < first.length; i++) {
      const pickIdx = (i + seed) % first.length;
      const used = new Set<string>();
      const forms: string[] = [];
      let ok = true;
      let firstCategory: string | null = null;
      pools.forEach((pool0, k) => {
        if (!ok) return;
        // 같은 자리 종류(명사끼리)면 첫 낱말과 같은 카테고리를 먼저 — "I like cats and dogs" ○, "apples and dogs" △.
        const same = firstCategory && phs[k] === phs[0] ? pool0.filter((c) => c.category === firstCategory) : [];
        const pool = same.length > 1 ? same : pool0;
        // 두 번째 자리부터는 앞과 다른 낱말을 돌아가며 고른다.
        const start = k === 0 ? pickIdx : (pickIdx + k * 3 + seed) % pool.length;
        for (let j = 0; j < pool.length; j++) {
          const cand = pool[(start + j) % pool.length];
          if (k === 0) firstCategory = cand.category;
          if (!used.has(cand.word)) {
            used.add(cand.word);
            forms.push(cand.form);
            return;
          }
        }
        ok = false;
      });
      if (!ok) continue;
      let idx = 0;
      const marked = capitalizeFirst(slot.template.replace(/\{(\w+)\}/g, () => `**${forms[idx++]}**`));
      const text = plainText(marked);
      if (seen.has(text)) continue;
      seen.add(text);
      out.push({ marked, text });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** 문장 배열하기 게임에 넣을 문장 — 3낱말 이상인 완전한 문장만(구 "a dog" 은 뺀다). */
export function sentencesForUnscramble(point: GrammarPoint, generated: GeneratedSentence[] = []): string[] {
  const all = [...point.examples.map(plainText), ...generated.map((g) => g.text)];
  const sentences = all
    // "What's this? It's a ball." 처럼 두 문장이면 둘로 나눈다.
    .flatMap((s) => s.split(/(?<=[.?!])\s+(?=[A-Z])/))
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3 && /[.?!]$/.test(s));
  return [...new Set(sentences)];
}

/* ---------- 예전 단어장 보완: 품사·카테고리가 없는 낱말은 사전에서 찾아 채운다 ---------- */


let wordBankCache: Promise<WordBankEntry[]> | null = null;

/** 사전(word_bank)을 한 번만 불러와 낱말 → 항목 목록으로 묶는다. 실패하면 빈 목록(보완 없이 진행). */
function useWordBankIndex(enabled: boolean): Map<string, WordBankEntry[]> | null {
  const [index, setIndex] = useState<Map<string, WordBankEntry[]> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    wordBankCache ??= fetchWordBank().catch(() => []);
    void wordBankCache.then((rows) => {
      if (cancelled) return;
      const map = new Map<string, WordBankEntry[]>();
      for (const row of rows) {
        const key = row.word.trim().toLowerCase();
        map.set(key, [...(map.get(key) ?? []), row]);
      }
      setIndex(map);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return index;
}

/**
 * 품사·카테고리가 빠진 카드(품사 저장 전에 만든 단어장, 직접 입력한 낱말)를 사전에서 같은 낱말을 찾아
 * 채운다. 뜻이 여러 개면 카테고리가 같은 항목, 없으면 첫 항목. 사전에 없는 낱말은 그대로(예문에 안 씀).
 */
export function useGrammarCards(cards: FullCardItem[]): FullCardItem[] {
  const needs = cards.some((c) => !cardUsableForGrammar(c));
  const index = useWordBankIndex(needs);
  return useMemo(() => {
    if (!index) return cards;
    return cards.map((c) => {
      if (cardUsableForGrammar(c)) return c;
      const entries = index.get(c.word.trim().toLowerCase());
      if (!entries?.length) return c;
      const entry = entries.find((e) => e.category === c.category) ?? entries[0];
      return { ...c, partOfSpeech: c.partOfSpeech ?? entry.part_of_speech, category: c.category ?? entry.category };
    });
  }, [cards, index]);
}
