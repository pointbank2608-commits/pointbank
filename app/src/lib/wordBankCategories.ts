/** word_bank.category 의 고정값(원래 16개 + 확장 사전 카테고리). DictionaryPage(필터 칩)·WordListsPage(카테고리로
 * 선택하기)·DictionaryPicker(사전에서 추가하기 카테고리 필터) 전부 같은 목록을 써야
 * 어긋나지 않아 여기 하나로 뺐다. */
export const WORD_BANK_CATEGORIES = [
  '사람/가족',
  '동물',
  '음식',
  '몸',
  '사물',
  '학교/문구',
  '자연/날씨',
  '장소',
  '교통',
  '색깔',
  '숫자/시간',
  '감정',
  '동작',
  '상태',
  '기능어',
  '인사/표현',
  // 확장 사전(2026-09-20)에서 추가된 카테고리. 데이터에 없는 건 화면에서 자동으로 빠진다.
  '외모',
  '옷',
  '집/가구',
  '나라/세계',
  '요일/달력',
  '행사/활동',
  '휴일/기념일',
  '취미/오락',
  '스포츠',
  '음악',
  '장난감',
  '직업',
  '건강/질병',
  '쇼핑',
  '돈',
  '과학기술',
  '우주',
  '과학',
  '재료',
  '환경',
  '모양',
  '크기',
  '성격',
  '맛/질감',
  '위치/방향',
  '의문사',
  '독해/이야기',
  '일상생활',
  '교실 영어',
] as const;

/** 전통 8품사(명사~감탄사) 먼저, 데이터에만 있는 나머지 품사(관사/수사/조동사 등)는 뒤에 붙는다. */
export const PART_OF_SPEECH_ORDER = [
  '명사',
  '대명사',
  '동사',
  '형용사',
  '부사',
  '전치사',
  '접속사',
  '감탄사',
  '관사',
  '수사',
  '조동사',
];

/** 숙어·표현은 별도 컬럼이 아니라 part_of_speech 값으로 구분한다(020_word_bank_levels.sql).
 * 사전 화면의 "숙어·표현" 탭이 이 값들로 걸러내고, "단어" 탭에서는 빠진다. */
export const IDIOM_PARTS_OF_SPEECH = ['숙어', '표현'];

export function isIdiomEntry(entry: { part_of_speech: string }): boolean {
  return IDIOM_PARTS_OF_SPEECH.includes(entry.part_of_speech);
}

/** 단어 난이도 1~4(초등 세부 단계). 5 이후는 중등 이상을 위해 비워둔다. */
export const WORD_LEVELS = [
  { level: 1, label: 'Lv.1', hint: '유치~초2' },
  { level: 2, label: 'Lv.2', hint: '초3~4' },
  { level: 3, label: 'Lv.3', hint: '초5~6' },
  { level: 4, label: 'Lv.4', hint: '초등 확장' },
] as const;

/** 같은 뜻의 단어가 여러 카테고리에 걸릴 수 있다(walk = 동작 + 움직임) — 대표 category
 * 하나만 보면 다른 카테고리에서 안 보이니, 카테고리로 거를 때는 항상 이 함수를 쓴다. */
export function entryInCategory(
  entry: { category: string | null; extra_categories?: string[] | null },
  category: string,
): boolean {
  return entry.category === category || (entry.extra_categories?.includes(category) ?? false);
}

/** phonics_bank.step 값(1~5단계). */
export const PHONICS_STEPS = [1, 2, 3, 4, 5] as const;
