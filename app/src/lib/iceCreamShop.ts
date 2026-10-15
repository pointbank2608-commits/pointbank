/**
 * 아이스크림 가게 롤플레이(2026-10-15) 자료 — PPT "ESL Ice Cream Shop Role Play (Kids A1-A2)"의 메뉴(맛 9·크기 3·담기 2·토핑 3)와
 * 대화(슬라이드 6~9, 기억하기 10번의 빈칸)를 옮겼다. 우리말 해석·가격은 Claude 초안이다.
 * PPT에서 바꾼 곳: ① 가격은 PPT에 큰 사이즈 £2.99 하나뿐이라 작은 것 £1.99·중간 £2.49를 보탰다 ② 토핑 "없음"을 보탰다
 * ③ PPT 예문은 큰 사이즈(맛 3가지)지만, 크기에 따라 서버의 말(맛 1·2·3가지)이 바뀐다.
 */

export type ScoopCount = 1 | 2 | 3;

export interface Flavour {
  id: string;
  name: string;
  ko: string;
  art: string;
}

export interface SizeOption {
  id: 'small' | 'medium' | 'large';
  name: string;
  ko: string;
  scoops: ScoopCount;
  price: string;
}

export interface ShopOption {
  id: string;
  name: string;
  ko: string;
  art: string;
}

export const FLAVOURS: Flavour[] = [
  { id: 'chocolate', name: 'chocolate', ko: '초콜릿', art: 'scoop-chocolate' },
  { id: 'vanilla', name: 'vanilla', ko: '바닐라', art: 'scoop-vanilla' },
  { id: 'strawberry', name: 'strawberry', ko: '딸기', art: 'scoop-strawberry' },
  { id: 'mint', name: 'mint choc chip', ko: '민트 초코칩', art: 'scoop-mint' },
  { id: 'lemon', name: 'lemon', ko: '레몬', art: 'scoop-lemon' },
  { id: 'blueberry', name: 'blueberry', ko: '블루베리', art: 'scoop-blueberry' },
  { id: 'raspberry', name: 'raspberry', ko: '라즈베리', art: 'scoop-raspberry' },
  { id: 'caramel', name: 'caramel', ko: '카라멜', art: 'scoop-caramel' },
  { id: 'pistachio', name: 'pistachio', ko: '피스타치오', art: 'scoop-pistachio' },
];

export const SIZES: SizeOption[] = [
  { id: 'small', name: 'small', ko: '작은 것 (1스쿱)', scoops: 1, price: '£1.99' },
  { id: 'medium', name: 'medium', ko: '중간 (2스쿱)', scoops: 2, price: '£2.49' },
  { id: 'large', name: 'large', ko: '큰 것 (3스쿱)', scoops: 3, price: '£2.99' },
];

export const STYLES: ShopOption[] = [
  { id: 'cone', name: 'cone', ko: '콘', art: 'cone' },
  { id: 'tub', name: 'tub', ko: '컵', art: 'tub' },
];

export const TOPPINGS: ShopOption[] = [
  { id: 'sprinkles', name: 'hundreds and thousands', ko: '색색 알갱이 스프링클(미국: sprinkles)', art: 'sprinkles-jar' },
  { id: 'flake', name: 'chocolate flake', ko: '초콜릿 플레이크', art: 'flake' },
  { id: 'sauce', name: 'chocolate sauce', ko: '초콜릿 소스', art: 'sauce-bottle' },
];

export const NUMBER_WORD: Record<ScoopCount, string> = { 1: 'one', 2: 'two', 3: 'three' };

/** "blueberry, raspberry and lemon" */
export function joinFlavours(list: string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** "a large" / "a small" — 크기 앞 관사(모두 자음 소리) */
export function sizePhrase(size: SizeOption): string {
  return `a ${size.name}`;
}

/** 서버의 맛 안내 */
export function flavourOffer(size: SizeOption): string {
  return size.scoops === 1 ? 'Sure! You can have one flavour.' : `Sure! You can have ${NUMBER_WORD[size.scoops]} different flavours.`;
}

export interface Order {
  size: SizeOption | null;
  style: ShopOption | null;
  flavours: Flavour[];
  topping: ShopOption | 'none' | null;
}

export const EMPTY_ORDER: Order = { size: null, style: null, flavours: [], topping: null };

export interface ShopLine {
  who: 'server' | 'customer';
  /** 이 줄을 말할 때의 글(주문에 따라 달라진다) */
  text: (o: Order) => string;
  ko: (o: Order) => string;
  /** 이 줄에서 할 선택 */
  pick?: 'sizeStyle' | 'flavours' | 'topping';
}

const topText = (o: Order) => (o.topping && o.topping !== 'none' ? `${cap(o.topping.name)}, please.` : 'No toppings, thank you.');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const SHOP_LINES: ShopLine[] = [
  { who: 'server', text: () => 'Hello, what can I get for you?', ko: () => '어서 오세요, 무엇을 드릴까요?' },
  {
    who: 'customer',
    pick: 'sizeStyle',
    text: (o) => `Can I get ${o.size ? sizePhrase(o.size) : 'a ______'} ice cream in a ${o.style ? o.style.name : '______'}, please?`,
    ko: (o) => `${o.size ? o.size.ko.split(' ')[0] : '____'} 아이스크림을 ${o.style ? o.style.ko : '____'}에 담아 주시겠어요?`,
  },
  {
    who: 'server',
    text: (o) => `${o.size ? flavourOffer(o.size) : 'Sure! You can have three different flavours.'} What would you like?`,
    ko: (o) => `네! 맛을 ${o.size?.scoops ?? 3}가지 고르실 수 있어요. 뭘로 하시겠어요?`,
  },
  {
    who: 'customer',
    pick: 'flavours',
    text: (o) => (o.flavours.length > 0 ? `${cap(joinFlavours(o.flavours.map((f) => f.name)))}, please.` : '______, please.'),
    ko: (o) => `${o.flavours.map((f) => f.ko).join(', ') || '____'} 주세요.`,
  },
  { who: 'server', text: () => 'Coming up. Would you like any toppings?', ko: () => '금방 드릴게요. 토핑 필요하세요?' },
  {
    who: 'customer',
    pick: 'topping',
    text: (o) => (o.topping === null ? '______, please.' : topText(o)),
    ko: (o) => (o.topping === null ? '____ 주세요.' : o.topping === 'none' ? '토핑은 괜찮아요, 고맙습니다.' : `${o.topping.ko} 주세요.`),
  },
  { who: 'server', text: (o) => `Certainly. That’ll be ${o.size?.price ?? '£2.99'} please.`, ko: (o) => `알겠습니다. ${o.size?.price ?? '£2.99'}예요.` },
  { who: 'customer', text: () => 'Here you are.', ko: () => '여기 있어요.' },
  { who: 'server', text: () => 'Thanks. Have a great day on the beach and don’t drop your ice cream!', ko: () => '고맙습니다. 해변에서 즐거운 하루 보내세요, 아이스크림 떨어뜨리지 마세요!' },
];

/** 슬라이드 10 "Can you remember the conversation?" — PPT 예문 그대로, 빈칸 낱말 */
export interface RememberLine {
  who: 'server' | 'customer';
  text: string;
  blank: string[];
}

export const REMEMBER_LINES: RememberLine[] = [
  { who: 'server', text: 'Hello, what can I get for you?', blank: ['get'] },
  { who: 'customer', text: 'Can I get a large ice cream in a cone, please?', blank: ['large', 'cone'] },
  { who: 'server', text: 'Sure! You can have three different flavours. What would you like?', blank: ['flavours', 'like'] },
  { who: 'customer', text: 'Blueberry, raspberry and lemon, please.', blank: ['please'] },
  { who: 'server', text: 'Coming up. Would you like any toppings?', blank: ['toppings'] },
  { who: 'customer', text: 'Hundreds and thousands, please.', blank: ['thousands'] },
  { who: 'server', text: 'Certainly. That’ll be £2.99, please.', blank: ['be'] },
  { who: 'customer', text: 'Here you are.', blank: ['are'] },
  { who: 'server', text: 'Thanks. Have a great day on the beach and don’t drop your ice cream!', blank: ['drop'] },
];

/** 한 줄에서 빈칸을 가린 조각(첫 번째로 맞는 낱말만) */
export function rememberSegments(line: RememberLine): { text: string; hidden: boolean }[] {
  const lower = line.text.toLowerCase();
  const spans: [number, number][] = [];
  for (const b of line.blank) {
    const re = new RegExp(`\\b${b.toLowerCase()}\\b`);
    const m = re.exec(lower);
    if (m) spans.push([m.index, m.index + b.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: { text: string; hidden: boolean }[] = [];
  let at = 0;
  for (const [s, e] of spans) {
    if (s < at) continue;
    if (s > at) out.push({ text: line.text.slice(at, s), hidden: false });
    out.push({ text: line.text.slice(s, e), hidden: true });
    at = e;
  }
  if (at < line.text.length) out.push({ text: line.text.slice(at), hidden: false });
  return out;
}
