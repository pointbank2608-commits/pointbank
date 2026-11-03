/**
 * 문법별 게임 3차 묶음 자료(초·중등 수준, 사실이 분명한 것만, 손으로 쓴 소규모 표).
 */

/* ---------- 수동태 카메라 ---------- */
export interface PassiveEvent {
  actorE: string; actor: string; actorPlural: boolean;
  objE: string; obj: string; objPlural: boolean;
  base: string; third: string; past: string; pp: string;
}
export const PASSIVE_DATA: PassiveEvent[] = [
  { actorE: '👧', actor: 'Mina', actorPlural: false, objE: '🖼️', obj: 'the picture', objPlural: false, base: 'paint', third: 'paints', past: 'painted', pp: 'painted' },
  { actorE: '👦', actor: 'Tom', actorPlural: false, objE: '🪟', obj: 'the window', objPlural: false, base: 'break', third: 'breaks', past: 'broke', pp: 'broken' },
  { actorE: '🧑‍🍳', actor: 'The cook', actorPlural: false, objE: '🍲', obj: 'the soup', objPlural: false, base: 'make', third: 'makes', past: 'made', pp: 'made' },
  { actorE: '👩', actor: 'My mom', actorPlural: false, objE: '🧹', obj: 'the room', objPlural: false, base: 'clean', third: 'cleans', past: 'cleaned', pp: 'cleaned' },
  { actorE: '👧', actor: 'Jisu', actorPlural: false, objE: '✉️', obj: 'the letter', objPlural: false, base: 'write', third: 'writes', past: 'wrote', pp: 'written' },
  { actorE: '👦', actor: 'The boy', actorPlural: false, objE: '🎂', obj: 'the cake', objPlural: false, base: 'eat', third: 'eats', past: 'ate', pp: 'eaten' },
  { actorE: '👩‍🏫', actor: 'Our teacher', actorPlural: false, objE: '🚪', obj: 'the door', objPlural: false, base: 'open', third: 'opens', past: 'opened', pp: 'opened' },
  { actorE: '👨', actor: 'Dad', actorPlural: false, objE: '🚲', obj: 'the bike', objPlural: false, base: 'fix', third: 'fixes', past: 'fixed', pp: 'fixed' },
  { actorE: '👷', actor: 'The workers', actorPlural: true, objE: '🌉', obj: 'the bridge', objPlural: false, base: 'build', third: 'build', past: 'built', pp: 'built' },
  { actorE: '👦', actor: 'Sam', actorPlural: false, objE: '📷', obj: 'the photos', objPlural: true, base: 'take', third: 'takes', past: 'took', pp: 'taken' },
  { actorE: '🧒', actor: 'The kids', actorPlural: true, objE: '🎨', obj: 'the pictures', objPlural: true, base: 'draw', third: 'draw', past: 'drew', pp: 'drawn' },
  { actorE: '👵', actor: 'Grandma', actorPlural: false, objE: '🍪', obj: 'the cookies', objPlural: true, base: 'bake', third: 'bakes', past: 'baked', pp: 'baked' },
];

/* ---------- 조건문 선택 모험 ---------- */
export interface CondItem {
  scene: string;
  pre: string; // if 절 주어
  ifPres: string; ifFut: string; ifPast: string;
  post: string;
  msubj: string; mbase: string; mpast: string; rest: string;
}
export const COND_DATA: CondItem[] = [
  { scene: '🌧️', pre: 'it', ifPres: 'rains', ifFut: 'will rain', ifPast: 'rained', post: 'tomorrow', msubj: 'we', mbase: 'stay', mpast: 'stayed', rest: 'at home' },
  { scene: '☀️', pre: 'it', ifPres: 'is', ifFut: 'will be', ifPast: 'was', post: 'sunny tomorrow', msubj: 'we', mbase: 'go', mpast: 'went', rest: 'to the park' },
  { scene: '📚', pre: 'you', ifPres: 'study', ifFut: 'will study', ifPast: 'studied', post: 'hard', msubj: 'you', mbase: 'pass', mpast: 'passed', rest: 'the test' },
  { scene: '🍕', pre: 'I', ifPres: 'have', ifFut: 'will have', ifPast: 'had', post: 'enough money', msubj: 'I', mbase: 'buy', mpast: 'bought', rest: 'a pizza' },
  { scene: '😴', pre: 'she', ifPres: 'is', ifFut: 'will be', ifPast: 'was', post: 'tired', msubj: 'she', mbase: 'go', mpast: 'went', rest: 'to bed early' },
  { scene: '🎂', pre: 'he', ifPres: 'invites', ifFut: 'will invite', ifPast: 'invited', post: 'us', msubj: 'we', mbase: 'bring', mpast: 'brought', rest: 'a gift' },
  { scene: '🏃', pre: 'you', ifPres: 'run', ifFut: 'will run', ifPast: 'ran', post: 'fast', msubj: 'you', mbase: 'win', mpast: 'won', rest: 'the race' },
  { scene: '🥶', pre: 'it', ifPres: 'is', ifFut: 'will be', ifPast: 'was', post: 'cold', msubj: 'I', mbase: 'wear', mpast: 'wore', rest: 'a coat' },
  { scene: '🍬', pre: 'you', ifPres: 'eat', ifFut: 'will eat', ifPast: 'ate', post: 'too much candy', msubj: 'you', mbase: 'get', mpast: 'got', rest: 'a stomachache' },
  { scene: '🚌', pre: 'we', ifPres: 'miss', ifFut: 'will miss', ifPast: 'missed', post: 'the bus', msubj: 'we', mbase: 'be', mpast: 'were', rest: 'late' },
  { scene: '🐶', pre: 'she', ifPres: 'walks', ifFut: 'will walk', ifPast: 'walked', post: 'her dog', msubj: 'the dog', mbase: 'be', mpast: 'was', rest: 'happy' },
  { scene: '📱', pre: 'they', ifPres: 'call', ifFut: 'will call', ifPast: 'called', post: 'me', msubj: 'I', mbase: 'answer', mpast: 'answered', rest: 'the phone' },
];

/* ---------- 관계사 인물 찾기 ---------- */
export interface Trait { icon: string; label: string; who: string; whose: string }
export const REL_TRAITS: Trait[] = [
  { icon: '🎩', label: 'red hat', who: 'is wearing a red hat', whose: 'hat is red' },
  { icon: '🎒', label: 'blue bag', who: 'has a blue bag', whose: 'bag is blue' },
  { icon: '🧣', label: 'green scarf', who: 'is wearing a green scarf', whose: 'scarf is green' },
  { icon: '🐶', label: 'white dog', who: 'has a white dog', whose: 'dog is white' },
  { icon: '🎈', label: 'yellow balloon', who: 'is holding a yellow balloon', whose: 'balloon is yellow' },
  { icon: '📕', label: 'red book', who: 'is reading a red book', whose: 'book is red' },
  { icon: '☂️', label: 'pink umbrella', who: 'is carrying a pink umbrella', whose: 'umbrella is pink' },
];
export const REL_NOUNS: { n: string; e: string }[] = [{ n: 'girl', e: '👧' }, { n: 'boy', e: '👦' }, { n: 'woman', e: '👩' }, { n: 'man', e: '👨' }];
export interface RelCard { e: string; label: string; clue: string }
/** that + (주어 + 동사) 형태의 목적격 관계대명사 단서 */
export const REL_THINGS: RelCard[] = [
  { e: '👟', label: 'shoes', clue: 'you wear on your feet' },
  { e: '📖', label: 'book', clue: 'you read before bed' },
  { e: '⚽', label: 'ball', clue: 'you kick in a game' },
  { e: '✏️', label: 'pencil', clue: 'you write with' },
  { e: '🥄', label: 'spoon', clue: 'you eat soup with' },
  { e: '☂️', label: 'umbrella', clue: 'you open when it rains' },
  { e: '🔑', label: 'key', clue: 'you use to open a door' },
  { e: '🧤', label: 'gloves', clue: 'you wear on your hands' },
  { e: '⏰', label: 'clock', clue: 'you look at to see the time' },
  { e: '🎒', label: 'backpack', clue: 'you carry to school' },
];
/** where 관계부사 단서 */
export const REL_PLACES: RelCard[] = [
  { e: '🏫', label: 'school', clue: 'we study' },
  { e: '🏥', label: 'hospital', clue: 'doctors help sick people' },
  { e: '📚', label: 'library', clue: 'we borrow books' },
  { e: '🏪', label: 'store', clue: 'we buy food' },
  { e: '🏊', label: 'pool', clue: 'we swim' },
  { e: '🏞️', label: 'park', clue: 'we play outside' },
  { e: '🍽️', label: 'restaurant', clue: 'we eat dinner' },
  { e: '✈️', label: 'airport', clue: 'planes take off' },
];

/* ---------- 문법 장보기 ---------- */
export interface ShopItem { e: string; s: string; w: string; count: boolean }
export const SHOP_ITEMS: ShopItem[] = [
  { e: '🍎', s: 'apple', w: 'apples', count: true },
  { e: '🥚', s: 'egg', w: 'eggs', count: true },
  { e: '🍌', s: 'banana', w: 'bananas', count: true },
  { e: '🥕', s: 'carrot', w: 'carrots', count: true },
  { e: '🍪', s: 'cookie', w: 'cookies', count: true },
  { e: '🍬', s: 'candy', w: 'candies', count: true },
  { e: '🥛', s: 'milk', w: 'milk', count: false },
  { e: '🍚', s: 'rice', w: 'rice', count: false },
  { e: '🍞', s: 'bread', w: 'bread', count: false },
  { e: '💧', s: 'water', w: 'water', count: false },
  { e: '🧃', s: 'juice', w: 'juice', count: false },
  { e: '🧀', s: 'cheese', w: 'cheese', count: false },
];

/* ---------- 질문으로 친구 찾기 ---------- */
export type AskFamily = 'does' | 'is' | 'can';
export interface AskTrait { icon: string; q: string; label: string }
export const ASK_TRAITS: Record<AskFamily, AskTrait[]> = {
  does: [
    { icon: '👓', q: 'Does the friend wear glasses?', label: 'glasses' },
    { icon: '🎩', q: 'Does the friend wear a hat?', label: 'hat' },
    { icon: '💇', q: 'Does the friend have long hair?', label: 'long hair' },
    { icon: '🍕', q: 'Does the friend like pizza?', label: 'pizza' },
    { icon: '🐶', q: 'Does the friend like dogs?', label: 'dogs' },
  ],
  is: [
    { icon: '📏', q: 'Is the friend tall?', label: 'tall' },
    { icon: '😊', q: 'Is the friend happy?', label: 'happy' },
    { icon: '🧒', q: 'Is the friend young?', label: 'young' },
    { icon: '👕', q: 'Is the friend wearing a red shirt?', label: 'red shirt' },
    { icon: '📖', q: 'Is the friend holding a book?', label: 'book' },
  ],
  can: [
    { icon: '🏊', q: 'Can the friend swim?', label: 'swim' },
    { icon: '🎤', q: 'Can the friend sing?', label: 'sing' },
    { icon: '💃', q: 'Can the friend dance?', label: 'dance' },
    { icon: '🚲', q: 'Can the friend ride a bike?', label: 'ride a bike' },
    { icon: '🍳', q: 'Can the friend cook?', label: 'cook' },
  ],
};
export const ASK_CHARS: { n: string; e: string }[] = [
  { n: 'Mina', e: '👧' }, { n: 'Jun', e: '👦' }, { n: 'Sora', e: '👩' }, { n: 'Ben', e: '👨' },
  { n: 'Yuri', e: '🧒' }, { n: 'Dan', e: '🧑' }, { n: 'Papa', e: '👴' }, { n: 'Nana', e: '👵' },
];
