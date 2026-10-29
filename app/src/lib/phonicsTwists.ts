import type { PhonicsGame } from './phonicsGames';

/**
 * 게임마다 다른 규칙(3단계). 같은 조작 틀(고르기·분류·빈칸…)을 쓰는 게임이 서로 다르게 느껴지도록,
 * 게임 id 별로 "시간 도전·카드 여러 장·소리만 듣기·같은 단어를 다른 모습으로" 규칙을 붙인다.
 * 게임 내용·단어 풀·DB 는 바꾸지 않고, 한 판(RoundActivity)의 진행 방식만 바뀐다.
 */
export type PlayForm = 'hear-picture' | 'picture-word' | 'word-picture' | 'hear-word';
export interface Twist {
  /** 한 문제의 제한 시간(초, 보통 난이도 기준). 쉬움은 없음, 도전은 70%. 시간이 끝나면 정답을 반짝여 알려 주고 도움 후 완성이 된다. */
  clock?: number;
  /** 문제마다 돌아가며 바뀌는 "같은 단어, 다른 모습"(단서 → 답). 첫 항목이 그 게임의 원래 모습이다. */
  forms?: PlayForm[];
  /** 한 문제에 카드를 여러 장 차례로 처리(컨베이어). */
  batch?: number;
  /** 글자 없이 소리만 듣고 고른다(소리 구별 게임). */
  listenOnly?: boolean;
  /** 세션 하트(문제를 틀리면 줄고 0이 되면 도우미가 다음 문제를 쉽게 해 준다). 팀 대결에서는 쓰지 않는다. */
  lives?: number;
  /** 마지막 문제는 보스 문제: 도전 난이도(그림 없음)로 풀고 별이 2배. */
  boss?: boolean;
  /** 그림 없이 소리만 듣고 채운다(받아쓰기처럼). */
  blind?: boolean;
  /** 비슷한 낱말 조각(한 소리 묶음의 낱개 글자)을 보기에 섞는다. */
  decoys?: boolean;
}
export const TWISTS: Record<string, Twist> = {
  'sound-balloons': { clock: 12 },
  'sound-fishing': { clock: 12, forms: ['hear-picture', 'picture-word', 'hear-picture', 'word-picture'] },
  'r-journey': { forms: ['hear-picture', 'hear-word'] },
  'rescue-e': { clock: 15, lives: 3 },
  'sound-steps': { clock: 25 },
  'sorting-factory': { batch: 3 },
  'magic-families': { batch: 3 },
  'two-oo': { listenOnly: true },
  'vowel-chef': { batch: 2 },
  'digraph-friends': { decoys: true },
  'consonant-repair': { blind: true, lives: 3 },
  'monster-diner': { forms: ['word-picture', 'picture-word'], lives: 3 },
  'space-rescue': { lives: 3, boss: true },
  'dino-expedition': { lives: 3, boss: true },
  'phonics-farm': { boss: true },
  'phonics-island': { boss: true },
  'our-storybook': { boss: true },
  'word-treasure': { forms: ['word-picture', 'hear-word'], boss: true },
  'blend-launch': { boss: true },
  'ow-crossroads': { listenOnly: true },
};
export const twistOf = (g: Pick<PhonicsGame, 'id'>): Twist => TWISTS[g.id] ?? {};

/** 이번 문제에서 쓰는 시간(초). 0 이면 시간 제한 없음. */
export function clockSeconds(t: Twist, level: 'easy' | 'normal' | 'hard'): number {
  if (!t.clock || level === 'easy') return 0;
  return Math.round(t.clock * (level === 'hard' ? 0.7 : 1));
}

/** 원래 모습이면 undefined, 바뀐 모습이면 그 모습. 그림이 없거나 도전 난이도면 그림 단서는 소리 단서로 바꾼다. */
export function formFor(t: Twist, index: number, level: 'easy' | 'normal' | 'hard', hasPicture: boolean): PlayForm | undefined {
  if (!t.forms?.length) return undefined;
  let f = t.forms[index % t.forms.length];
  if ((f === 'picture-word' || f === 'word-picture') && f !== t.forms[0] && (!hasPicture || level === 'hard')) f = 'hear-word';
  return f === t.forms[0] ? undefined : f;
}
