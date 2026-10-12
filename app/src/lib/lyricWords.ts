/**
 * 노래 가사에서 단어장에 담을 낱말·숙어를 뽑는다(2026-10-12). AI 없이 규칙만으로:
 * ① 가사를 낱말로 쪼개 사전(word_bank)과 맞추고(복수·과거·진행·불규칙 꼴은 표제어로)
 * ② 사전의 숙어·표현 + 기본 숙어(basicPhrases.ts)가 가사에 나오는 곳을 찾는다.
 * 가사 원문은 저장하지 않는다 — 화면 안에서만 쓰고, 고른 낱말·뜻만 단어장에 담긴다.
 */
import { BASIC_PHRASES } from './basicPhrases';
import { MORE_PHRASES } from './basicPhrasesMore';
import type { WordBankEntry } from './types';
import { lemmas } from './videoLesson';
import { IDIOM_PARTS_OF_SPEECH } from './wordBankCategories';

export interface LyricWord {
  key: string;
  /** 사전에서 이 낱말의 뜻들(첫 뜻·그림 있는 것 먼저). 화면이 고르게 한다. */
  senses: WordBankEntry[];
  count: number;
  firstAt: number;
  example: string;
}

export interface LyricPhrase {
  key: string;
  phrase: string;
  meaning: string;
  /** 사전에 있는 숙어면 그 항목(그림·카테고리가 따라온다), 기본 숙어 목록에서 왔으면 null */
  entry: WordBankEntry | null;
  count: number;
  firstAt: number;
  example: string;
}

export interface LyricUnknown {
  key: string;
  count: number;
  firstAt: number;
  example: string;
}

export interface LyricVocab {
  words: LyricWord[];
  phrases: LyricPhrase[];
  unknown: LyricUnknown[];
  lineCount: number;
}

const SKIP_POS = new Set(['대명사', '전치사', '접속사', '관사', '조동사', '감탄사', '한정사']);

const STOP = new Set(
  (
    'the a an and but or so if as at by for from in into of on to with without about i me my mine myself you your yours we us our ours ' +
    'he him his she her hers it its they them their theirs am is are was were be been being do does did done have has had will would ' +
    'can could shall should may might must not no yes oh ok okay just very too also than then that this these those there here who ' +
    'whom whose what which why how when where while'
  ).split(' '),
);
/** 가사 추임새·줄임말 — 사전에 없어도 "사전에 없는 낱말"로 띄우지 않는다. */
const FILLER = new Set(
  'yeah yea hey ooh oooh ohh uh huh hmm mm la na da doo woah whoa ah aah yo gonna wanna gotta cause cuz ain nah ya em til tho lil'.split(' '),
);
const IRREGULAR: Record<string, string> = {
  went: 'go', gone: 'go', came: 'come', saw: 'see', seen: 'see', took: 'take', taken: 'take', gave: 'give', given: 'give',
  got: 'get', made: 'make', said: 'say', knew: 'know', known: 'know', thought: 'think', told: 'tell', felt: 'feel',
  left: 'leave', kept: 'keep', found: 'find', ran: 'run', sang: 'sing', sung: 'sing', fell: 'fall', fallen: 'fall',
  broke: 'break', broken: 'break', heard: 'hear', met: 'meet', brought: 'bring', bought: 'buy', built: 'build',
  wrote: 'write', written: 'write', ate: 'eat', eaten: 'eat', drank: 'drink', flew: 'fly', grew: 'grow', held: 'hold',
  lost: 'lose', paid: 'pay', sat: 'sit', slept: 'sleep', stood: 'stand', taught: 'teach', won: 'win', wore: 'wear',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse',
  has: 'have', had: 'have', am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be',
};
/** 끝의 s 를 떼면 다른 낱말이 되어 버리는 것들 */
const NO_LEMMA = new Set(['news', 'always', 'sometimes', 'perhaps', 'yes', 'us', 'this', 'his', 'thus', 'plus', 'across', 'whose', 'gas', 'bus', 'lens', 'series']);
const BE_FORMS = new Set(['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being']);
const POSSESSIVE = new Set(['my', 'your', 'his', 'her', 'our', 'their', 'its']);
/** a friend of mine / yours / his … 의 mine 자리 */
const POSSESSIVE_PRONOUN = new Set(['mine', 'yours', 'his', 'hers', 'ours', 'theirs']);
const WILDCARD = new Set(['someone', 'somebody', 'something', 'sb', 'sth', 'oneself']);
const SECTION_LABEL = /^(?:verse|chorus|pre-?chorus|bridge|intro|outro|hook|refrain|interlude|post-?chorus)\b[\s\d:.\-–]*$/i;

/** 가사 줄 정리: 시간표·[Chorus] 같은 대괄호, "| 해석", 구분 줄을 걷어 낸다. */
export function cleanLyricLines(source: string): string[] {
  const out: string[] = [];
  for (const raw of source.split(/\r?\n/)) {
    let line = raw.replace(/\*\*/g, '');
    const bar = line.indexOf('|');
    if (bar >= 0) line = line.slice(0, bar);
    line = line.replace(/\[[^\]]*\]/g, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || SECTION_LABEL.test(line)) continue;
    out.push(line);
  }
  return out;
}

interface Tok {
  w: string;
  line: number;
}

function tokenize(lines: string[]): Tok[] {
  const toks: Tok[] = [];
  lines.forEach((line, li) => {
    const text = line.toLowerCase().replace(/[’‘`´]/g, "'");
    for (const raw of text.match(/[a-z]+(?:'[a-z]+)*/g) ?? []) {
      if (raw.endsWith("n't")) continue;
      const w = raw.replace(/'(?:s|re|ll|ve|d|m)$/, '');
      if (w.length >= 1) toks.push({ w, line: li });
    }
  });
  return toks;
}

const formsCache = new Map<string, string[]>();
/** 낱말 꼴 → 사전 표제어 후보(원래 꼴 먼저) */
function baseForms(w: string): string[] {
  const hit = formsCache.get(w);
  if (hit) return hit;
  const out = [w];
  if (IRREGULAR[w]) out.push(IRREGULAR[w]);
  if (!NO_LEMMA.has(w)) out.push(...lemmas(w));
  if (w.endsWith('in') && w.length > 4) out.push(...lemmas(`${w}g`)); // lovin' → loving
  const uniq = [...new Set(out)];
  formsCache.set(w, uniq);
  return uniq;
}

function tokenMatches(lyric: string, p: string): boolean {
  if (p === "one's") return POSSESSIVE.has(lyric);
  if (p === 'mine') return POSSESSIVE_PRONOUN.has(lyric);
  if (p === 'be') return BE_FORMS.has(lyric);
  if (lyric === p) return true;
  if (POSSESSIVE.has(p) && POSSESSIVE.has(lyric)) return true;
  // 한 글자 패턴(a)에 as·an 같은 낱말이 변화형으로 걸리지 않게 막는다. go·do 같은 두 글자는 허용(goes→go).
  if (p.length < 2 || lyric.length < 3) return false;
  return baseForms(lyric).includes(p);
}

/** 패턴이 toks[i..] 에서 시작해 맞으면 끝 위치(미포함), 아니면 -1. '*' 는 낱말 1~3개. */
function matchFrom(toks: string[], i: number, pat: string[], p: number): number {
  if (p === pat.length) return i;
  if (i >= toks.length) return -1;
  if (pat[p] === '*') {
    for (let n = 1; n <= 3; n++) {
      const r = matchFrom(toks, i + n, pat, p + 1);
      if (r >= 0) return r;
    }
    return -1;
  }
  return tokenMatches(toks[i], pat[p]) ? matchFrom(toks, i + 1, pat, p + 1) : -1;
}

function phraseTokens(phrase: string): string[] {
  const toks = phrase
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[?!.,;:~…()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // 가사 쪽과 같은 방식으로 줄임말을 푼다: I'm → i, you're → you, what's → what (n't 는 가사에서도 건너뛴다)
    .filter((t) => !t.endsWith("n't"))
    .map((t) => (t === "one's" ? t : t.replace(/'(?:s|re|ll|ve|d|m)$/, '')))
    .map((t) => (WILDCARD.has(t) ? '*' : t));
  while (toks[0] === '*') toks.shift();
  while (toks[toks.length - 1] === '*') toks.pop();
  return toks;
}

const bySense = (a: WordBankEntry, b: WordBankEntry) =>
  a.sense_number - b.sense_number || Number(!!b.image_url) - Number(!!a.image_url);

export function extractLyricVocab(source: string, bank: WordBankEntry[]): LyricVocab {
  const lines = cleanLyricLines(source);
  const toks = tokenize(lines);
  const words = toks.map((t) => t.w);

  // 사전 색인: 낱말(한 단어)과 숙어(두 단어 이상)로 나눈다.
  const byWord = new Map<string, WordBankEntry[]>();
  const skipWords = new Set<string>();
  const phraseDefs: { key: string; display: string; meaning: string; entry: WordBankEntry | null; pat: string[] }[] = [];
  const seenPhrase = new Set<string>();
  for (const e of [...bank].sort(bySense)) {
    const pat = phraseTokens(e.word);
    const isPhrase = pat.length >= 2 && (IDIOM_PARTS_OF_SPEECH.includes(e.part_of_speech) || /\s/.test(e.word.trim()));
    if (isPhrase) {
      const key = pat.join(' ');
      if (seenPhrase.has(key)) continue;
      seenPhrase.add(key);
      phraseDefs.push({ key, display: e.word, meaning: e.meaning, entry: e, pat });
      continue;
    }
    const lower = e.word.toLowerCase().trim();
    if (!lower) continue;
    if (SKIP_POS.has(e.part_of_speech)) {
      skipWords.add(lower);
      continue;
    }
    const list = byWord.get(lower) ?? [];
    list.push(e);
    byWord.set(lower, list);
  }
  for (const [phrase, meaning] of [...BASIC_PHRASES, ...MORE_PHRASES]) {
    const pat = phraseTokens(phrase);
    const key = pat.join(' ');
    if (pat.length < 2 || seenPhrase.has(key)) continue;
    seenPhrase.add(key);
    phraseDefs.push({ key, display: phrase, meaning, entry: null, pat });
  }

  // 숙어: 모든 위치에서 찾고, 더 긴 숙어 안에 들어간 짧은 숙어는 뺀다.
  interface Occ { def: number; start: number; end: number }
  const occs: Occ[] = [];
  phraseDefs.forEach((def, di) => {
    for (let i = 0; i < words.length; i++) {
      const end = matchFrom(words, i, def.pat, 0);
      if (end > i) occs.push({ def: di, start: i, end });
    }
  });
  occs.sort((a, b) => b.end - b.start - (a.end - a.start) || a.def - b.def);
  const kept: Occ[] = [];
  for (const o of occs) {
    if (!kept.some((k) => k.start <= o.start && k.end >= o.end)) kept.push(o);
  }
  const phraseMap = new Map<number, LyricPhrase>();
  for (const o of kept.sort((a, b) => a.start - b.start)) {
    const def = phraseDefs[o.def];
    const prev = phraseMap.get(o.def);
    if (prev) {
      prev.count += 1;
      continue;
    }
    phraseMap.set(o.def, {
      key: def.key,
      phrase: def.display,
      meaning: def.meaning,
      entry: def.entry,
      count: 1,
      firstAt: o.start,
      example: lines[toks[o.start].line] ?? '',
    });
  }

  // 낱말: 사전 표제어로 모으고, 못 찾은 것은 "사전에 없는 낱말"로.
  const wordMap = new Map<string, LyricWord>();
  const unknownMap = new Map<string, LyricUnknown>();
  toks.forEach((t, i) => {
    const w = t.w;
    if (w.length < 2 || STOP.has(w)) return;
    const hitKey = baseForms(w).find((f) => byWord.has(f));
    if (hitKey) {
      const prev = wordMap.get(hitKey);
      if (prev) prev.count += 1;
      else wordMap.set(hitKey, { key: hitKey, senses: byWord.get(hitKey)!, count: 1, firstAt: i, example: lines[t.line] ?? '' });
      return;
    }
    if (w.length < 3 || FILLER.has(w) || baseForms(w).some((f) => skipWords.has(f) || STOP.has(f) || FILLER.has(f))) return;
    const prev = unknownMap.get(w);
    if (prev) prev.count += 1;
    else unknownMap.set(w, { key: w, count: 1, firstAt: i, example: lines[t.line] ?? '' });
  });

  const byFirst = <T extends { firstAt: number }>(a: T, b: T) => a.firstAt - b.firstAt;
  return {
    words: [...wordMap.values()].sort(byFirst),
    phrases: [...phraseMap.values()].sort(byFirst),
    unknown: [...unknownMap.values()].sort(byFirst),
    lineCount: lines.length,
  };
}
