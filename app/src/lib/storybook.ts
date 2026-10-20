import type { FullCardItem } from './types';

export type StoryGame = 'feedmonster' | 'sentencebridge' | 'sentencetower';
export interface StoryQuestion { id: string; prompt: string; answer: string; wrong: string[]; hint?: string; imageUrl?: string | null }
export interface TowerStep { id: string; sentence: string; phrase: string; position: number; wrong: string[] }
export interface StorybookConfig {
  mode: 'vocabulary' | 'sentence';
  questions: StoryQuestion[];
  start: string;
  steps: TowerStep[];
  count: number;
  shuffle: boolean;
  seconds: number;
  sound: boolean;
  hints: boolean;
}
export const STORY_NAMES: Record<StoryGame, string> = { feedmonster: 'Feed the Monster', sentencebridge: 'Sentence Bridge', sentencetower: 'Sentence Tower' };
export const STORY_KO: Record<StoryGame, string> = { feedmonster: '몬스터 먹이 주기', sentencebridge: '문장 다리 건너기', sentencetower: '문장 탑 쌓기' };
const question = (prompt: string, answer: string, wrong: string[], hint = ''): StoryQuestion => ({ id: crypto.randomUUID(), prompt, answer, wrong, hint });
export function storySample(type: StoryGame): StorybookConfig {
  return { mode: 'sentence', count: 5, shuffle: false, seconds: 0, sound: true, hints: true,
    questions: type === 'feedmonster' ? [
      question('I want an apple!', 'apple', ['banana', 'carrot', 'milk'], '사과를 찾아 주세요.'),
      question('I need a pencil.', 'pencil', ['book', 'milk', 'banana']),
      question('I want a banana!', 'banana', ['apple', 'cake', 'carrot']),
      question('I need a book.', 'book', ['pencil', 'apple', 'milk']),
      question('I want some milk.', 'milk', ['banana', 'cake', 'book']),
    ] : [
      question('She ___ to school.', 'goes', ['go', 'going'], 'She 뒤의 동사를 살펴보세요.'),
      question('He ___ soccer.', 'plays', ['play', 'playing']),
      question('I am ___ a book.', 'reading', ['read', 'reads']),
      question('They ___ happy.', 'are', ['is', 'am']),
      question('We ___ apples.', 'like', ['likes', 'liking']),
    ],
    start: 'I play.', steps: [
      { id: 'tower-1', sentence: 'I play soccer.', phrase: 'soccer', position: 6, wrong: ['a book', 'milk'] },
      { id: 'tower-2', sentence: 'I play soccer after school.', phrase: 'after school', position: 13, wrong: ['in a book', 'to milk'] },
      { id: 'tower-3', sentence: 'I play soccer with my friends after school.', phrase: 'with my friends', position: 14, wrong: ['under the sea', 'on the moon'] },
    ] };
}
export function vocabularyQuestions(cards: FullCardItem[]): StoryQuestion[] {
  const usable = cards.filter(c => c.word.trim() && c.meaning.trim());
  const words = [...new Set(usable.map(c => c.word.trim()))];
  return usable.map(c => ({ id: c.id, prompt: c.meaning.trim(), answer: c.word.trim(), wrong: words.filter(w => w !== c.word.trim()).slice(0, 4), imageUrl: c.imageUrl }));
}
export const normalizeStory = (s: string) => s.trim().replace(/\s+/g, ' ');
/** Position is an explicit character boundary in the previous teacher-authored sentence. */
export function insertPhrase(previous: string, phrase: string, position: number): string {
  const before = previous.slice(0, position).trimEnd();
  const after = previous.slice(position).trimStart();
  return normalizeStory(`${before}${before ? ' ' : ''}${phrase.trim()}${after && !/^[.,!?;:]/.test(after) ? ' ' : ''}${after}`);
}
export function storyErrors(type: StoryGame, c: StorybookConfig): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(c.count) || c.count < 1 || c.count > 50) errors.push('문제 개수는 1~50개로 입력하세요.');
  if (![0, 30, 60, 90].includes(c.seconds)) errors.push('제한 시간은 끄기, 30초, 60초, 90초 중 선택하세요.');
  if (type === 'sentencetower') {
    if (!c.start.trim() || !c.steps.length || c.steps.length > 12) errors.push('시작 문장과 1~12개의 확장 단계가 필요해요.');
    let previous = c.start;
    c.steps.forEach((s, i) => {
      if (!s.phrase.trim() || !s.sentence.trim() || !Number.isInteger(s.position) || s.position < 0 || s.position > previous.length ||
        normalizeStory(insertPhrase(previous, s.phrase, s.position)) !== normalizeStory(s.sentence)) errors.push(`${i + 1}단계: 삽입 위치·표현과 전체 정답 문장이 일치해야 해요.`);
      const choices = [s.phrase, ...s.wrong].map(w => normalizeStory(w).toLowerCase());
      if (choices.length > 5 || choices.some(w => !w) || new Set(choices).size !== choices.length) errors.push(`${i + 1}단계: 빈 선택지나 중복 선택지를 제거하고 후보를 5개 이하로 설정하세요.`);
      previous = s.sentence;
    });
  } else {
    if (!c.questions.length) errors.push('문제를 입력해 주세요.');
    if (type === 'sentencebridge' && (c.questions.length < 5 || c.questions.length > 10 || c.count < 5 || c.count > 10)) errors.push('다리 게임은 5~10문제로 구성해 주세요.');
    c.questions.forEach((q, i) => {
      const choices = [q.answer, ...q.wrong].map(normalizeStory);
      if (!q.prompt.trim() || !q.answer.trim() || q.wrong.length < (type === 'feedmonster' ? 2 : 1) || choices.length > 5 || choices.some(v => !v) || new Set(choices.map(v => v.toLowerCase())).size !== choices.length) errors.push(`${i + 1}번: 문제·정답과 서로 다른 선택지 ${type === 'feedmonster' ? '3~5' : '2~5'}개가 필요해요.`);
      if (type === 'sentencebridge' && (q.prompt.match(/_{3,}/g) || []).length !== 1) errors.push(`${i + 1}번: 빈칸(___)을 정확히 한 곳에 표시하세요.`);
    });
  }
  return errors;
}
export function shuffled<T>(values: T[]): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
