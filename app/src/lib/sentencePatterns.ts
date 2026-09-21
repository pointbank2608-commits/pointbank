/**
 * 수박 문장 게임의 문장 틀. 난이도로 보여 줄지 게임 방식으로 보여 줄지는
 * UI(`group`)만 바꾸면 되고, 합치기 규칙은 전부 `slots` 배열을 본다.
 *
 * 나중에 전치사·부사·의문문·1~5형식을 넣을 때:
 * 1. 아래에 패턴 한 줄 추가
 * 2. `playable: true` 로 켜기
 * 3. 필요하면 SENTENCE_SLOTS / slotFromPartOfSpeech 에 성분 추가
 */

export const SENTENCE_SLOTS = [
  'subject',
  'verb',
  'object',
  'complement',
  'prep',
  'adverb',
  'aux',
  'wh',
] as const;

export type SentenceSlot = (typeof SENTENCE_SLOTS)[number];

export type SentencePatternGroup = 'level' | 'mode';

export interface SentencePattern {
  id: string;
  nameKey: string;
  slots: SentenceSlot[];
  /** false 면 데이터만 있고 설정 화면에는 아직 안 나옴. */
  playable: boolean;
  /**
   * 설정 UI 묶음. 지금은 난이도(level)로 보여 주고, 나중에 게임 방식으로
   * 나누고 싶으면 여기만 'mode'로 바꾸면 된다.
   */
  group: SentencePatternGroup;
}

export interface SentenceToken {
  word: string;
  slot: SentenceSlot;
}

export const SENTENCE_PATTERNS: SentencePattern[] = [
  {
    id: 'sv',
    nameKey: 'gameWatermelon.patternSv',
    slots: ['subject', 'verb'],
    playable: true,
    group: 'level',
  },
  {
    id: 'svo',
    nameKey: 'gameWatermelon.patternSvo',
    slots: ['subject', 'verb', 'object'],
    playable: true,
    group: 'level',
  },
  {
    id: 'svo_prep',
    nameKey: 'gameWatermelon.patternSvoPrep',
    slots: ['subject', 'verb', 'object', 'prep'],
    playable: false,
    group: 'level',
  },
  {
    id: 'svo_prep_adv',
    nameKey: 'gameWatermelon.patternSvoPrepAdv',
    slots: ['subject', 'verb', 'object', 'prep', 'adverb'],
    playable: false,
    group: 'level',
  },
  {
    id: 'question_yesno',
    nameKey: 'gameWatermelon.patternQuestion',
    slots: ['aux', 'subject', 'verb'],
    playable: false,
    group: 'mode',
  },
  {
    id: 'form1',
    nameKey: 'gameWatermelon.patternForm1',
    slots: ['subject', 'verb'],
    playable: false,
    group: 'mode',
  },
  {
    id: 'form2',
    nameKey: 'gameWatermelon.patternForm2',
    slots: ['subject', 'verb', 'complement'],
    playable: false,
    group: 'mode',
  },
  {
    id: 'form3',
    nameKey: 'gameWatermelon.patternForm3',
    slots: ['subject', 'verb', 'object'],
    playable: false,
    group: 'mode',
  },
  {
    id: 'form4',
    nameKey: 'gameWatermelon.patternForm4',
    slots: ['subject', 'verb', 'object', 'object'],
    playable: false,
    group: 'mode',
  },
  {
    id: 'form5',
    nameKey: 'gameWatermelon.patternForm5',
    slots: ['subject', 'verb', 'object', 'complement'],
    playable: false,
    group: 'mode',
  },
];

export const DEFAULT_WATERMELON_PATTERN_ID = 'svo';

export function playablePatterns(): SentencePattern[] {
  return SENTENCE_PATTERNS.filter((p) => p.playable);
}

export function getSentencePattern(id: string | null | undefined): SentencePattern {
  return SENTENCE_PATTERNS.find((p) => p.id === id) ?? SENTENCE_PATTERNS.find((p) => p.id === DEFAULT_WATERMELON_PATTERN_ID)!;
}

/** 사전 품사 → 문장 성분. 새 성분이 필요하면 여기만 늘린다. */
export function slotFromPartOfSpeech(pos: string | null | undefined): SentenceSlot | null {
  switch (pos) {
    case '대명사':
      return 'subject';
    case '동사':
      return 'verb';
    case '명사':
      return 'object';
    case '형용사':
      return 'complement';
    case '전치사':
      return 'prep';
    case '부사':
      return 'adverb';
    case '조동사':
      return 'aux';
    case '의문사':
      return 'wh';
    default:
      return null;
  }
}

export function slotLabelKey(slot: SentenceSlot): string {
  return `gameWatermelon.slot.${slot}`;
}

function isPrefix(slots: SentenceSlot[], pattern: SentenceSlot[]): boolean {
  if (slots.length === 0 || slots.length > pattern.length) return false;
  return slots.every((slot, i) => slot === pattern[i]);
}

/** 두 공이 붙었을 때 합쳐질 수 있으면 합친 토큰, 아니면 null. */
export function tryMergeTokens(a: SentenceToken[], b: SentenceToken[], pattern: SentenceSlot[]): SentenceToken[] | null {
  const forward = a.concat(b);
  if (isPrefix(
    forward.map((t) => t.slot),
    pattern,
  )) {
    return forward;
  }
  const backward = b.concat(a);
  if (isPrefix(
    backward.map((t) => t.slot),
    pattern,
  )) {
    return backward;
  }
  return null;
}

export function isCompleteSentence(tokens: SentenceToken[], pattern: SentenceSlot[]): boolean {
  return tokens.length === pattern.length && tokens.every((t, i) => t.slot === pattern[i]);
}

export function phraseText(tokens: SentenceToken[]): string {
  return tokens.map((t) => t.word).join(' ');
}

export const SLOT_COLORS: Record<SentenceSlot, string> = {
  subject: '#5b8def',
  verb: '#3cb371',
  object: '#f4a261',
  complement: '#c77dff',
  prep: '#2a9d8f',
  adverb: '#e76f51',
  aux: '#4cc9f0',
  wh: '#f72585',
};

/** 토큰 개수 → 과일 단계. 단계를 늘리려면 뒤에 과일만 추가. */
export const FRUIT_STAGES = [
  { id: 'cherry', radius: 34, fill: '#f07167', leaf: '#2d6a4f' },
  { id: 'orange', radius: 46, fill: '#f4a261', leaf: '#2d6a4f' },
  { id: 'apple', radius: 58, fill: '#e76f51', leaf: '#40916c' },
  { id: 'peach', radius: 70, fill: '#ffb4a2', leaf: '#2d6a4f' },
  { id: 'melon', radius: 84, fill: '#95d5b2', leaf: '#1b4332' },
  { id: 'watermelon', radius: 96, fill: '#40916c', leaf: '#1b4332' },
] as const;

export function fruitStageForCount(count: number): (typeof FRUIT_STAGES)[number] {
  const i = Math.min(Math.max(count, 1), FRUIT_STAGES.length) - 1;
  return FRUIT_STAGES[i];
}

export function pointsForComplete(pattern: SentencePattern): number {
  return pattern.slots.length * 10;
}

export function asSentenceSlot(value: string | null | undefined): SentenceSlot | null {
  if (!value) return null;
  return (SENTENCE_SLOTS as readonly string[]).includes(value) ? (value as SentenceSlot) : null;
}

export interface SlottedLabel {
  label: string;
  slot: SentenceSlot | null;
}

/** 난이도/방식 UI 묶음. playable 패턴만 모아서, 비어 있는 묶음은 빼 준다. */
export function playablePatternGroups(): { group: SentencePatternGroup; patterns: SentencePattern[] }[] {
  const order: SentencePatternGroup[] = ['level', 'mode'];
  return order
    .map((group) => ({ group, patterns: playablePatterns().filter((p) => p.group === group) }))
    .filter((bundle) => bundle.patterns.length > 0);
}
