/**
 * 문장 공장(2026-11-03): 예문 하나를 규칙으로 여러 문제로 늘린다(AI 없음).
 * be동사·조동사·일반동사의 시제(현재/과거/미래)·부정·의문·주어 바꾸기를 코드로 처리한다.
 * 확실히 아는 문장만 바꾸고(알려진 동사 목록, 대명사·간단한 주어, 시간 표현 없음), 아니면 그 변형은 건너뛴다.
 */
export type FactoryKind = 'past' | 'present' | 'future' | 'negative' | 'question' | 'subjectThey' | 'subjectHe';
export const FACTORY_KINDS: FactoryKind[] = ['past', 'present', 'future', 'negative', 'question', 'subjectThey', 'subjectHe'];

type Person = 'I' | 'you' | 'he' | 'we' | 'they';
type Tense = 'present' | 'past' | 'future';
interface Parsed {
  subj: string;
  person: Person;
  pronoun: boolean;
  kind: 'be' | 'modal' | 'verb';
  tense: Tense;
  head: string; // be 는 'be', 조동사는 그 조동사, 일반동사는 원형
  rest: string[];
}

const IRREGULAR: Record<string, string> = {
  go: 'went', have: 'had', do: 'did', eat: 'ate', see: 'saw', make: 'made', take: 'took', come: 'came', get: 'got', give: 'gave',
  know: 'knew', run: 'ran', read: 'read', write: 'wrote', buy: 'bought', sit: 'sat', sleep: 'slept', swim: 'swam', sing: 'sang',
  drink: 'drank', meet: 'met', say: 'said', tell: 'told', find: 'found', draw: 'drew', ride: 'rode', fly: 'flew', speak: 'spoke',
  wear: 'wore', teach: 'taught', bring: 'brought', think: 'thought', leave: 'left', put: 'put', cut: 'cut', win: 'won', hear: 'heard',
  stand: 'stood', begin: 'began', build: 'built', catch: 'caught', feel: 'felt', keep: 'kept', lose: 'lost', send: 'sent', spend: 'spent',
};
const REGULAR = [
  'play', 'like', 'love', 'want', 'need', 'help', 'walk', 'talk', 'watch', 'cook', 'clean', 'open', 'close', 'visit', 'live', 'work',
  'study', 'learn', 'call', 'look', 'use', 'start', 'finish', 'wash', 'brush', 'jump', 'climb', 'paint', 'dance', 'listen', 'enjoy',
  'carry', 'try', 'cry', 'stop', 'plan', 'hug', 'ask', 'answer', 'wait', 'show', 'move', 'clap', 'kick', 'pick', 'push', 'pull',
  'cover', 'miss', 'smile', 'laugh', 'stay', 'turn', 'bake', 'save', 'share', 'collect', 'invite', 'practice', 'travel', 'wish',
];
const DOUBLE = new Set(['stop', 'plan', 'hug', 'clap']);
const BASES = [...REGULAR, ...Object.keys(IRREGULAR)];
const AUX_BE = new Set(['am', 'is', 'are', 'was', 'were']);
const MODALS = new Set(['can', 'could', 'will', 'would', 'should', 'must', 'may', 'might']);
const PRONOUN: Record<string, Person> = { i: 'I', you: 'you', he: 'he', she: 'he', it: 'he', we: 'we', they: 'they' };
const DETERMINERS = new Set(['the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that']);
const BLOCK_REST = /\b(yesterday|tomorrow|today|now|every|always|usually|often|sometimes|never|last|next|ago|tonight|already|yet|ever|not|no)\b|n't/i;
const BLOCK_SUBJ = /\b(my|your|his|her|our|their|me|him|us|them|myself|yourself|himself|herself|itself|ourselves|themselves|a|an|each other)\b/i;

function third(base: string): string {
  if (base === 'have') return 'has';
  if (/(s|x|z|ch|sh|o)$/.test(base)) return `${base}es`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}
function past(base: string): string {
  if (IRREGULAR[base]) return IRREGULAR[base];
  if (DOUBLE.has(base)) return `${base}${base[base.length - 1]}ed`;
  if (/e$/.test(base)) return `${base}d`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  return `${base}ed`;
}
function baseOf(word: string): { base: string; tense: Tense; third: boolean } | null {
  const w = word.toLowerCase();
  for (const b of BASES) {
    if (w === past(b) && w !== b) return { base: b, tense: 'past', third: false };
  }
  for (const b of BASES) {
    if (w === third(b)) return { base: b, tense: 'present', third: true };
  }
  if (BASES.includes(w)) return { base: w, tense: 'present', third: false };
  return null;
}

function parse(sentence: string): Parsed | null {
  const s = sentence.trim();
  if (!/^[A-Z]/.test(s) || !/\.$/.test(s) || s.includes('?') || s.includes('!') || s.includes(',')) return null;
  const tokens = s.replace(/\.$/, '').split(/\s+/);
  if (tokens.length < 2 || tokens.length > 10) return null;
  let subjLen = 1;
  let pronoun = true;
  let person: Person;
  const first = tokens[0].toLowerCase();
  if (PRONOUN[first]) {
    person = PRONOUN[first];
  } else if (DETERMINERS.has(first) && tokens.length > 2) {
    subjLen = 2;
    pronoun = false;
    person = 'he';
  } else if (/^[A-Z][a-z]+$/.test(tokens[0]) && !AUX_BE.has(first) && !MODALS.has(first) && !baseOf(tokens[0]) && !/^(There|Here|These|Those|What|Who|Where|How|When|Why|Let|Please)$/.test(tokens[0])) {
    pronoun = false;
    person = 'he';
  } else return null;
  const subj = tokens.slice(0, subjLen).join(' ');
  const verbTok = tokens[subjLen];
  const rest = tokens.slice(subjLen + 1);
  if (!verbTok) return null;
  const v = verbTok.toLowerCase();
  if (BLOCK_REST.test(rest.join(' ')) || /n't$/.test(v)) return null;
  const base = { subj, person, pronoun, rest };
  if (AUX_BE.has(v)) return { ...base, kind: 'be', tense: v === 'was' || v === 'were' ? 'past' : 'present', head: 'be' };
  if (MODALS.has(v)) {
    return { ...base, kind: 'modal', tense: 'present', head: v };
  }
  const b = baseOf(verbTok);
  if (!b) return null;
  // 주어와 동사 모양이 맞는지(She play 같은 틀린 문장은 거른다)
  if (b.tense === 'present' && (person === 'he') !== b.third) return null;
  return { ...base, kind: 'verb', tense: b.tense, head: b.base };
}

function beForm(person: Person, tense: Tense): string {
  if (tense === 'past') return person === 'I' || person === 'he' ? 'was' : 'were';
  return person === 'I' ? 'am' : person === 'he' ? 'is' : 'are';
}
function doForm(person: Person, tense: Tense): string {
  return tense === 'past' ? 'did' : person === 'he' ? 'does' : 'do';
}

interface Opts { tense: Tense; neg: boolean; question: boolean; subj: string; person: Person; subjPronoun: boolean; subjectOverride?: string }

function realize(p: Parsed, o: Opts): string {
  const subjText = o.subjectOverride ?? o.subj;
  const subjLower = o.subjPronoun && subjText !== 'I' ? subjText.toLowerCase() : subjText;
  const rest = p.rest.join(' ');
  const tail = rest ? ` ${rest}` : '';
  let out: string;
  if (p.kind === 'be') {
    const form = o.tense === 'future' ? 'will be' : beForm(o.person, o.tense);
    if (o.question) {
      const [aux, ...more] = form.split(' ');
      out = o.tense === 'future' ? `Will ${subjLower} be${tail}?` : `${aux[0].toUpperCase()}${aux.slice(1)} ${subjLower}${more.length ? ' ' + more.join(' ') : ''}${tail}?`;
    } else out = `${subjText} ${o.neg ? (o.tense === 'future' ? 'will not be' : `${form} not`) : form}${tail}.`;
  } else if (p.kind === 'modal') {
    if (o.question) out = `${p.head[0].toUpperCase()}${p.head.slice(1)} ${subjLower}${tail}?`;
    else if (o.neg) out = `${subjText} ${p.head === 'can' ? 'cannot' : `${p.head} not`}${tail}.`;
    else out = `${subjText} ${p.head}${tail}.`;
  } else {
    const base = p.head;
    if (o.question) {
      const aux = o.tense === 'future' ? 'Will' : doForm(o.person, o.tense) === 'does' ? 'Does' : doForm(o.person, o.tense) === 'did' ? 'Did' : 'Do';
      out = `${aux} ${subjLower} ${base}${tail}?`;
    } else if (o.neg) {
      const aux = o.tense === 'future' ? 'will not' : `${doForm(o.person, o.tense)} not`;
      out = `${subjText} ${aux} ${base}${tail}.`;
    } else if (o.tense === 'future') out = `${subjText} will ${base}${tail}.`;
    else if (o.tense === 'past') out = `${subjText} ${past(base)}${tail}.`;
    else out = `${subjText} ${o.person === 'he' ? third(base) : base}${tail}.`;
  }
  return out;
}

const baseOpts = (p: Parsed): Opts => ({ tense: p.tense, neg: false, question: false, subj: p.subj, person: p.person, subjPronoun: p.pronoun });
const restBlocksSubject = (p: Parsed) => BLOCK_SUBJ.test(p.rest.join(' ')) || /\b(himself|herself)\b/i.test(p.rest.join(' '));

export interface FactoryItem { kind: FactoryKind; from: string; to: string }

/** 문장 하나에서 가능한 변형을 모두 만든다. 못 바꾸는 변형은 빠진다. */
export function transformSentence(sentence: string): FactoryItem[] {
  const p = parse(sentence);
  if (!p) return [];
  const from = sentence.trim();
  const out: FactoryItem[] = [];
  const add = (kind: FactoryKind, to: string) => { if (to && to !== from) out.push({ kind, from, to }); };
  const o = baseOpts(p);
  add('negative', realize(p, { ...o, neg: true }));
  // 1·2인칭 주어의 문장은 의문문이 되면 my/your 가 바뀌어야 하므로 소유격·재귀 대명사가 있으면 건너뛴다
  if (!(p.person !== 'he' && /\b(my|your|our|me|us|myself|yourself|ourselves)\b/i.test(p.rest.join(' ')))) add('question', realize(p, { ...o, question: true }));
  if (p.kind !== 'modal') {
    if (p.tense !== 'past') add('past', realize(p, { ...o, tense: 'past' }));
    if (p.tense !== 'present') add('present', realize(p, { ...o, tense: 'present' }));
    if (p.kind === 'verb' || p.kind === 'be') add('future', realize(p, { ...o, tense: 'future' }));
  }
  if (p.pronoun && !restBlocksSubject(p)) {
    if (p.person !== 'they') add('subjectThey', realize(p, { ...o, person: 'they', subj: 'They', subjectOverride: 'They', subjPronoun: true }));
    if (p.person !== 'he') add('subjectHe', realize(p, { ...o, person: 'he', subj: 'He', subjectOverride: 'He', subjPronoun: true }));
  }
  return out;
}

/** 문장 여러 개에서 변형 문제를 만든다: 문장마다 최대 perSentence 개, 종류가 고루 나오게 */
export function buildFactoryItems(sentences: string[], opts: { perSentence?: number; max?: number } = {}): FactoryItem[] {
  const per = opts.perSentence ?? 4;
  const max = opts.max ?? 24;
  const all = sentences.map((s) => transformSentence(s)).filter((x) => x.length > 0);
  const used: Record<string, number> = {};
  const out: FactoryItem[] = [];
  for (const group of all) {
    const ordered = [...group].sort((a, b) => (used[a.kind] ?? 0) - (used[b.kind] ?? 0));
    for (const it of ordered.slice(0, per)) {
      used[it.kind] = (used[it.kind] ?? 0) + 1;
      out.push(it);
      if (out.length >= max) return out;
    }
  }
  return out;
}
