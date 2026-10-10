/**
 * Rainbow Grammar(2026-10-11) — 품사·역할 색으로 문장을 보는 방식.
 *
 * 두 가지 층이 있고 서로 섞지 않는다.
 *  1) 단어 보기(품사색): 단어 하나하나의 품사. 말하기 슬라이드(초급)가 쓴다.
 *  2) 구조 보기(역할색): 구·절 덩어리가 문장에서 하는 일(명사·형용사·부사 역할) + 모든 절의 동사.
 *     긴 문장에서 어디까지가 주어·목적어 덩어리인지 한눈에 보려고 쓴다(사용자 결정 2026-10-11).
 * 색은 문장 성분(S/V/O)이 아니라 품사/역할이다. 주어·목적어 이름은 색이 아니라 위치로 안다.
 * 7색 최종 승인 전이므로 색 코드는 이 파일의 RAINBOW_THEME 한 곳에서만 바꾼다.
 */

export type Pos =
  | 'noun'
  | 'pronoun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'determiner'
  | 'conjunction'
  | 'interjection'
  | 'other';

export type ChunkRole = 'WHO' | 'ACTION' | 'WHAT' | 'WHERE' | 'TO' | 'OTHER';

/** 구조 보기에서 덩어리가 하는 역할(명사·형용사·부사). 동사는 낱말(토큰)에 칠한다. */
export type PhraseRole = 'noun' | 'adj' | 'adv';

interface ColorPair {
  /** 칸 배경 */
  bg: string;
  /** 테두리·밑줄 */
  line: string;
}

export const RAINBOW_THEME: {
  pos: Record<Pos, ColorPair | null>;
  role: Record<PhraseRole | 'verb', ColorPair>;
} = {
  pos: {
    noun: { bg: '#F8DADC', line: '#E57373' },
    pronoun: { bg: '#F8DADC', line: '#E57373' },
    verb: { bg: '#FFF0AC', line: '#E0B400' },
    adjective: { bg: '#D9F1DB', line: '#4CAF50' },
    adverb: { bg: '#FFE4C6', line: '#F28C28' },
    preposition: { bg: '#DCEAFD', line: '#4A90E2' },
    determiner: { bg: '#E4E1FB', line: '#6C63D6' },
    conjunction: { bg: '#F0DDF9', line: '#A855C7' },
    interjection: null,
    other: null,
  },
  role: {
    noun: { bg: '#F8DADC', line: '#E57373' },
    adj: { bg: '#D9F1DB', line: '#4CAF50' },
    adv: { bg: '#FFE4C6', line: '#F28C28' },
    verb: { bg: '#FFF0AC', line: '#E0B400' },
  },
};

/** 색만으로 구분하지 않도록 품사 이름도 함께 보여 준다 */
export const POS_LABEL_KO: Record<Pos, string> = {
  noun: '명사',
  pronoun: '대명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  preposition: '전치사',
  determiner: '한정사',
  conjunction: '접속사',
  interjection: '감탄사',
  other: '',
};

export const ROLE_LABEL_KO: Record<PhraseRole | 'verb', string> = {
  noun: '명사 역할',
  adj: '형용사 역할',
  adv: '부사 역할',
  verb: '동사',
};

/* ---------------- 그림 보고 말하기(6단계) ---------------- */

export interface RToken {
  id: string;
  text: string;
  pos: Pos;
}

export interface RChunk {
  id: string;
  label: ChunkRole;
  tokenIds: string[];
}

export interface SpeakingItem {
  id: string;
  koreanPrompt: string;
  englishAnswer: string;
  imageMain: string;
  imageTransfer: string;
  tokens: RToken[];
  chunks: RChunk[];
  /** 공개 순서(청크 id) */
  revealOrder: string[];
  /** 그림 속 아이가 되어 말하게 하는 안내 */
  selfTalkCue?: string;
}

/** 칸마다 학생에게 하는 질문 */
export const CHUNK_QUESTION_KO: Record<ChunkRole, string> = {
  WHO: '누가 하는 거야?',
  ACTION: '어떤 동작이야?',
  WHAT: '무엇을?',
  WHERE: '어디에서?',
  TO: '어디를 향해서?',
  OTHER: '또 무슨 말이 필요해?',
};

export const SPEAKING_ITEMS: SpeakingItem[] = [
  {
    id: 'soccer-kick-01',
    koreanPrompt: '나는 골대를 향해서 공을 찬다.',
    englishAnswer: 'I kick the ball toward the goal.',
    imageMain: '/rainbow/soccer-main.webp',
    imageTransfer: '/rainbow/soccer-transfer.webp',
    selfTalkCue: '그림 속 아이가 되어 말해 봐.',
    tokens: [
      { id: 't1', text: 'I', pos: 'pronoun' },
      { id: 't2', text: 'kick', pos: 'verb' },
      { id: 't3', text: 'the', pos: 'determiner' },
      { id: 't4', text: 'ball', pos: 'noun' },
      { id: 't5', text: 'toward', pos: 'preposition' },
      { id: 't6', text: 'the', pos: 'determiner' },
      { id: 't7', text: 'goal.', pos: 'noun' },
    ],
    chunks: [
      { id: 'c1', label: 'WHO', tokenIds: ['t1'] },
      { id: 'c2', label: 'ACTION', tokenIds: ['t2'] },
      { id: 'c3', label: 'WHAT', tokenIds: ['t3', 't4'] },
      { id: 'c4', label: 'TO', tokenIds: ['t5', 't6', 't7'] },
    ],
    revealOrder: ['c1', 'c2', 'c3', 'c4'],
  },
  {
    id: 'reading-park-01',
    koreanPrompt: '나는 공원에서 책을 읽는다.',
    englishAnswer: 'I read a book in the park.',
    imageMain: '/rainbow/reading-main.webp',
    imageTransfer: '/rainbow/reading-transfer.webp',
    selfTalkCue: '그림 속 아이가 되어 말해 봐.',
    tokens: [
      { id: 't1', text: 'I', pos: 'pronoun' },
      { id: 't2', text: 'read', pos: 'verb' },
      { id: 't3', text: 'a', pos: 'determiner' },
      { id: 't4', text: 'book', pos: 'noun' },
      { id: 't5', text: 'in', pos: 'preposition' },
      { id: 't6', text: 'the', pos: 'determiner' },
      { id: 't7', text: 'park.', pos: 'noun' },
    ],
    chunks: [
      { id: 'c1', label: 'WHO', tokenIds: ['t1'] },
      { id: 'c2', label: 'ACTION', tokenIds: ['t2'] },
      { id: 'c3', label: 'WHAT', tokenIds: ['t3', 't4'] },
      { id: 'c4', label: 'WHERE', tokenIds: ['t5', 't6', 't7'] },
    ],
    revealOrder: ['c1', 'c2', 'c3', 'c4'],
  },
];

/** 단계 수 = 청크 수 + 2(상황 이해 1 + 청크 공개 N + 독립 말하기 1) */
export const stageCount = (item: SpeakingItem) => item.revealOrder.length + 2;

/* ---------------- 구조 보기(역할색, 긴 문장) ---------------- */

export interface SToken {
  text: string;
  /** 동사면 'verb' — 절마다의 동사를 모두 노랑으로 칠한다 */
  pos?: 'verb';
  /** 덩어리의 경계를 알려 주는 말(to, that, who, because, and, 전치사 …) */
  marker?: boolean;
}

export interface SSpan {
  /** 토큰 번호(양 끝 포함) */
  from: number;
  to: number;
  role: PhraseRole;
  /** 덩어리 이름(to부정사, that절, 관계사절, 전치사구 …) */
  kind?: string;
}

export interface StructureItem {
  id: string;
  sentence: string;
  ko: string;
  tokens: SToken[];
  spans: SSpan[];
  /** 읽는 순서 안내(한 줄) */
  note: string;
  /** 난이도 표시용(1 쉬움~3) */
  level: 1 | 2 | 3;
}

/** 손으로 검수한 구조 예문(초안 — 선생님 검수 전). */
export const STRUCTURE_ITEMS: StructureItem[] = [
  {
    id: 'st-want-read',
    sentence: 'I want to read a book in the park.',
    ko: '나는 공원에서 책을 읽고 싶다.',
    level: 1,
    tokens: [
      { text: 'I' },
      { text: 'want', pos: 'verb' },
      { text: 'to', marker: true },
      { text: 'read', pos: 'verb' },
      { text: 'a' },
      { text: 'book' },
      { text: 'in', marker: true },
      { text: 'the' },
      { text: 'park.' },
    ],
    spans: [
      { from: 0, to: 0, role: 'noun' },
      { from: 2, to: 8, role: 'noun', kind: 'to부정사' },
      { from: 4, to: 5, role: 'noun' },
      { from: 6, to: 8, role: 'adv', kind: '전치사구' },
      { from: 7, to: 8, role: 'noun' },
    ],
    note: '동사 want 앞의 빨강 = 하는 사람, 뒤의 큰 빨강 덩어리(to read …) = 바라는 것. 그 안에 부사 덩어리(장소)가 들어 있어요.',
  },
  {
    id: 'st-reading-news',
    sentence: 'Reading English newspapers every day helps you understand the world better.',
    ko: '영어 신문을 매일 읽는 것은 네가 세상을 더 잘 이해하도록 도와준다.',
    level: 2,
    tokens: [
      { text: 'Reading', pos: 'verb' },
      { text: 'English' },
      { text: 'newspapers' },
      { text: 'every' },
      { text: 'day' },
      { text: 'helps', pos: 'verb' },
      { text: 'you' },
      { text: 'understand', pos: 'verb' },
      { text: 'the' },
      { text: 'world' },
      { text: 'better.' },
    ],
    spans: [
      { from: 0, to: 4, role: 'noun', kind: '동명사구' },
      { from: 1, to: 2, role: 'noun' },
      { from: 1, to: 1, role: 'adj' },
      { from: 3, to: 4, role: 'adv' },
      { from: 6, to: 6, role: 'noun' },
      { from: 8, to: 9, role: 'noun' },
      { from: 10, to: 10, role: 'adv' },
    ],
    note: 'helps 앞의 긴 빨강 덩어리 전체가 하나의 주어예요. Reading으로 시작해도 이 덩어리는 명사 역할이에요.',
  },
  {
    id: 'st-relative',
    sentence: 'The girl who lives next door plays the piano very well.',
    ko: '옆집에 사는 소녀는 피아노를 아주 잘 친다.',
    level: 2,
    tokens: [
      { text: 'The' },
      { text: 'girl' },
      { text: 'who', marker: true },
      { text: 'lives', pos: 'verb' },
      { text: 'next' },
      { text: 'door' },
      { text: 'plays', pos: 'verb' },
      { text: 'the' },
      { text: 'piano' },
      { text: 'very' },
      { text: 'well.' },
    ],
    spans: [
      { from: 0, to: 5, role: 'noun' },
      { from: 2, to: 5, role: 'adj', kind: '관계사절' },
      { from: 4, to: 5, role: 'adv' },
      { from: 7, to: 8, role: 'noun' },
      { from: 9, to: 10, role: 'adv' },
    ],
    note: '주어 덩어리(빨강) 안에 초록 덩어리(who lives next door)가 girl을 꾸며요. 진짜 동사는 노랑 두 개 중 plays예요.',
  },
  {
    id: 'st-because',
    sentence: 'Because it was raining heavily, we decided to stay at home and watch a movie.',
    ko: '비가 심하게 와서 우리는 집에서 영화를 보기로 했다.',
    level: 2,
    tokens: [
      { text: 'Because', marker: true },
      { text: 'it' },
      { text: 'was', pos: 'verb' },
      { text: 'raining', pos: 'verb' },
      { text: 'heavily,' },
      { text: 'we' },
      { text: 'decided', pos: 'verb' },
      { text: 'to', marker: true },
      { text: 'stay', pos: 'verb' },
      { text: 'at', marker: true },
      { text: 'home' },
      { text: 'and', marker: true },
      { text: 'watch', pos: 'verb' },
      { text: 'a' },
      { text: 'movie.' },
    ],
    spans: [
      { from: 0, to: 4, role: 'adv', kind: '부사절' },
      { from: 1, to: 1, role: 'noun' },
      { from: 4, to: 4, role: 'adv' },
      { from: 5, to: 5, role: 'noun' },
      { from: 7, to: 14, role: 'noun', kind: 'to부정사' },
      { from: 9, to: 10, role: 'adv', kind: '전치사구' },
      { from: 13, to: 14, role: 'noun' },
    ],
    note: '문장 맨 앞의 주황 덩어리(Because …)는 이유를 말해 주는 부사절이에요. 진짜 주어는 we, 진짜 동사는 decided예요.',
  },
  {
    id: 'st-that-clause',
    sentence: 'The government announced that it would raise taxes to reduce the huge budget deficit next year.',
    ko: '정부는 내년에 거대한 예산 적자를 줄이기 위해 세금을 올리겠다고 발표했다.',
    level: 3,
    tokens: [
      { text: 'The' },
      { text: 'government' },
      { text: 'announced', pos: 'verb' },
      { text: 'that', marker: true },
      { text: 'it' },
      { text: 'would', pos: 'verb' },
      { text: 'raise', pos: 'verb' },
      { text: 'taxes' },
      { text: 'to', marker: true },
      { text: 'reduce', pos: 'verb' },
      { text: 'the' },
      { text: 'huge' },
      { text: 'budget' },
      { text: 'deficit' },
      { text: 'next' },
      { text: 'year.' },
    ],
    spans: [
      { from: 0, to: 1, role: 'noun' },
      { from: 3, to: 15, role: 'noun', kind: 'that절' },
      { from: 4, to: 4, role: 'noun' },
      { from: 7, to: 7, role: 'noun' },
      { from: 8, to: 13, role: 'adv', kind: 'to부정사(목적)' },
      { from: 10, to: 13, role: 'noun' },
      { from: 11, to: 11, role: 'adj' },
      { from: 14, to: 15, role: 'adv' },
    ],
    note: '동사 announced 뒤에 빨강 큰 덩어리(that절) 하나가 "발표한 내용"이에요. 그 안에 또 동사(raise)와 목적을 말하는 주황 덩어리가 들어 있어요.',
  },
];

/** 덩어리 트리(구조 보기 렌더링용) — 같은 범위는 먼저 나온 것이 바깥 */
export interface SNode {
  span: SSpan;
  depth: number;
  children: SNode[];
}

export function buildSpanTree(spans: SSpan[]): SNode[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from || b.to - a.to);
  const roots: SNode[] = [];
  const stack: SNode[] = [];
  for (const span of sorted) {
    while (stack.length && stack[stack.length - 1].span.to < span.from) stack.pop();
    // 바깥 덩어리 범위를 벗어나는 겹침은 허용하지 않고 같은 층에 둔다
    while (stack.length && span.to > stack[stack.length - 1].span.to) stack.pop();
    const node: SNode = { span, depth: stack.length, children: [] };
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

export function maxDepth(spans: SSpan[]): number {
  const walk = (nodes: SNode[]): number => nodes.reduce((m, n) => Math.max(m, n.depth + 1, walk(n.children)), 0);
  return walk(buildSpanTree(spans));
}

/** 자료 검사(개발용): 범위가 토큰 안에 있고 서로 부분적으로 겹치지 않는지 */
export function structureProblems(item: StructureItem): string[] {
  const p: string[] = [];
  const n = item.tokens.length;
  for (const s of item.spans) {
    if (s.from < 0 || s.to >= n || s.from > s.to) p.push(`범위 밖: ${s.from}-${s.to}`);
  }
  for (const a of item.spans)
    for (const b of item.spans) {
      if (a === b) continue;
      const cross = a.from < b.from && b.from <= a.to && a.to < b.to;
      if (cross) p.push(`겹침: ${a.from}-${a.to} / ${b.from}-${b.to}`);
    }
  return p;
}

/* ---------------- 사전의 한국어 품사 이름 → 품사 색·한 줄 설명(낱말 만나기에서 보여 준다) ---------------- */

const POS_FROM_KO: Record<string, Pos> = {
  명사: 'noun',
  대명사: 'pronoun',
  동사: 'verb',
  조동사: 'verb',
  형용사: 'adjective',
  부사: 'adverb',
  전치사: 'preposition',
  관사: 'determiner',
  접속사: 'conjunction',
  감탄사: 'interjection',
};

export function posFromKo(ko: string | null | undefined): Pos | null {
  return (ko && POS_FROM_KO[ko.trim()]) || null;
}

export const POS_HINT_KO: Record<string, string> = {
  명사: '사람·동물·물건의 이름을 나타내는 말',
  대명사: '이름 대신 쓰는 말',
  동사: '동작이나 상태를 나타내는 말',
  조동사: '동사를 도와주는 말',
  형용사: '모습이나 느낌을 꾸며 주는 말',
  부사: '어떻게·언제·어디서를 더해 주는 말',
  전치사: '위치·방향·때를 나타내는 말',
  관사: '명사 앞에 붙는 a, an, the',
  접속사: '말과 말을 이어 주는 말',
  감탄사: '느낌을 나타내는 말',
  수사: '수를 나타내는 말',
  숙어: '여러 낱말이 한 덩어리로 쓰이는 말',
  표현: '자주 쓰는 말',
};

/** 품사 색 이름(설명 글에 쓴다) — 위 RAINBOW_THEME 색을 바꾸면 여기도 같이 고친다 */
export const POS_COLOR_NAME_KO: Record<string, string> = {
  명사: '빨간색',
  대명사: '빨간색',
  동사: '노란색',
  조동사: '노란색',
  형용사: '초록색',
  부사: '주황색',
  전치사: '파란색',
  관사: '남색',
  접속사: '보라색',
};

/** 선택지 글: "명사 (사람·동물·물건의 이름을 나타내는 말)" */
export const posOptionLabel = (ko: string) => (POS_HINT_KO[ko] ? `${ko} (${POS_HINT_KO[ko]})` : ko);
