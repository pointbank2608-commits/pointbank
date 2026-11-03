/**
 * 문법별 게임 2차 묶음의 손으로 쓴 소규모 자료(초등 수준, 사실이 분명한 것만). 규칙으로 만들 수 없는 부분만 여기 둔다.
 */

/* ---------- 비교급 챔피언 ---------- */
export interface CompareThing { n: string; e: string; v: number }
export interface CompareAdj {
  adj: string;
  comp: string;
  sup: string;
  /** 'max' = 값이 큰 쪽이 더 adj, 'min' = 값이 작은 쪽이 더 adj */
  dir: 'max' | 'min';
  unit: string;
  things: CompareThing[];
}
export const COMPARE_DATA: CompareAdj[] = [
  { adj: 'tall', comp: 'taller', sup: 'tallest', dir: 'max', unit: 'm', things: [{ n: 'giraffe', e: '🦒', v: 5 }, { n: 'horse', e: '🐴', v: 1.6 }, { n: 'dog', e: '🐕', v: 0.6 }] },
  { adj: 'fast', comp: 'faster', sup: 'fastest', dir: 'max', unit: 'km/h', things: [{ n: 'cheetah', e: '🐆', v: 100 }, { n: 'horse', e: '🐴', v: 70 }, { n: 'turtle', e: '🐢', v: 1 }] },
  { adj: 'slow', comp: 'slower', sup: 'slowest', dir: 'min', unit: 'km/h', things: [{ n: 'snail', e: '🐌', v: 0.05 }, { n: 'turtle', e: '🐢', v: 1 }, { n: 'dog', e: '🐕', v: 30 }] },
  { adj: 'heavy', comp: 'heavier', sup: 'heaviest', dir: 'max', unit: 'kg', things: [{ n: 'elephant', e: '🐘', v: 5000 }, { n: 'lion', e: '🦁', v: 190 }, { n: 'cat', e: '🐈', v: 4 }] },
  { adj: 'long', comp: 'longer', sup: 'longest', dir: 'max', unit: 'm', things: [{ n: 'bus', e: '🚌', v: 12 }, { n: 'car', e: '🚗', v: 4 }, { n: 'bike', e: '🚲', v: 1.8 }] },
  { adj: 'short', comp: 'shorter', sup: 'shortest', dir: 'min', unit: 'cm', things: [{ n: 'pencil', e: '✏️', v: 15 }, { n: 'ruler', e: '📏', v: 30 }, { n: 'umbrella', e: '☂️', v: 90 }] },
  { adj: 'big', comp: 'bigger', sup: 'biggest', dir: 'max', unit: 'm', things: [{ n: 'whale', e: '🐋', v: 25 }, { n: 'dolphin', e: '🐬', v: 3 }, { n: 'goldfish', e: '🐟', v: 0.1 }] },
  { adj: 'old', comp: 'older', sup: 'oldest', dir: 'max', unit: 'years', things: [{ n: 'tree', e: '🌳', v: 100 }, { n: 'house', e: '🏠', v: 40 }, { n: 'bike', e: '🚲', v: 3 }] },
  { adj: 'young', comp: 'younger', sup: 'youngest', dir: 'min', unit: 'years', things: [{ n: 'baby', e: '👶', v: 1 }, { n: 'boy', e: '👦', v: 10 }, { n: 'grandma', e: '👵', v: 70 }] },
  { adj: 'hot', comp: 'hotter', sup: 'hottest', dir: 'max', unit: '°C', things: [{ n: 'desert', e: '🏜️', v: 45 }, { n: 'forest', e: '🌲', v: 25 }, { n: 'snowy field', e: '❄️', v: -5 }] },
  { adj: 'cheap', comp: 'cheaper', sup: 'cheapest', dir: 'min', unit: '$', things: [{ n: 'pencil', e: '✏️', v: 1 }, { n: 'bag', e: '🎒', v: 20 }, { n: 'phone', e: '📱', v: 500 }] },
  { adj: 'expensive', comp: 'more expensive', sup: 'most expensive', dir: 'max', unit: '$', things: [{ n: 'phone', e: '📱', v: 500 }, { n: 'bag', e: '🎒', v: 20 }, { n: 'pencil', e: '✏️', v: 1 }] },
];

/* ---------- 이유·결과 연결 다리 ---------- */
export type Connector = 'and' | 'but' | 'because' | 'so';
export interface LinkPair { a: string; b: string; conn: Connector }
/** 문장은 `${a} ${conn} ${b}` — because 는 앞이 결과, 뒤가 이유 / so 는 앞이 이유, 뒤가 결과 */
export const LINK_DATA: LinkPair[] = [
  { a: 'I like apples', b: 'I like bananas', conn: 'and' },
  { a: 'She sings', b: 'he dances', conn: 'and' },
  { a: 'We play soccer', b: 'we run fast', conn: 'and' },
  { a: 'He has a cat', b: 'she has a dog', conn: 'and' },
  { a: 'I like pizza', b: 'I do not like onions', conn: 'but' },
  { a: 'She is small', b: 'she is strong', conn: 'but' },
  { a: 'It is sunny', b: 'it is cold', conn: 'but' },
  { a: 'I want a dog', b: 'my mom says no', conn: 'but' },
  { a: 'I stayed home', b: 'it was raining', conn: 'because' },
  { a: 'He drinks water', b: 'he is thirsty', conn: 'because' },
  { a: 'She wears a coat', b: 'it is cold', conn: 'because' },
  { a: 'We are happy', b: 'it is Friday', conn: 'because' },
  { a: 'I was tired', b: 'I went to bed early', conn: 'so' },
  { a: 'It was hot', b: 'we ate ice cream', conn: 'so' },
  { a: 'She was hungry', b: 'she ate a sandwich', conn: 'so' },
  { a: 'It was raining', b: 'I took an umbrella', conn: 'so' },
];

/* ---------- 습관 캘린더 ---------- */
export type Freq = 'always' | 'usually' | 'sometimes' | 'never';
export const FREQ_DAYS: Record<Freq, number[]> = { always: [7], usually: [5, 6], sometimes: [1, 2], never: [0] };
/** 주어는 He/She/I/They, 활동은 동사 원형으로 시작하는 말 */
export const HABIT_ACTS = [
  'play soccer', 'eat breakfast', 'walk to school', 'read a book', 'drink milk', 'watch TV', 'play the piano', 'wash the dishes',
  'ride a bike', 'brush my teeth', 'go to the park', 'help my mom',
];
export const HABIT_SUBJECTS: { subj: 'I' | 'He' | 'She' | 'They'; poss: string }[] = [
  { subj: 'He', poss: 'his' }, { subj: 'She', poss: 'her' }, { subj: 'They', poss: 'their' }, { subj: 'I', poss: 'my' },
];
/** 어순 문제: 올바른 문장 / 틀린 어순 */
export const HABIT_ORDER = [
  { ok: 'She is always happy.', bad: 'She always is happy.' },
  { ok: 'He is never late.', bad: 'He never is late.' },
  { ok: 'They are usually at home.', bad: 'They usually are at home.' },
  { ok: 'I always eat breakfast.', bad: 'I eat always breakfast.' },
  { ok: 'She sometimes reads comics.', bad: 'She reads sometimes comics.' },
  { ok: 'He never plays chess.', bad: 'He plays never chess.' },
];
