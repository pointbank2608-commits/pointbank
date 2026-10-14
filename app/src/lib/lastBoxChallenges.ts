/**
 * 마지막 박스 챌린지(2026-10-14, PPT "Chain Reaction")의 도전 카드 만들기 — 선생님이 넣은 단어·문장으로 AI 없이 만든다.
 * PPT 구성: 돌림판이 듣기(보라)·말하기(파랑)·쓰기(초록)·마음대로(분홍)·건너뛰기(주황)를 가리키고, 기술마다 5가지 도전이 있다.
 */

export type ChallengeSkill = 'listening' | 'speaking' | 'writing';
export type ChallengeKind =
  | 'spell'
  | 'fixsent'
  | 'whisperS'
  | 'code'
  | 'whisperW'
  | 'rebus'
  | 'qchain'
  | 'makesent'
  | 'jumble'
  | 'describe'
  | 'unscramble'
  | 'write6'
  | 'fixwrite'
  | 'unscramble2'
  | 'write3';

export const CHALLENGE_KINDS: Record<ChallengeSkill, ChallengeKind[]> = {
  listening: ['spell', 'fixsent', 'whisperS', 'code', 'whisperW'],
  speaking: ['rebus', 'qchain', 'makesent', 'jumble', 'describe'],
  writing: ['unscramble', 'write6', 'fixwrite', 'unscramble2', 'write3'],
};

export interface Challenge {
  skill: ChallengeSkill;
  kind: ChallengeKind;
  /** 보여 줄 재료 — 종류마다 모양이 다르다 */
  main: string;
  /** 정답·해설(눌러서 본다) */
  answer: string;
  /** 보조 줄들: 섞인 조각, 코드 카드, 틀린 문장 등 */
  parts: string[];
  /** 한글 해석(있으면) */
  ko: string;
}

export interface PoolItem {
  text: string;
  ko: string;
}

/** 항목은 "영어 | 해석" 꼴일 수 있다 */
export function parsePool(labels: string[]): PoolItem[] {
  return labels
    .map((raw) => {
      const cut = raw.indexOf(' | ');
      return cut >= 0 ? { text: raw.slice(0, cut).trim(), ko: raw.slice(cut + 3).trim() } : { text: raw.trim(), ko: '' };
    })
    .filter((p) => p.text);
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

const stripPunct = (w: string) => w.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');

/** 도전 재료로 쓰기 어려운 짧은 기능어 */
const STOP = new Set(['the', 'and', 'are', 'was', 'for', 'but', 'not', 'you', 'his', 'her', 'its', 'our', 'can', 'she', 'has', 'had', 'with', 'that', 'this', 'from', 'will', 'have', 'they', 'what', 'when']);

/** 섞은 조각 보여 주기용 — 마침표를 떼고, 문장 첫 낱말은 소문자로(I 제외) */
function chipsOf(sentence: string): string[] {
  const ws = wordsOf(sentence).map((w, i, arr) => {
    let x = w;
    if (i === arr.length - 1) x = x.replace(/[.!?]+$/, '');
    if (i === 0 && x !== 'I' && !/^I'/.test(x)) x = x.charAt(0).toLowerCase() + x.slice(1);
    return x;
  });
  return ws;
}
const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean);

/** 흔한 낱말(낱말 퍼즐의 재료가 모자랄 때 보충) */
const COMMON = [
  'storm', 'fries', 'car', 'cat', 'bat', 'hat', 'bag', 'bed', 'bee', 'book', 'bus', 'cake', 'dog', 'door', 'duck', 'egg', 'fish', 'frog',
  'hand', 'horse', 'house', 'king', 'lamp', 'milk', 'moon', 'nose', 'pen', 'pig', 'rain', 'ring', 'sun', 'star', 'tree', 'train', 'water',
  'cart', 'chair', 'plant', 'plane', 'smile', 'snake', 'snow', 'stone', 'story', 'table', 'tiger', 'toast', 'cook', 'clock', 'cloud', 'crab',
  'draw', 'dress', 'drum', 'farm', 'feet', 'flag', 'fork', 'goat', 'gold', 'grass', 'green', 'hill', 'jump', 'kite', 'leaf', 'lion', 'mouse',
  'night', 'paint', 'pink', 'queen', 'rabbit', 'river', 'rose', 'sheep', 'ship', 'shoe', 'sing', 'sleep', 'spoon', 'swim', 'tent', 'wolf',
];

const QUESTIONS = [
  'What is your name?',
  'How old are you?',
  'What do you like?',
  'Where do you live?',
  'What is your favorite color?',
  'What do you do after school?',
  'Do you have a pet?',
  'What is your favorite food?',
  'What time do you get up?',
  'How are you today?',
];

function scrambleLetters(w: string): string {
  const letters = [...w];
  if (letters.length < 2) return w;
  for (let k = 0; k < 10; k++) {
    const s = shuffle(letters).join('');
    if (s !== w) return s;
  }
  return [...letters].reverse().join('');
}

function scrambleWords(ws: string[]): string[] {
  if (ws.length < 2) return ws;
  for (let k = 0; k < 10; k++) {
    const s = shuffle(ws);
    if (s.join(' ') !== ws.join(' ')) return s;
  }
  return [...ws].reverse();
}

/** 문장을 일부러 틀리게 — 이웃한 두 낱말을 바꾸거나 낱말 하나를 다른 낱말로 */
function breakSentence(sentence: string, vocab: string[]): string {
  const m = sentence.trim().match(/^(.*?)([.!?]*)$/);
  const body = m ? m[1] : sentence;
  const end = m ? m[2] : '';
  const ws = wordsOf(body);
  // 이웃한 두 낱말 바꾸기 — 첫 낱말(대문자)은 건드리지 않는다
  if (ws.length >= 4) {
    for (let k = 0; k < 10; k++) {
      const i = 1 + Math.floor(Math.random() * (ws.length - 2));
      const c = [...ws];
      [c[i], c[i + 1]] = [c[i + 1], c[i]];
      if (c.join(' ') !== body && c[i].toLowerCase() !== c[i + 1].toLowerCase()) return c.join(' ') + end;
    }
  }
  // 낱말 하나를 다른 낱말로 바꾸기
  const others = vocab.filter((v) => ws.every((w) => stripPunct(w).toLowerCase() !== v.toLowerCase()));
  if (others.length > 0 && ws.length > 1) {
    const i = 1 + Math.floor(Math.random() * (ws.length - 1));
    const c = [...ws];
    c[i] = pick(others);
    return c.join(' ') + end;
  }
  return [...ws].reverse().join(' ') + end;
}

/** 낱말 퍼즐: "A − 뒤쪽 글자 + B − 앞쪽 글자 = 목표 낱말" */
function buildRebus(target: string, pool: string[]): { expr: string; answer: string } | null {
  const T = target.toLowerCase();
  if (T.length < 4 || T.length > 10 || !/^[a-z]+$/.test(T)) return null;
  const cands = [...new Set(pool.map((p) => p.toLowerCase()).filter((p) => /^[a-z]+$/.test(p) && p !== T))];
  for (let k = 2; k <= T.length - 2; k++) {
    const head = T.slice(0, k);
    const tail = T.slice(k);
    const As = shuffle(cands.filter((c) => c.startsWith(head) && c.length > k));
    const Bs = shuffle(cands.filter((c) => c.endsWith(tail) && c.length > T.length - k));
    for (const A of As) {
      for (const B of Bs) {
        if (A === B) continue;
        const cutA = A.slice(k);
        const cutB = B.slice(0, B.length - tail.length);
        return { expr: `${A} − ${cutA}   +   ${B} − ${cutB}`, answer: T };
      }
    }
  }
  return null;
}

/** 글자 빈칸 퍼즐(낱말 퍼즐 재료가 없을 때) — 가운데 글자를 가린다 */
function blankPuzzle(w: string): string {
  const L = [...w];
  const hide = new Set<number>();
  const n = Math.max(1, Math.floor(L.length / 2));
  const idx = shuffle(L.map((_, i) => i).filter((i) => i > 0));
  idx.slice(0, n).forEach((i) => hide.add(i));
  return L.map((c, i) => (hide.has(i) ? '＿' : c)).join(' ');
}

/** 도전 카드 하나를 만든다. 재료가 모자라면 같은 기술의 다른 도전으로 넘어간다. */
export function buildChallenge(skill: ChallengeSkill, pool: PoolItem[], avoid?: ChallengeKind): Challenge {
  const sentences = pool.filter((p) => wordsOf(p.text).length >= 3);
  const singles = pool.filter((p) => wordsOf(p.text).length === 1).map((p) => stripPunct(p.text)).filter((w) => w.length >= 2);
  const fromSentences = sentences
    .flatMap((s) => wordsOf(s.text).map(stripPunct))
    .filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase()));
  const vocab = [...new Set([...singles, ...fromSentences])];
  const anyWord = (): string => (vocab.length > 0 ? pick(vocab) : pick(COMMON));
  const anySentence = (): PoolItem | null => (sentences.length > 0 ? pick(sentences) : null);
  const kinds = shuffle(CHALLENGE_KINDS[skill].filter((k) => k !== avoid));

  for (const kind of kinds) {
    const s = anySentence();
    switch (kind) {
      case 'spell': {
        const w = anyWord();
        return { skill, kind, main: w, answer: [...w].join(' - '), parts: [], ko: '' };
      }
      case 'whisperW': {
        const w = anyWord();
        return { skill, kind, main: w, answer: w, parts: [], ko: '' };
      }
      case 'fixsent': {
        if (!s) break;
        return { skill, kind, main: breakSentence(s.text, vocab), answer: s.text, parts: [], ko: s.ko };
      }
      case 'whisperS': {
        if (!s) break;
        return { skill, kind, main: s.text, answer: s.text, parts: [], ko: s.ko };
      }
      case 'code': {
        const cards = shuffle(pool.length >= 6 ? pool.map((p) => p.text) : [...pool.map((p) => p.text), ...shuffle(COMMON)]).slice(0, 6);
        const order = shuffle([1, 2, 3, 4, 5, 6]);
        return { skill, kind, main: order.join(' '), answer: order.join(' - '), parts: cards, ko: '' };
      }
      case 'rebus': {
        for (const w of shuffle(vocab.length > 0 ? vocab : COMMON)) {
          const r = buildRebus(w, [...vocab, ...COMMON]);
          if (r) return { skill, kind, main: r.expr, answer: r.answer, parts: [], ko: '' };
        }
        const w = anyWord();
        return { skill, kind, main: blankPuzzle(w), answer: w, parts: [], ko: '' };
      }
      case 'qchain':
        return { skill, kind, main: pick(QUESTIONS), answer: '', parts: [], ko: '' };
      case 'makesent': {
        const w = anyWord();
        return { skill, kind, main: w, answer: '', parts: [], ko: '' };
      }
      case 'jumble': {
        if (!s) break;
        return { skill, kind, main: '', answer: s.text, parts: scrambleWords(chipsOf(s.text)), ko: s.ko };
      }
      case 'describe': {
        const w = anyWord();
        return { skill, kind, main: w, answer: '', parts: [], ko: '' };
      }
      case 'unscramble': {
        if (!s) break;
        return { skill, kind, main: '', answer: s.text, parts: scrambleWords(chipsOf(s.text)), ko: s.ko };
      }
      case 'write6': {
        const w = anyWord();
        return { skill, kind, main: w, answer: w, parts: [], ko: '' };
      }
      case 'fixwrite': {
        if (!s) break;
        return { skill, kind, main: breakSentence(s.text, vocab), answer: s.text, parts: [], ko: s.ko };
      }
      case 'unscramble2': {
        const a = anyWord();
        let b = anyWord();
        for (let k = 0; k < 6 && b === a; k++) b = anyWord();
        return { skill, kind, main: '', answer: `${a}, ${b}`, parts: [scrambleLetters(a), scrambleLetters(b)], ko: '' };
      }
      case 'write3': {
        const text = s ? s.text : anyWord();
        return { skill, kind, main: text, answer: text, parts: [], ko: s?.ko ?? '' };
      }
    }
  }
  // 어떤 도전도 못 만들면(이론상 없음) 낱말 쓰기
  const w = anyWord();
  return { skill: 'writing', kind: 'write6', main: w, answer: w, parts: [], ko: '' };
}
