/** word_bank.category 의 16개 고정값. DictionaryPage(필터 칩)·WordListsPage(카테고리로
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

/** phonics_bank.step 값(1~5단계). */
export const PHONICS_STEPS = [1, 2, 3, 4, 5] as const;
