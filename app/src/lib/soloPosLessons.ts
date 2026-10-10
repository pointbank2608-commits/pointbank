import { POS_COLOR_NAME_KO } from './rainbow';
import type { SoloStep } from './soloLessons';
import { posChoices } from './soloLessons';

/**
 * "품사 알아보기" 개별수업(2026-10-11, 무지개 문법) — 낱말의 종류를 색과 함께 배운다.
 * 짜임: 소개 → 품사 하나씩 설명 카드(색 이름·예 낱말) → 낱말이 무슨 말인지 고르기 → 문장 속 표시된 낱말 고르기 → (2편) 색 문장 말하기.
 * 낱말·문장은 손으로 고른 초등 수준이며(사전 품사와 같은 이름), 선생님이 "고치기"에서 마음대로 바꿀 수 있다.
 */

interface PosCard {
  pos: string;
  title: string;
  explain: string;
  lines: string[];
}

const CARDS_1: PosCard[] = [
  {
    pos: '명사',
    title: '명사 — 이름을 나타내는 말',
    explain: '사람, 동물, 물건, 장소의 이름이에요. I, you, she처럼 이름 대신 쓰는 말(대명사)도 같은 색이에요.',
    lines: ['dog 강아지', 'apple 사과', 'school 학교', 'Tom 톰'],
  },
  {
    pos: '동사',
    title: '동사 — 움직임이나 상태를 나타내는 말',
    explain: '무엇을 하는지, 어떤 상태인지 말해 줘요. 문장에는 꼭 하나 있어요.',
    lines: ['run 달리다', 'eat 먹다', 'kick 차다', 'is ~이다'],
  },
  {
    pos: '형용사',
    title: '형용사 — 모습이나 느낌을 꾸며 주는 말',
    explain: '명사가 어떤지 알려 줘요. 크기, 색깔, 기분, 느낌 같은 것이에요.',
    lines: ['big 큰', 'happy 행복한', 'red 빨간', 'cold 차가운'],
  },
];

const CARDS_2: PosCard[] = [
  {
    pos: '부사',
    title: '부사 — 어떻게·언제·어디서를 더해 주는 말',
    explain: '동작이 어떻게, 얼마나, 언제 일어나는지 더 말해 줘요.',
    lines: ['slowly 천천히', 'very 아주', 'today 오늘', 'here 여기에'],
  },
  {
    pos: '전치사',
    title: '전치사 — 위치·방향·때를 나타내는 말',
    explain: '명사 앞에 붙어서 어디에, 어느 쪽으로, 언제인지 말해 줘요.',
    lines: ['in ~안에', 'on ~위에', 'under ~아래에', 'to ~로'],
  },
  {
    pos: '접속사',
    title: '접속사 — 말과 말을 이어 주는 말',
    explain: '낱말과 낱말, 문장과 문장을 이어 줘요.',
    lines: ['and 그리고', 'but 하지만', 'because 왜냐하면', 'or 또는'],
  },
  {
    pos: '관사',
    title: '관사 — 명사 앞에 붙는 a, an, the',
    explain: '명사 앞에 붙어서 "하나의"나 "그"를 알려 줘요.',
    lines: ['a dog 개 한 마리', 'an apple 사과 하나', 'the moon 그 달'],
  },
];

/** [낱말, 품사] */
const WORDS_1: [string, string][] = [
  ['dog', '명사'], ['run', '동사'], ['big', '형용사'],
  ['apple', '명사'], ['jump', '동사'], ['happy', '형용사'],
  ['teacher', '명사'], ['sing', '동사'], ['cold', '형용사'],
];
const WORDS_2: [string, string][] = [
  ['slowly', '부사'], ['in', '전치사'], ['and', '접속사'], ['a', '관사'],
  ['very', '부사'], ['under', '전치사'], ['but', '접속사'], ['the', '관사'],
];

/** [문장, 표시할 낱말, 품사] */
const SENTENCES_1: [string, string, string][] = [
  ['The tall boy runs fast.', 'tall', '형용사'],
  ['She kicks the ball.', 'kicks', '동사'],
  ['My sister likes music.', 'sister', '명사'],
  ['I have a red hat.', 'red', '형용사'],
  ['Birds fly in the sky.', 'fly', '동사'],
  ['We eat lunch at noon.', 'lunch', '명사'],
];
const SENTENCES_2: [string, string, string][] = [
  ['He walks slowly.', 'slowly', '부사'],
  ['The cat is under the table.', 'under', '전치사'],
  ['I like apples and bananas.', 'and', '접속사'],
  ['She has a new bag.', 'a', '관사'],
  ['It is very hot.', 'very', '부사'],
  ['I stayed home because it rained.', 'because', '접속사'],
];

const shuffled = <T,>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

export function buildSoloPosLesson(n: 1 | 2, name: string): { name: string; steps: SoloStep[]; minutes: number } {
  const cards = n === 1 ? CARDS_1 : CARDS_2;
  const words = n === 1 ? WORDS_1 : WORDS_2;
  const sentences = n === 1 ? SENTENCES_1 : SENTENCES_2;
  const pool = cards.map((c) => c.pos);

  const steps: SoloStep[] = [
    {
      t: 'intro',
      title: name,
      text:
        n === 1
          ? '낱말에는 종류가 있어요. 이름 말, 움직임 말, 꾸미는 말을 색과 함께 알아봐요!'
          : '더하는 말, 위치 말, 이어 주는 말, 앞에 붙는 말을 색과 함께 알아봐요!',
    },
  ];

  for (const c of cards) {
    const color = POS_COLOR_NAME_KO[c.pos];
    steps.push({
      t: 'rule',
      title: c.title,
      pattern: color ? `${c.pos} = ${color}` : c.pos,
      explain: c.explain,
      lines: c.lines,
      tip: color ? `이 종류의 말은 ${color}으로 기억해요!` : '',
    });
  }

  for (const [word, pos] of shuffled(words)) {
    const ch = posChoices(pos, pool);
    steps.push({ t: 'pickPos', word, options: ch.options, answer: ch.answer });
  }
  for (const [sentence, word, pos] of shuffled(sentences)) {
    const ch = posChoices(pos, pool);
    steps.push({ t: 'pickPos', word, sentence, options: ch.options, answer: ch.answer });
  }

  if (n === 2) {
    steps.push({ t: 'rainbowSpeak', itemId: 'soccer-kick-01' }, { t: 'rainbowSpeak', itemId: 'reading-park-01' });
  }
  return { name, steps, minutes: n === 1 ? 15 : 18 };
}
