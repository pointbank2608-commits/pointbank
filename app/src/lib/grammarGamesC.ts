import { shuffleSeeded } from './grammarGames';
import {
  ASK_CHARS, ASK_TRAITS, COND_DATA, PASSIVE_DATA, REL_NOUNS, REL_PLACES, REL_THINGS, REL_TRAITS, SHOP_ITEMS,
  type AskFamily,
} from './grammarGameDataC';

/** 문법별 게임 3차 묶음(2026-11-04): 수동태 카메라·조건문 선택 모험·관계사 인물 찾기·질문으로 친구 찾기·문법 장보기. */

/* ---------- 수동태 카메라 ---------- */
const PASSIVE_GRAMMARS = new Set(['m-passive', 'm-passive-advanced', 'h-passive-advanced']);
export interface PassiveRound {
  id: string; actorE: string; objE: string; focus: string; active: string;
  before: string; after: string; answer: string; options: string[]; tense: 'past' | 'present';
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export function passiveRounds(grammarId: string, seed = 1, max = 8): PassiveRound[] {
  if (!PASSIVE_GRAMMARS.has(grammarId)) return [];
  return shuffleSeeded(PASSIVE_DATA, seed).slice(0, max).map((e, i) => {
    const tense: 'past' | 'present' = i % 2 === 0 ? 'past' : 'present';
    const be = tense === 'past' ? (e.objPlural ? 'were' : 'was') : (e.objPlural ? 'are' : 'is');
    const verb = tense === 'past' ? e.past : e.actorPlural ? e.base : e.third;
    const answer = `${be} ${e.pp}`;
    const options = shuffleSeeded([...new Set([answer, verb, `${be} ${e.base}`])], seed + i);
    return {
      id: `pas-${i}`, actorE: e.actorE, objE: e.objE, focus: e.obj, tense,
      active: `${e.actor} ${verb} ${e.obj}.`,
      before: cap(e.obj), after: `by ${e.actor}.`, answer, options,
    };
  });
}

/* ---------- 조건문 선택 모험 ---------- */
const COND_GRAMMARS = new Set(['m-if-conditional', 'm-conj-when-if-that']);
export interface CondRound {
  id: string; scene: string; before: string; after: string; answer: string; options: string[]; kind: 'if' | 'main'; full: string;
}
export function condRounds(grammarId: string, seed = 1, max = 8): CondRound[] {
  if (!COND_GRAMMARS.has(grammarId)) return [];
  return shuffleSeeded(COND_DATA, seed).slice(0, max).map((c, i) => {
    const kind: 'if' | 'main' = i % 2 === 0 ? 'main' : 'if';
    const mainTail = ` ${c.rest}.`;
    const ifHead = (verb: string) => `If ${c.pre} ${verb}${c.post ? ` ${c.post}` : ''}`;
    const full = `${ifHead(c.ifPres)}, ${c.msubj} will ${c.mbase}${mainTail}`;
    if (kind === 'main') {
      const answer = `will ${c.mbase}`;
      return { id: `cond-${i}`, scene: c.scene, kind, full, before: `${ifHead(c.ifPres)}, ${c.msubj}`, after: mainTail.trim(), answer, options: shuffleSeeded([answer, c.mbase, c.mpast], seed + i) };
    }
    return {
      id: `cond-${i}`, scene: c.scene, kind, full, before: 'If ' + c.pre, after: `${c.post ? `${c.post}` : ''}, ${c.msubj} will ${c.mbase}${mainTail}`.replace(/^, /, ', '),
      answer: c.ifPres, options: shuffleSeeded([c.ifPres, c.ifFut, c.ifPast], seed + i),
    };
  });
}

/* ---------- 관계사 인물 찾기 ---------- */
export type RelKind = 'who' | 'whose' | 'thing' | 'place';
const REL_KIND: Record<string, RelKind> = {
  'm-relative-subject': 'who', 'm-relative-whose': 'whose', 'm-relative-object': 'thing', 'm-relative-adverb': 'place',
};
export interface RelRound { id: string; kind: RelKind; clue: string; answer: string; options: string[]; explain: [string, string] }
export function relativeRounds(grammarId: string, seed = 1, max = 8): RelRound[] {
  const kind = REL_KIND[grammarId];
  if (!kind) return [];
  const out: RelRound[] = [];
  for (let i = 0; i < max; i++) {
    if (kind === 'who' || kind === 'whose') {
      const noun = REL_NOUNS[(i + seed) % REL_NOUNS.length];
      const four = shuffleSeeded(REL_TRAITS, seed * 13 + i).slice(0, 4);
      const target = four[0];
      const card = (t: (typeof four)[number]) => `${noun.e} ${t.icon} ${t.label}`;
      out.push({
        id: `rel-${i}`, kind, answer: card(target), options: shuffleSeeded(four.map(card), seed + i),
        clue: kind === 'who' ? `Find the ${noun.n} who ${target.who}.` : `Find the ${noun.n} whose ${target.whose}.`,
        explain: kind === 'who'
          ? [`who 뒤의 말이 그 사람을 설명해요: the ${noun.n} [who ${target.who}]`, `The words after "who" describe the person.`]
          : [`whose + 명사 = "그 사람의 ~". the ${noun.n} [whose ${target.whose}]`, `"whose + noun" means "his/her ...".`],
      });
    } else {
      const pool = kind === 'thing' ? REL_THINGS : REL_PLACES;
      const four = shuffleSeeded(pool, seed * 17 + i).slice(0, 4);
      const target = four[0];
      const card = (t: (typeof four)[number]) => `${t.e} ${t.label}`;
      out.push({
        id: `rel-${i}`, kind, answer: card(target), options: shuffleSeeded(four.map(card), seed + i),
        clue: kind === 'thing' ? `Find the thing that ${target.clue}.` : `Find the place where ${target.clue}.`,
        explain: kind === 'thing'
          ? [`that 뒤에는 "주어 + 동사"가 와요: the thing [that ${target.clue}]`, `After "that" comes "subject + verb".`]
          : [`where = 장소 뒤에서 "그곳에서"라는 뜻: the place [where ${target.clue}]`, `"where" follows a place word.`],
      });
    }
  }
  return out;
}

/* ---------- 문법 장보기 ---------- */
export interface ShopRound { id: string; e: string; before: string; after: string; answer: string; options: string[]; explain: [string, string] }
const SHOP_MODES: Record<string, ('a' | 'any' | 'some' | 'anyq' | 'how' | 'little' | 'left')[]> = {
  'countable-uncountable': ['a', 'any', 'some', 'anyq'],
  'how-many': ['how'],
  'h-quantifiers': ['little', 'left'],
};
export function shopRounds(grammarId: string, seed = 1, max = 8): ShopRound[] {
  const modes = SHOP_MODES[grammarId];
  if (!modes) return [];
  const out: ShopRound[] = [];
  const items = shuffleSeeded(SHOP_ITEMS, seed);
  for (let i = 0; out.length < max && i < items.length * 2; i++) {
    const it = items[i % items.length];
    const mode = modes[i % modes.length];
    const an = /^[aeiou]/.test(it.s) ? 'an' : 'a';
    let r: Omit<ShopRound, 'id'> | null = null;
    if (mode === 'a') {
      if (!it.count) continue;
      r = { e: it.e, before: 'I want', after: `${it.s}.`, answer: an, options: shuffleSeeded(['a', 'an', 'some'], seed + i), explain: [`${it.s} 은(는) 하나일 때 ${an} 을 써요. (모음 소리 앞 = an)`, `Use "${an}" before "${it.s}".`] };
    } else if (mode === 'any') {
      r = { e: it.e, before: "We don't have", after: `${it.w}.`, answer: 'any', options: shuffleSeeded(['any', 'some', 'a'], seed + i), explain: ['부정문에서는 some 대신 any 를 써요.', 'In negative sentences, use any instead of some.'] };
    } else if (mode === 'some') {
      r = { e: it.e, before: 'We have', after: `${it.w}.`, answer: 'some', options: shuffleSeeded(['some', 'any', it.count ? 'a' : 'an'], seed + i), explain: ['긍정문에서는 some 을 써요.', 'In affirmative sentences, use some.'] };
    } else if (mode === 'anyq') {
      r = { e: it.e, before: 'Do you have', after: `${it.w}?`, answer: 'any', options: shuffleSeeded(['any', 'a', it.count ? 'much' : 'many'], seed + i), explain: ['의문문에서는 any 를 자주 써요.', 'In questions, any is common.'] };
    } else if (mode === 'how') {
      r = { e: it.e, before: 'How', after: `${it.w} do you want?`, answer: it.count ? 'many' : 'much', options: shuffleSeeded(['many', 'much', 'a'], seed + i), explain: it.count ? ['셀 수 있는 것은 How many.', 'Countable: How many.'] : ['셀 수 없는 것은 How much.', 'Uncountable: How much.'] };
    } else if (mode === 'little') {
      r = { e: it.e, before: 'We have', after: `${it.w}.`, answer: it.count ? 'a few' : 'a little', options: shuffleSeeded(['a few', 'a little', 'much'], seed + i), explain: it.count ? ['셀 수 있는 것은 a few(조금 있다).', 'Countable: a few.'] : ['셀 수 없는 것은 a little(조금 있다).', 'Uncountable: a little.'] };
    } else {
      r = { e: it.e, before: "There isn't", after: `${it.w} left.`, answer: it.count ? 'many' : 'much', options: shuffleSeeded(['many', 'much', 'a few'], seed + i), explain: it.count ? ['부정문에서 셀 수 있는 것은 many.', 'Countable in negatives: many.'] : ['부정문에서 셀 수 없는 것은 much.', 'Uncountable in negatives: much.'] };
    }
    if (r.options.includes(r.answer) && new Set(r.options).size === r.options.length) out.push({ ...r, id: `shop-${out.length}` });
  }
  return out;
}

/* ---------- 질문으로 친구 찾기 ---------- */
const ASK_FAMILY: Record<string, AskFamily> = { 'does-he': 'does', 'do-you-like': 'does', 'is-it': 'is', 'i-can': 'can' };
export interface AskRound {
  id: string; family: AskFamily; secret: number;
  questions: { id: number; text: string; icon: string; label: string }[];
  chars: { n: string; e: string; traits: boolean[] }[];
}
/** 8명이 5가지 특징으로 서로 다르게 구분되도록 만든다(특징 조합이 겹치지 않음). */
export function askRounds(grammarId: string, seed = 1, rounds = 3): AskRound[] {
  const family = ASK_FAMILY[grammarId];
  if (!family) return [];
  const traits = ASK_TRAITS[family];
  const out: AskRound[] = [];
  for (let r = 0; r < rounds; r++) {
    const combos = shuffleSeeded(Array.from({ length: 32 }, (_, k) => k), seed * 31 + r * 7).slice(0, ASK_CHARS.length);
    const names = shuffleSeeded(ASK_CHARS, seed + r);
    const chars = names.map((c, i) => ({ ...c, traits: traits.map((_, b) => Boolean(combos[i] & (1 << b))) }));
    const secret = shuffleSeeded(chars.map((_, i) => i), seed * 5 + r)[0];
    out.push({
      id: `ask-${r}`, family, secret, chars,
      questions: traits.map((t, id) => ({ id, text: t.q, icon: t.icon, label: t.label })),
    });
  }
  return out;
}

export const THIRD_MIN: Record<'grammarpassive' | 'grammarcond' | 'grammarrelative' | 'grammarask' | 'grammarshop', number> = {
  grammarpassive: 4, grammarcond: 4, grammarrelative: 4, grammarask: 2, grammarshop: 4,
};
export function thirdSupport(grammarId: string): Record<keyof typeof THIRD_MIN, number> {
  return {
    grammarpassive: passiveRounds(grammarId).length,
    grammarcond: condRounds(grammarId).length,
    grammarrelative: relativeRounds(grammarId).length,
    grammarask: askRounds(grammarId).length,
    grammarshop: shopRounds(grammarId).length,
  };
}
