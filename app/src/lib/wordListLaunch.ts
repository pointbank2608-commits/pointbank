import { buildQuizQuestions } from './quizFromWordList';
import type { GameItem, GameTemplateConfig, WordListItem } from './types';

export const WORD_LIST_GAMES = ['wheel', 'flashcards', 'matchup', 'quiz', 'gameshowquiz'] as const;
export type WordListGame = typeof WORD_LIST_GAMES[number];
export function normalizedWord(text: string): string {
  return text.normalize('NFKC').trim().toLocaleLowerCase();
}

/** Pure conversion: browsing the launcher never writes a game or changes the list. */
export function prepareWordListGame(source: WordListItem[], game: WordListGame): {
  items: GameItem[]; config: GameTemplateConfig; count: number; ready: boolean;
} {
  const seen = new Set<string>();
  const words = source.filter((item) => {
    const key = normalizedWord(item.word) + '\0' + normalizedWord(item.meaning);
    if (!item.word.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({ ...item, word: item.word.trim(), meaning: item.meaning.trim() }));
  if (game === 'wheel') {
    const labels = new Set<string>();
    const items = words.filter((item) => {
      const key = normalizedWord(item.word);
      if (labels.has(key)) return false;
      labels.add(key);
      return true;
    }).map((item) => ({ id: item.id, label: item.word }));
    return { items, config: {}, count: items.length, ready: items.length > 0 };
  }
  if (game === 'quiz' || game === 'gameshowquiz') {
    const questions = buildQuizQuestions({ items: words }, 'wordToMeaning');
    return { items: [], config: { questions }, count: questions.length, ready: questions.length > 0 };
  }
  const left = new Set<string>();
  const right = new Set<string>();
  const pairs = words.filter((item) => {
    if (!item.meaning) return false;
    if (game !== 'matchup') return true;
    // ID-based matching must never present visually indistinguishable answers.
    const l = normalizedWord(item.word), r = normalizedWord(item.meaning);
    if (left.has(l) || right.has(r)) return false;
    left.add(l); right.add(r);
    return true;
  }).map((item) => ({ id: item.id, left: item.word, right: item.meaning }));
  return {
    items: [], config: game === 'matchup' ? { pairs } : { flashcards: pairs },
    count: pairs.length, ready: pairs.length >= (game === 'matchup' ? 2 : 1),
  };
}
