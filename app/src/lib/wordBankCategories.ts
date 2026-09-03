/** word_bank.category 의 16개 고정값. DictionaryPage(필터 칩) 와 WordListsPage(카테고리로
 * 선택하기) 양쪽에서 같은 목록을 써야 어긋나지 않아 여기 하나로 뺐다. */
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
