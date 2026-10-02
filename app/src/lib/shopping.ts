// 장보기 게임(2026-10-02): 단어 그림이 놓인 진열대에서 물건을 카트에 담으며 a / an / some 으로 말한다.
// 방식 셋 — list(쇼핑 목록을 외우고 그대로 담기) · dish(요리에 필요한 것 담기) · event(특별한 날에 살 것 담기).
// 칠판에 나오는 영어 문장은 수업 내용이라 번역 문구(i18n)가 아니라 여기에 둔다.
import { pluralize, withArticle } from './grammar';
import type { ImageQuizItem } from './types';

export type ShoppingMode = 'list' | 'dish' | 'event';
export const SHOPPING_MODES: ShoppingMode[] = ['list', 'dish', 'event'];

/** 셀 수 없어서 some 을 붙이는 낱말(음식·재료 중심). */
const SOME_WORDS = new Set([
  'rice', 'bread', 'toast', 'milk', 'water', 'juice', 'tea', 'coffee', 'soda', 'lemonade', 'cheese', 'butter', 'yogurt',
  'cream', 'ice cream', 'meat', 'beef', 'pork', 'chicken', 'fish', 'bacon', 'ham', 'steak', 'soup', 'curry', 'salad',
  'pasta', 'spaghetti', 'cereal', 'popcorn', 'chocolate', 'candy', 'pudding', 'jam', 'honey', 'sauce', 'ketchup',
  'salt', 'sugar', 'pepper', 'flour', 'oil', 'garlic', 'corn', 'spinach', 'lettuce', 'broccoli', 'cabbage', 'tofu',
  'kimchi', 'seafood', 'fruit', 'food', 'gum', 'wine', 'beer', 'ice', 'paper', 'soap', 'shampoo', 'toothpaste', 'glue',
  'tape', 'sand', 'clay', 'money', 'furniture', 'homework', 'sunscreen', 'medicine', 'wood', 'wool', 'cotton',
]);
/** s 로 끝나지만 하나를 뜻하는 낱말(some 이 아니라 a/an). */
const SINGULAR_S = new Set(['bus', 'glass', 'dress', 'class', 'octopus', 'cactus', 'walrus', 'compass', 'circus', 'lens', 'gas', 'boss', 'kiss', 'cross', 'grass']);

const norm = (word: string) => word.trim().toLowerCase();

/** 이미 여럿 꼴(noodles, grapes, socks)이라 some 을 붙이는지. */
function looksPlural(word: string): boolean {
  const w = norm(word);
  const last = w.split(/\s+/).pop() ?? w;
  return last.length > 3 && last.endsWith('s') && !last.endsWith('ss') && !SINGULAR_S.has(last);
}

export function isUncountable(word: string): boolean {
  return SOME_WORDS.has(norm(word)) || looksPlural(word);
}

/** "a carrot" / "an onion" / "some rice" / "4 strawberries" */
export function shoppingPhrase(word: string, quantity = 1): string {
  const w = word.trim();
  if (isUncountable(w)) return `some ${w}`;
  if (quantity > 1) {
    const plural = pluralize(w);
    if (plural) return `${quantity} ${plural}`;
  }
  return withArticle(w);
}

export interface ShoppingListEntry {
  item: ImageQuizItem;
  quantity: number;
  phrase: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 같은 낱말이 두 번 담긴 단어장도 진열대에는 하나만 놓는다. */
export function uniqueShopItems(items: ImageQuizItem[]): ImageQuizItem[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = norm(it.answer);
    if (!it.imageUrl || !key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 쇼핑 목록 뽑기 — 셀 수 있는 낱말 셋 중 하나쯤은 개수(2~5)를 붙여 "4 strawberries"처럼 만든다. */
export function buildShoppingList(items: ImageQuizItem[], size: number): ShoppingListEntry[] {
  return shuffle(items)
    .slice(0, Math.max(1, Math.min(size, items.length)))
    .map((item) => {
      const countable = !isUncountable(item.answer) && pluralize(item.answer) != null;
      const quantity = countable && Math.random() < 0.34 ? 2 + Math.floor(Math.random() * 4) : 1;
      return { item, quantity, phrase: shoppingPhrase(item.answer, quantity) };
    });
}

/** 진열대에 놓을 물건 — 목록에 있는 것은 꼭 넣고 나머지를 섞어 최대 max 개. */
export function buildShelf(items: ImageQuizItem[], mustHave: ImageQuizItem[], max: number): ImageQuizItem[] {
  const must = new Set(mustHave.map((it) => it.id));
  const rest = shuffle(items.filter((it) => !must.has(it.id))).slice(0, Math.max(0, max - mustHave.length));
  return shuffle([...mustHave, ...rest]);
}

export interface ShoppingMission {
  id: string;
  image: string;
  /** 칠판에 크게 나오는 상황 문장 */
  prompt: string;
  /** 학생이 따라 말하는 문장 틀의 앞부분 */
  frame: string;
}

const img = (id: string) => `/word-bank-images/${id}.webp`;

export const DISH_MISSIONS: ShoppingMission[] = [
  { id: 'pizza', image: img('pizza'), prompt: "Let's make a pizza! What do we need?", frame: 'We need' },
  { id: 'sandwich', image: img('sandwich'), prompt: "Let's make a sandwich! What do we need?", frame: 'We need' },
  { id: 'salad', image: img('salad'), prompt: "Let's make a salad! What do we need?", frame: 'We need' },
  { id: 'soup', image: img('soup'), prompt: "Let's make soup! What do we need?", frame: 'We need' },
  { id: 'pancake', image: img('pancake'), prompt: "Let's make pancakes! What do we need?", frame: 'We need' },
  { id: 'curry', image: img('curry'), prompt: "Let's make curry! What do we need?", frame: 'We need' },
];

export const EVENT_MISSIONS: ShoppingMission[] = [
  { id: 'birthday', image: img('birthday'), prompt: "It's a birthday party! What will you buy?", frame: 'I will buy' },
  { id: 'picnic', image: img('picnic'), prompt: 'We are going on a picnic! What will you buy?', frame: 'I will buy' },
  { id: 'camping', image: img('camping'), prompt: 'We are going camping! What will you buy?', frame: 'I will buy' },
  { id: 'movie', image: img('movie'), prompt: "It's movie night with friends! What will you buy?", frame: 'I will buy' },
  { id: 'christmas', image: img('christmas'), prompt: "It's Christmas! What will you buy?", frame: 'I will buy' },
  { id: 'party', image: img('party'), prompt: 'Friends are coming over! What will you buy?', frame: 'I will buy' },
];

export const LIST_FRAME = "I'd like";

// ── 그림 가게(2026-10-02) ─────────────────────────────────────────────
// 가게 한 장면을 통째로 그린 그림(구글 AI, 점토 화풍) 위에서 물건 자리를 눌러 담는다. 단어 카드를 선반에
// 올리는 방식보다 한 장면처럼 보인다. 자리(x·y·w·h)는 그림 픽셀 기준 — 그림을 바꾸면 자리도 다시 잰다.
export interface SceneSpot {
  word: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShoppingScene {
  id: string;
  image: string;
  width: number;
  height: number;
  items: SceneSpot[];
}

/** 그림 가게의 물건 — 카트·목록에 보일 작은 그림은 장면 그림에서 그 자리를 잘라 쓴다. */
export interface ShopGood extends ImageQuizItem {
  spot?: SceneSpot;
  scene?: ShoppingScene;
  /** 물건 하나만 그린 배경 없는 그림 — 누르면 이 그림이 튀어나와 카트로 날아간다 */
  cutout?: string;
}

export const MARKET_SCENE: ShoppingScene = {
  id: 'market',
  image: '/skins/shop-market.webp',
  width: 1376,
  height: 768,
  items: [
    { word: 'lettuce', x: 85, y: 158, w: 193, h: 104 },
    { word: 'broccoli', x: 286, y: 158, w: 186, h: 104 },
    { word: 'carrot', x: 488, y: 165, w: 188, h: 97 },
    { word: 'tomato', x: 690, y: 170, w: 190, h: 92 },
    { word: 'onion', x: 78, y: 250, w: 197, h: 96 },
    { word: 'potato', x: 284, y: 258, w: 188, h: 88 },
    { word: 'lemon', x: 488, y: 258, w: 188, h: 88 },
    { word: 'corn', x: 690, y: 247, w: 194, h: 99 },
    { word: 'strawberry', x: 72, y: 345, w: 203, h: 85 },
    { word: 'grapes', x: 280, y: 338, w: 192, h: 92 },
    { word: 'banana', x: 488, y: 343, w: 190, h: 87 },
    { word: 'apple', x: 692, y: 338, w: 194, h: 92 },
    { word: 'watermelon', x: 66, y: 424, w: 204, h: 90 },
    { word: 'orange', x: 275, y: 424, w: 195, h: 90 },
    { word: 'cucumber', x: 486, y: 428, w: 192, h: 86 },
    { word: 'mushroom', x: 692, y: 427, w: 198, h: 87 },
    { word: 'fish', x: 1005, y: 128, w: 208, h: 87 },
    { word: 'meat', x: 1216, y: 105, w: 160, h: 90 },
    { word: 'bread', x: 1010, y: 243, w: 158, h: 73 },
    { word: 'croissant', x: 1172, y: 248, w: 204, h: 74 },
    { word: 'rice', x: 1033, y: 333, w: 97, h: 89 },
    { word: 'pasta', x: 1133, y: 342, w: 107, h: 95 },
    { word: 'cereal', x: 1247, y: 346, w: 117, h: 109 },
    { word: 'milk', x: 1000, y: 436, w: 92, h: 92 },
    { word: 'cheese', x: 1092, y: 486, w: 98, h: 54 },
    { word: 'egg', x: 1150, y: 512, w: 106, h: 56 },
    { word: 'juice', x: 1256, y: 478, w: 120, h: 128 },
  ],
};

export function sceneGoods(scene: ShoppingScene): ShopGood[] {
  return scene.items.map((spot) => ({ id: `${scene.id}:${spot.word}`, answer: spot.word, imageUrl: scene.image, spot, scene, cutout: `/skins/shop-items/${spot.word}.webp` }));
}

/** 정사각 칸에 그 물건 자리만 보이게 하는 배경 설정(자리 가운데를 정사각으로 자른다). */
export function spotBackground(good: ShopGood): Record<string, string> | null {
  const { spot, scene } = good;
  if (!spot || !scene) return null;
  const side = Math.min(spot.w, spot.h);
  const left = spot.x + (spot.w - side) / 2;
  const top = spot.y + (spot.h - side) / 2;
  return {
    backgroundImage: `url(${scene.image})`,
    backgroundSize: `${(scene.width / side) * 100}% ${(scene.height / side) * 100}%`,
    backgroundPosition: `${(left / (scene.width - side)) * 100}% ${(top / (scene.height - side)) * 100}%`,
    backgroundRepeat: 'no-repeat',
  };
}

export function missionsFor(mode: ShoppingMode): ShoppingMission[] {
  return mode === 'dish' ? DISH_MISSIONS : mode === 'event' ? EVENT_MISSIONS : [];
}
