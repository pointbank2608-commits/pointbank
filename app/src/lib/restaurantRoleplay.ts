/**
 * 레스토랑 롤플레이(2026-10-15) 자료 — PPT "Ordering Food at a Restaurant"(ELL)의 메뉴 4종(피자 카페·타코 식당·카페 단계 3·카페 단계 4)과
 * 주문 대화 순서를 옮겼다. 메뉴는 단계가 올라갈수록 어렵다(PPT 선생님 노트). 우리말 뜻은 Claude 초안(선생님 검수 전).
 * PPT에서 보태거나 바꾼 곳: ① 대화 끝에 손님의 음료 대답 줄을 보탰다(PPT는 서버의 음료 질문에서 끝난다)
 * ② 카페 단계 3의 음료 질문은 단계 4 메뉴의 음료(water·soda·milkshake·tea)를 쓴다 ③ 그림은 우리 점토 그림이다.
 */

export type RestaurantId = 'pizza' | 'taco' | 'cafe' | 'cafe2';
export type DialogueRole = 'server' | 'customer';

export interface MenuItem {
  name: string;
  ko: string;
  /** public/skins/restaurant/<art>.webp */
  art: string;
}

export interface MenuSection {
  id: string;
  title: string;
  ko: string;
  items: MenuItem[];
  /** 메뉴판에서 가로로 두 칸을 쓰는지 */
  wide?: boolean;
}

export interface DialogueLine {
  who: DialogueRole;
  /** 손님 줄에서 빈칸이 있으면 "{}" 자리에 고른 메뉴가 들어간다 */
  text: string;
  ko: string;
  /** 이 줄에서 고르는 메뉴 구역(여럿이면 합쳐서 보여 준다) */
  pick?: string[];
}

export interface Restaurant {
  id: RestaurantId;
  level: number;
  /** 슬라이드의 환영 문구 */
  welcome: string;
  menuTitle: string;
  ko: string;
  color: string;
  scene: string;
  server: string;
  customer: string;
  sections: MenuSection[];
  lines: DialogueLine[];
}

const item = (name: string, ko: string, art: string): MenuItem => ({ name, ko, art });

const DRINKS_BASIC: MenuItem[] = [item('water', '물', 'water'), item('tea', '차', 'tea'), item('soda', '탄산음료', 'soda'), item('milk', '우유', 'milk')];

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'pizza',
    level: 1,
    welcome: 'Welcome to our pizza café!',
    menuTitle: 'Pizza Menu',
    ko: '피자 카페',
    color: '#dc2626',
    scene: 'scene-pizza',
    server: 'server-girl',
    customer: 'customer-boy',
    sections: [
      { id: 'pizza', title: 'Pizza', ko: '피자', items: [item('meat pizza', '고기 피자', 'meat-pizza'), item('vegetable pizza', '채소 피자', 'vegetable-pizza'), item('cheese pizza', '치즈 피자', 'cheese-pizza')] },
      { id: 'sides', title: 'Sides', ko: '곁들임', items: [item('salad', '샐러드', 'salad'), item('soup', '수프', 'soup')] },
      { id: 'drinks', title: 'Drinks', ko: '음료', wide: true, items: DRINKS_BASIC },
    ],
    lines: [
      { who: 'server', text: 'Are you ready to order?', ko: '주문하시겠어요?' },
      { who: 'customer', text: 'Yes, I would like …', ko: '네, …을(를) 주세요.' },
      { who: 'server', text: 'Which pizza would you like?', ko: '어떤 피자로 하시겠어요?' },
      { who: 'customer', text: 'Yes, the {}.', ko: '네, {}(으)로 할게요.', pick: ['pizza'] },
      { who: 'server', text: 'Would you like to order a side?', ko: '곁들임 메뉴도 주문하시겠어요?' },
      { who: 'customer', text: 'I would like {}, please.', ko: '{} 주세요.', pick: ['sides'] },
      { who: 'server', text: 'What would you like to drink?', ko: '음료는 뭘로 하시겠어요?' },
      { who: 'customer', text: 'I would like {}, please.', ko: '{} 주세요.', pick: ['drinks'] },
    ],
  },
  {
    id: 'taco',
    level: 2,
    welcome: 'Welcome to our taco restaurant!',
    menuTitle: 'Taco Menu',
    ko: '타코 식당',
    color: '#16a34a',
    scene: 'scene-taco',
    server: 'server-boy',
    customer: 'customer-girl',
    sections: [
      { id: 'tacos', title: 'Tacos', ko: '타코', items: [item('chicken', '닭고기', 'chicken-taco'), item('beef', '소고기', 'beef-taco'), item('vegetable', '채소', 'vegetable-taco')] },
      { id: 'tortilla', title: 'Tortilla', ko: '또르띠야', items: [item('flour', '밀가루', 'flour-tortilla'), item('corn', '옥수수', 'corn-tortilla')] },
      {
        id: 'sides',
        title: 'Sides',
        ko: '곁들임',
        items: [item('rice', '밥', 'rice'), item('beans', '콩', 'beans'), item('salsa', '살사', 'salsa'), item('guacamole', '과카몰리', 'guacamole'), item('peppers', '고추', 'peppers')],
      },
      { id: 'drinks', title: 'Drinks', ko: '음료', items: [item('water', '물', 'water'), item('soda', '탄산음료', 'soda'), item('horchata', '오차타', 'horchata'), item('tea', '차', 'tea')] },
    ],
    lines: [
      { who: 'server', text: 'Are you ready to order?', ko: '주문하시겠어요?' },
      { who: 'customer', text: 'Yes, I would like …', ko: '네, …을(를) 주세요.' },
      { who: 'server', text: 'Which taco would you like?', ko: '어떤 타코로 하시겠어요?' },
      { who: 'customer', text: 'Yes, the {}.', ko: '네, {} 타코로 할게요.', pick: ['tacos'] },
      { who: 'server', text: 'Corn or flour tortilla?', ko: '옥수수 또르띠야요, 밀가루 또르띠야요?' },
      { who: 'customer', text: 'The {} tortilla, please.', ko: '{} 또르띠야로 주세요.', pick: ['tortilla'] },
      { who: 'server', text: 'Would you like to order a side?', ko: '곁들임 메뉴도 주문하시겠어요?' },
      { who: 'customer', text: 'I would like {}, please.', ko: '{} 주세요.', pick: ['sides'] },
      { who: 'server', text: 'What would you like to drink?', ko: '음료는 뭘로 하시겠어요?' },
      { who: 'customer', text: 'I would like {}, please.', ko: '{} 주세요.', pick: ['drinks'] },
    ],
  },
  {
    id: 'cafe',
    level: 3,
    welcome: 'Welcome to our café!',
    menuTitle: 'Café Menu',
    ko: '카페 (단계 3)',
    color: '#7c3aed',
    scene: 'scene-cafe',
    server: 'server-girl',
    customer: 'customer-boy',
    sections: [
      {
        id: 'sandwiches',
        title: 'Sandwiches',
        ko: '샌드위치',
        wide: true,
        items: [item('sub sandwich', '서브 샌드위치', 'sub-sandwich'), item('hamburger', '햄버거', 'hamburger'), item('chicken burger', '치킨 버거', 'chicken-burger'), item('veggie burger', '채식 버거', 'veggie-burger'), item('hot dog', '핫도그', 'hot-dog')],
      },
      { id: 'specials', title: 'Specials', ko: '오늘의 메뉴', items: [item('fish and chips', '피시 앤 칩스', 'fish-and-chips'), item('chicken and spinach salad', '닭고기 시금치 샐러드', 'chicken-spinach-salad')] },
      {
        id: 'options',
        title: 'Options',
        ko: '추가 옵션',
        items: [item('ketchup', '케첩', 'ketchup'), item('mustard', '머스터드', 'mustard'), item('lettuce', '상추', 'lettuce'), item('tomato', '토마토', 'tomato'), item('pickle', '피클', 'pickle'), item('bacon', '베이컨', 'bacon'), item('cheese', '치즈', 'cheese')],
      },
      { id: 'drinks', title: 'Drinks', ko: '음료', items: [item('water', '물', 'water'), item('soda', '탄산음료', 'soda'), item('milkshake', '밀크셰이크', 'milkshake'), item('tea', '차', 'tea')] },
    ],
    lines: [
      { who: 'server', text: 'Are you ready to order?', ko: '주문하시겠어요?' },
      { who: 'customer', text: 'Yes, I would like …', ko: '네, …을(를) 주세요.' },
      { who: 'server', text: 'Which sandwich or special would you like?', ko: '샌드위치나 오늘의 메뉴 중 뭘로 하시겠어요?' },
      { who: 'customer', text: 'Yes, the {}.', ko: '네, {}(으)로 할게요.', pick: ['sandwiches', 'specials'] },
      { who: 'server', text: 'Which option do you want to add?', ko: '어떤 옵션을 추가하시겠어요?' },
      { who: 'customer', text: 'The {} option, please.', ko: '{} 옵션으로 주세요.', pick: ['options'] },
      { who: 'server', text: 'What would you like to drink?', ko: '음료는 뭘로 하시겠어요?' },
      { who: 'customer', text: 'I would like {}, please.', ko: '{} 주세요.', pick: ['drinks'] },
    ],
  },
  {
    id: 'cafe2',
    level: 4,
    welcome: 'Welcome to our café!',
    menuTitle: 'Café Menu',
    ko: '카페 (단계 4)',
    color: '#be185d',
    scene: 'scene-cafe',
    server: 'server-boy',
    customer: 'customer-girl',
    sections: [
      { id: 'sides', title: 'Sides', ko: '곁들임', items: [item('potato chips', '감자칩', 'potato-chips'), item('french fries', '감자튀김', 'french-fries'), item('curly fries', '꽈배기 감자튀김', 'curly-fries'), item('salad', '샐러드', 'salad')] },
      { id: 'drinks', title: 'Drinks', ko: '음료', items: [item('water', '물', 'water'), item('soda', '탄산음료', 'soda'), item('milkshake', '밀크셰이크', 'milkshake'), item('tea', '차', 'tea')] },
      {
        id: 'desserts',
        title: 'Desserts',
        ko: '디저트',
        wide: true,
        items: [item('ice cream cone', '아이스크림 콘', 'ice-cream-cone'), item('cookie', '쿠키', 'cookie'), item('cake', '케이크', 'cake'), item('frozen yogurt', '프로즌 요거트', 'frozen-yogurt')],
      },
    ],
    lines: [
      { who: 'server', text: 'Would you like to add any sides?', ko: '곁들임 메뉴를 추가하시겠어요?' },
      { who: 'customer', text: 'Yes, I would like {}.', ko: '네, {} 주세요.', pick: ['sides'] },
      { who: 'server', text: 'What would you like to drink?', ko: '음료는 뭘로 하시겠어요?' },
      { who: 'customer', text: 'I would like {}, please.', ko: '{} 주세요.', pick: ['drinks'] },
      { who: 'server', text: 'Would you like a dessert?', ko: '디저트도 드시겠어요?' },
      { who: 'customer', text: 'For dessert I would like {}.', ko: '디저트로는 {} 주세요.', pick: ['desserts'] },
    ],
  },
];

export function restaurantById(id: string): Restaurant {
  return RESTAURANTS.find((r) => r.id === id) ?? RESTAURANTS[0];
}

/** 이 줄에서 고를 수 있는 메뉴 */
export function pickChoices(r: Restaurant, line: DialogueLine): { section: MenuSection; item: MenuItem }[] {
  const out: { section: MenuSection; item: MenuItem }[] = [];
  for (const id of line.pick ?? []) {
    const section = r.sections.find((s) => s.id === id);
    if (section) section.items.forEach((it) => out.push({ section, item: it }));
  }
  return out;
}

/** "{}" 자리에 고른 메뉴를 넣는다(고르기 전이면 밑줄) */
export function fillLine(text: string, chosen: string | null): string {
  return text.replace('{}', chosen ?? '______');
}
