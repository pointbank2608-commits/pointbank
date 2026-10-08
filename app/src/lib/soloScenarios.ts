import type { SoloStep } from './soloLessons';
import type { WordBankEntry } from './types';

/**
 * 일상 대화·역할극 개별수업(2026-10-08) — 마트·식당·길 묻기·옷 가게·병원·새 친구처럼 실제로 쓰는 상황.
 * 상황마다 ① 필요한 낱말(사전, 그림 있는 것) ② 표현 덩어리(chunk) ③ 대화(점원·손님 등 역할극)를 한 수업으로 묶는다.
 * 표현·대화 문장은 **Claude 가 쓴 초안**이다(저작권 없는 새 문장). 선생님 검수 전이므로 학원에 맞게 고칠 수 있게
 * 만든 뒤 개별수업에서 다시 만들 수 있고, 새 상황은 SOLO_SCENARIOS 에 한 항목을 더하면 된다.
 */
export interface ScenarioChunk {
  en: string;
  ko: string;
  /** "이럴 때 써요" — 표현을 고르는 문제에서 보여 주는 한국어 상황 */
  situation: string;
}

export interface ScenarioLine {
  who: 'other' | 'me';
  speaker: string;
  en: string;
  ko: string;
}

export interface SoloScenario {
  id: string;
  icon: string;
  level: string;
  ko: string;
  en: string;
  koDesc: string;
  enDesc: string;
  /** 사전에서 찾아 그림·뜻을 보여 줄 낱말 */
  words: string[];
  chunks: ScenarioChunk[];
  dialogue: ScenarioLine[];
}

export const SOLO_SCENARIOS: SoloScenario[] = [
  {
    id: 'talk-market',
    icon: 'shopping_cart',
    level: 'Level 1',
    ko: '마트에서',
    en: 'At the supermarket',
    koDesc: '물건 위치를 묻고, 가격을 묻고, 계산해요',
    enDesc: 'Ask where things are, ask the price and pay',
    words: ['milk', 'bread', 'apple', 'egg', 'cheese', 'bag', 'money'],
    chunks: [
      { en: 'Excuse me, where is the milk?', ko: '실례합니다, 우유는 어디에 있나요?', situation: '우유가 어디 있는지 점원에게 물어봐요' },
      { en: "I'd like two apples, please.", ko: '사과 두 개 주세요.', situation: '사과 두 개를 사고 싶어요' },
      { en: 'How much is this?', ko: '이건 얼마예요?', situation: '물건의 가격을 물어봐요' },
      { en: 'Can I have a bag, please?', ko: '봉투 하나 주실 수 있나요?', situation: '담을 봉투가 필요해요' },
      { en: 'Here you are.', ko: '여기 있어요.', situation: '돈이나 물건을 건네며 말해요' },
      { en: 'Thank you very much.', ko: '정말 고맙습니다.', situation: '고마운 마음을 전해요' },
    ],
    dialogue: [
      { who: 'other', speaker: 'Clerk', en: 'Hello! Can I help you?', ko: '안녕하세요! 도와드릴까요?' },
      { who: 'me', speaker: 'Me', en: 'Yes. Where is the milk?', ko: '네. 우유는 어디에 있나요?' },
      { who: 'other', speaker: 'Clerk', en: "It's over there, next to the cheese.", ko: '저쪽 치즈 옆에 있어요.' },
      { who: 'me', speaker: 'Me', en: 'Thank you. How much is this bread?', ko: '고맙습니다. 이 빵은 얼마예요?' },
      { who: 'other', speaker: 'Clerk', en: "It's two dollars.", ko: '2달러예요.' },
      { who: 'me', speaker: 'Me', en: "I'd like two, please.", ko: '두 개 주세요.' },
      { who: 'other', speaker: 'Clerk', en: 'Here you are. Anything else?', ko: '여기 있어요. 더 필요한 건요?' },
      { who: 'me', speaker: 'Me', en: 'No, thank you. Can I have a bag, please?', ko: '아니요, 괜찮아요. 봉투 하나 주세요.' },
    ],
  },
  {
    id: 'talk-restaurant',
    icon: 'restaurant',
    level: 'Level 1',
    ko: '식당에서',
    en: 'At a restaurant',
    koDesc: '메뉴를 보고 주문하고, 계산서를 요청해요',
    enDesc: 'Look at the menu, order food and ask for the check',
    words: ['menu', 'water', 'hamburger', 'pizza', 'salad', 'soup', 'spoon', 'fork'],
    chunks: [
      { en: 'Can I have the menu, please?', ko: '메뉴판 좀 주시겠어요?', situation: '메뉴판이 필요해요' },
      { en: "I'd like a hamburger, please.", ko: '햄버거 하나 주세요.', situation: '햄버거를 주문해요' },
      { en: 'Can I have some water, please?', ko: '물 좀 주시겠어요?', situation: '마실 물이 필요해요' },
      { en: "I'm hungry.", ko: '배고파요.', situation: '배가 고프다고 말해요' },
      { en: "It's delicious!", ko: '맛있어요!', situation: '음식이 맛있다고 말해요' },
      { en: 'The check, please.', ko: '계산서 주세요.', situation: '식사를 마치고 계산하고 싶어요' },
    ],
    dialogue: [
      { who: 'other', speaker: 'Waiter', en: 'Welcome! Here is the menu.', ko: '어서 오세요! 여기 메뉴판이에요.' },
      { who: 'me', speaker: 'Me', en: "Thank you. I'd like a hamburger, please.", ko: '고맙습니다. 햄버거 하나 주세요.' },
      { who: 'other', speaker: 'Waiter', en: 'What would you like to drink?', ko: '음료는 뭘로 하시겠어요?' },
      { who: 'me', speaker: 'Me', en: 'Can I have some water, please?', ko: '물 좀 주세요.' },
      { who: 'other', speaker: 'Waiter', en: 'Sure. Here you are.', ko: '물론이죠. 여기 있어요.' },
      { who: 'me', speaker: 'Me', en: "It's delicious! The check, please.", ko: '맛있어요! 계산서 주세요.' },
    ],
  },
  {
    id: 'talk-directions',
    icon: 'signpost',
    level: 'Level 1',
    ko: '길 묻기',
    en: 'Asking the way',
    koDesc: '가고 싶은 곳을 묻고, 길 안내를 알아들어요',
    enDesc: 'Ask where a place is and understand directions',
    words: ['left', 'right', 'straight', 'corner', 'street', 'library', 'bank', 'near'],
    chunks: [
      { en: 'Excuse me, where is the library?', ko: '실례합니다, 도서관은 어디에 있나요?', situation: '도서관 가는 길을 물어봐요' },
      { en: 'Go straight.', ko: '곧장 가세요.', situation: '앞으로 곧장 가라고 알려 줘요' },
      { en: 'Turn left at the corner.', ko: '모퉁이에서 왼쪽으로 도세요.', situation: '모퉁이에서 왼쪽으로 가라고 알려 줘요' },
      { en: "It's next to the bank.", ko: '은행 옆에 있어요.', situation: '은행 옆에 있다고 알려 줘요' },
      { en: 'Is it far from here?', ko: '여기서 먼가요?', situation: '거리가 먼지 물어봐요' },
      { en: 'Thank you for your help.', ko: '도와주셔서 감사합니다.', situation: '길을 알려 준 사람에게 고마움을 전해요' },
    ],
    dialogue: [
      { who: 'me', speaker: 'Me', en: 'Excuse me. Where is the library?', ko: '실례합니다. 도서관이 어디에 있나요?' },
      { who: 'other', speaker: 'Stranger', en: 'Go straight on this street.', ko: '이 길로 곧장 가세요.' },
      { who: 'me', speaker: 'Me', en: 'Is it far from here?', ko: '여기서 먼가요?' },
      { who: 'other', speaker: 'Stranger', en: "No, it's near. Turn left at the corner.", ko: '아니요, 가까워요. 모퉁이에서 왼쪽으로 도세요.' },
      { who: 'me', speaker: 'Me', en: 'Is it next to the bank?', ko: '은행 옆에 있나요?' },
      { who: 'other', speaker: 'Stranger', en: "Yes! It's next to the bank.", ko: '네! 은행 옆에 있어요.' },
      { who: 'me', speaker: 'Me', en: 'Thank you for your help.', ko: '도와주셔서 감사합니다.' },
    ],
  },
  {
    id: 'talk-clothes',
    icon: 'checkroom',
    level: 'Level 1',
    ko: '옷 가게에서',
    en: 'At a clothes shop',
    koDesc: '색깔과 크기를 묻고, 입어 보고, 사요',
    enDesc: 'Ask for colors and sizes, try on and buy',
    words: ['shirt', 'pants', 'shoes', 'hat', 'blue', 'size', 'big', 'small'],
    chunks: [
      { en: 'Do you have this in blue?', ko: '이거 파란색 있어요?', situation: '다른 색이 있는지 물어봐요' },
      { en: 'Can I try it on?', ko: '입어 봐도 될까요?', situation: '옷을 입어 보고 싶어요' },
      { en: "It's too big.", ko: '너무 커요.', situation: '옷이 커서 맞지 않아요' },
      { en: 'Do you have a smaller size?', ko: '더 작은 사이즈 있어요?', situation: '더 작은 사이즈를 찾아요' },
      { en: 'How much is it?', ko: '얼마예요?', situation: '옷의 가격을 물어봐요' },
      { en: "I'll take it.", ko: '이걸로 할게요.', situation: '옷을 사기로 정했어요' },
    ],
    dialogue: [
      { who: 'other', speaker: 'Clerk', en: 'Hi! Can I help you?', ko: '안녕하세요! 도와드릴까요?' },
      { who: 'me', speaker: 'Me', en: 'Do you have this shirt in blue?', ko: '이 셔츠 파란색 있어요?' },
      { who: 'other', speaker: 'Clerk', en: 'Yes, here you are.', ko: '네, 여기 있어요.' },
      { who: 'me', speaker: 'Me', en: 'Can I try it on?', ko: '입어 봐도 될까요?' },
      { who: 'other', speaker: 'Clerk', en: 'Of course. How is it?', ko: '물론이죠. 어때요?' },
      { who: 'me', speaker: 'Me', en: "It's too big. Do you have a smaller size?", ko: '너무 커요. 더 작은 사이즈 있어요?' },
      { who: 'other', speaker: 'Clerk', en: 'Yes. Try this one.', ko: '네. 이걸 입어 보세요.' },
      { who: 'me', speaker: 'Me', en: "It's perfect! I'll take it.", ko: '딱 맞아요! 이걸로 할게요.' },
    ],
  },
  {
    id: 'talk-doctor',
    icon: 'medical_services',
    level: 'Level 1',
    ko: '병원에서',
    en: 'At the doctor',
    koDesc: '아픈 곳을 말하고, 의사 선생님 말을 알아들어요',
    enDesc: 'Say what hurts and understand the doctor',
    words: ['doctor', 'headache', 'stomachache', 'fever', 'cough', 'medicine', 'sick'],
    chunks: [
      { en: 'I have a headache.', ko: '머리가 아파요.', situation: '머리가 아프다고 말해요' },
      { en: 'I have a fever.', ko: '열이 나요.', situation: '열이 난다고 말해요' },
      { en: 'My stomach hurts.', ko: '배가 아파요.', situation: '배가 아프다고 말해요' },
      { en: 'I feel sick.', ko: '속이 안 좋아요.', situation: '몸이 안 좋다고 말해요' },
      { en: 'Do I need medicine?', ko: '약이 필요한가요?', situation: '약을 먹어야 하는지 물어봐요' },
      { en: 'Thank you, doctor.', ko: '감사합니다, 선생님.', situation: '진찰이 끝나고 인사해요' },
    ],
    dialogue: [
      { who: 'other', speaker: 'Doctor', en: "What's the matter?", ko: '어디가 아파요?' },
      { who: 'me', speaker: 'Me', en: 'I have a headache and a fever.', ko: '머리가 아프고 열이 나요.' },
      { who: 'other', speaker: 'Doctor', en: 'You need to rest and drink water.', ko: '푹 쉬고 물을 많이 마셔야 해요.' },
      { who: 'me', speaker: 'Me', en: 'Do I need medicine?', ko: '약이 필요한가요?' },
      { who: 'other', speaker: 'Doctor', en: 'Yes. Take this medicine after lunch.', ko: '네. 점심 먹고 이 약을 드세요.' },
      { who: 'me', speaker: 'Me', en: 'Thank you, doctor.', ko: '감사합니다, 선생님.' },
    ],
  },
  {
    id: 'talk-friend',
    icon: 'waving_hand',
    level: 'Level 1',
    ko: '새 친구 사귀기',
    en: 'Making a new friend',
    koDesc: '이름과 좋아하는 것을 말하고 친구가 돼요',
    enDesc: 'Say your name and what you like, and make a friend',
    words: ['name', 'friend', 'school', 'music', 'soccer', 'country'],
    chunks: [
      { en: 'Hi, my name is Jisu.', ko: '안녕, 내 이름은 지수야.', situation: '처음 만난 친구에게 이름을 말해요' },
      { en: 'Nice to meet you.', ko: '만나서 반가워.', situation: '처음 만난 사람에게 인사해요' },
      { en: 'Where are you from?', ko: '어디에서 왔어?', situation: '친구가 어느 나라에서 왔는지 물어봐요' },
      { en: "I'm from Korea.", ko: '나는 한국에서 왔어.', situation: '내가 온 나라를 말해요' },
      { en: 'What do you like?', ko: '너는 뭘 좋아해?', situation: '친구가 좋아하는 것을 물어봐요' },
      { en: "Let's be friends!", ko: '우리 친구하자!', situation: '친구가 되자고 말해요' },
    ],
    dialogue: [
      { who: 'other', speaker: 'Friend', en: 'Hi! My name is Tom.', ko: '안녕! 내 이름은 톰이야.' },
      { who: 'me', speaker: 'Me', en: 'Hi, my name is Jisu. Nice to meet you.', ko: '안녕, 내 이름은 지수야. 만나서 반가워.' },
      { who: 'other', speaker: 'Friend', en: 'Where are you from?', ko: '어디에서 왔어?' },
      { who: 'me', speaker: 'Me', en: "I'm from Korea. What do you like?", ko: '나는 한국에서 왔어. 너는 뭘 좋아해?' },
      { who: 'other', speaker: 'Friend', en: 'I like soccer and music.', ko: '나는 축구와 음악을 좋아해.' },
      { who: 'me', speaker: 'Me', en: "Me too! Let's be friends!", ko: '나도! 우리 친구하자!' },
    ],
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 상황 하나 → 개별수업(약 20분):
 * 상황 소개 → 필요한 낱말(소리·그림·뜻) → 뜻 고르기 → 표현 덩어리 말하기(끝 낱말부터 지우며) → 상황 보고 표현 고르기
 * → 표현 순서 맞추기 → 대화 역할극(읽기 → 내 대사 숨기고 말하기).
 */
export function buildSoloScenarioLesson(sc: SoloScenario, bank: WordBankEntry[], lang: string): { name: string; steps: SoloStep[]; minutes: number } | null {
  const ko = lang.startsWith('ko');
  const name = ko ? sc.ko : sc.en;
  const byWord = new Map<string, WordBankEntry>();
  for (const e of bank) {
    const k = e.word.toLowerCase();
    const prev = byWord.get(k);
    if (!prev || (!prev.image_url && e.image_url)) byWord.set(k, e);
  }
  const entries = sc.words.map((w) => byWord.get(w.toLowerCase())).filter((e): e is WordBankEntry => !!e && !!e.meaning);
  const key = sc.id.replace(/^talk-/, '');
  const img = (n: string) => `/solo-images/talk/${key}-${n}.webp`;
  const steps: SoloStep[] = [{ t: 'intro', title: name, text: ko ? sc.koDesc : sc.enDesc, imageUrl: img('scene') }];

  for (const e of entries) steps.push({ t: 'meet', word: e.word, meaning: e.meaning, imageUrl: e.image_url, example: e.example_sentence });
  if (entries.length >= 4) {
    const meanings = entries.map((e) => e.meaning);
    for (const e of shuffle(entries).slice(0, 4)) {
      const others = shuffle(meanings.filter((m) => m !== e.meaning)).slice(0, 3);
      const list = shuffle([e.meaning, ...others]);
      steps.push({ t: 'pickMeaning', word: e.word, imageUrl: e.image_url, options: list, answer: list.indexOf(e.meaning) });
    }
  }

  sc.chunks.forEach((c, i) => steps.push({ t: 'fadeRead', sentence: c.en, ko: c.ko, imageUrl: img(String(i + 1)) }));

  for (const c of shuffle(sc.chunks.map((x, i) => ({ x, i }))).slice(0, 4)) {
    const others = shuffle(sc.chunks.filter((y) => y.en !== c.x.en)).slice(0, 3).map((y) => y.en);
    const list = shuffle([c.x.en, ...others]);
    steps.push({ t: 'sayPick', situation: c.x.situation, options: list, answer: list.indexOf(c.x.en), imageUrl: img(String(c.i + 1)) });
  }
  for (const c of shuffle(sc.chunks).slice(0, 3)) {
    const ws = c.en.split(/\s+/);
    if (ws.length < 3 || ws.length > 9) continue;
    let sc2 = shuffle(ws);
    for (let i = 0; i < 5 && sc2.join(' ') === ws.join(' '); i++) sc2 = shuffle(ws);
    steps.push({ t: 'unscramble', sentence: ws.join(' '), words: sc2 });
  }

  steps.push({ t: 'roleplay', title: name, imageUrl: img('scene'), lines: sc.dialogue.map((l) => ({ ...l })) });
  return { name, steps, minutes: Math.max(15, Math.round(steps.length * 0.7)) };
}
