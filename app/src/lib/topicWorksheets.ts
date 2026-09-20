import { lineartUrlForWord } from './lineart';
import { choiceUsable, eligibleLetterWords, makeRng, sentenceTokens, shuffled } from './worksheetGenerators';
import type { FullCardItem, WordBankEntry } from './types';
import { entryInCategory, isIdiomEntry } from './wordBankCategories';

/** 카테고리 → 워크시트 제목(영어). 학생용 인쇄물이라 영어로 나간다. */
export const TOPIC_TITLES: Record<string, string> = {
  '사람/가족': 'People & Family',
  동물: 'Animals',
  음식: 'Food',
  몸: 'My Body',
  사물: 'Things',
  '학교/문구': 'School Things',
  '자연/날씨': 'Nature & Weather',
  장소: 'Places',
  교통: 'Transportation',
  색깔: 'Colors',
  '숫자/시간': 'Numbers & Time',
  감정: 'Feelings',
  동작: 'Actions',
  상태: 'Describing Words',
  기능어: 'Little Words',
  '인사/표현': 'Greetings',
  외모: 'Looks',
  옷: 'Clothes',
  '집/가구': 'Home',
  '나라/세계': 'Countries',
  '요일/달력': 'Days & Months',
  '행사/활동': 'Events',
  '휴일/기념일': 'Holidays',
  '취미/오락': 'Hobbies',
  스포츠: 'Sports',
  음악: 'Music',
  장난감: 'Toys',
  직업: 'Jobs',
  '건강/질병': 'Health',
  쇼핑: 'Shopping',
  돈: 'Money',
  과학기술: 'Technology',
  우주: 'Space',
  과학: 'Science',
  재료: 'Materials',
  환경: 'Environment',
  모양: 'Shapes',
  크기: 'Sizes',
  성격: 'Personality',
  '맛/질감': 'Taste & Texture',
  '위치/방향': 'Where Is It?',
  의문사: 'Question Words',
  '독해/이야기': 'Story Words',
  일상생활: 'Daily Routine',
  '교실 영어': 'Classroom English',
};

/** 색칠 페이지 장식 주제 추천(scripts/vocab/lineart-words.mjs 의 DECOR_SETS 이름). 없으면 공통 부품만 쓴다. */
const DECOR_BY_CATEGORY: Record<string, string> = {
  동물: '숲',
  음식: '소풍',
  '학교/문구': '학교',
  '자연/날씨': '계절',
  장소: '마을',
  교통: '마을',
  '집/가구': '집',
  스포츠: '운동장',
  장난감: '운동장',
  '취미/오락': '파티',
  '휴일/기념일': '파티',
  '행사/활동': '파티',
  우주: '우주',
};

export function decorThemeFor(category: string, subcategory?: string | null): string | null {
  if (category === '동물') {
    if (subcategory?.includes('농장')) return '농장';
    if (subcategory?.includes('물속') || subcategory?.includes('바다')) return '바다';
  }
  return DECOR_BY_CATEGORY[category] ?? null;
}

/** 주제 하나의 후보 단어(단어 탭만, 레벨 필터 적용). */
export function topicEntries(entries: WordBankEntry[], category: string, level: number | 'all'): WordBankEntry[] {
  return entries
    .filter((e) => !isIdiomEntry(e) && entryInCategory(e, category) && (level === 'all' || e.level === level))
    .sort((a, b) => a.word.localeCompare(b.word));
}

export function toCard(e: WordBankEntry): FullCardItem {
  return { id: e.id, word: e.word, meaning: e.meaning, imageUrl: e.image_url, category: e.category, example: e.example_sentence };
}

/**
 * 워크시트 세트에 담을 추천 단어. 그림(클레이)·색칠용 선화가 있는 단어와 한 단어짜리(공백 없는)
 * 단어를 먼저 뽑아서 어떤 유형을 눌러도 빈 페이지가 안 나오게 한다. 같은 seed 면 같은 결과.
 */
export function pickRecommended(candidates: WordBankEntry[], count: number, seed: number): WordBankEntry[] {
  const score = (e: WordBankEntry) =>
    (lineartUrlForWord(e.word) ? 2 : 0) + (e.image_url ? 1 : 0) + (e.sense_number === 1 ? 0.5 : 0) + (/\s/.test(e.word) ? -0.3 : 0);
  const rng = makeRng(seed);
  return shuffled(candidates, rng)
    .sort((a, b) => score(b) - score(a))
    .slice(0, count)
    .sort((a, b) => a.word.localeCompare(b.word));
}

export interface WorksheetTypeSupport {
  coloring: number;
  wordSearch: number;
  unscramble: number;
  fillBlank: number;
  cutPaste: number;
  match: number;
  sentence: number;
  multipleChoice: number;
  trueFalse: number;
}

/** 지금 고른 단어로 유형별로 몇 개가 실제로 쓰이는지(0이면 그 유형은 빈 페이지가 된다). */
export function worksheetSupport(words: FullCardItem[]): WorksheetTypeSupport {
  const letters = eligibleLetterWords(words, { min: 3, max: 12 }).length;
  return {
    coloring: words.filter((w) => lineartUrlForWord(w.word)).length,
    wordSearch: letters,
    unscramble: letters,
    fillBlank: words.filter((w) => [...w.word].filter((c) => /\p{L}/u.test(c)).length >= 2).length,
    cutPaste: words.filter((w) => w.imageUrl).length,
    match: words.filter((w) => w.word && (w.imageUrl || w.meaning)).length,
    sentence: words.filter((w) => sentenceTokens(w.example)).length,
    // 객관식은 보기를 다른 단어에서 뽑으므로 3개, 참·거짓은 틀린 짝을 만들려면 2개 이상이어야 한다.
    multipleChoice: choiceUsable(words).length >= 3 ? choiceUsable(words).length : 0,
    trueFalse: choiceUsable(words).length >= 2 ? choiceUsable(words).length : 0,
  };
}
