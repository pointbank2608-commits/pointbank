import type { GameTemplateConfig, GameType, QuizQuestion } from './types';
import { GAME_CATALOG } from './gameCatalog';
import { gameBrowseGroups } from './gameBrowse';

export type PictureWordQuestion = QuizQuestion & { imageUrl: string };

const NATIVE = new Set<GameType>([
  'balloonpop', 'wordfishing', 'feedmonster', 'quiz', 'gameshowquiz', 'winlosequiz',
  'typeanswer', 'imagequiz', 'airplane', 'mazechase', 'whackamole', 'truefalse',
  'flashcards', 'wordclaw', 'treasuredig', 'fourclues',
]);
const SEPARATE = new Set<GameType>(['wordhoops', 'tugofwar', 'quizshow']);
const EXTRA_WORD_GAMES = new Set<GameType>(['shopping', 'watermelon', 'twodice', 'order', 'ladder']);

export function pictureWordModeKind(type?: GameType): 'native' | 'turn' | null {
  if (!type || SEPARATE.has(type)) return null;
  if (NATIVE.has(type)) return 'native';
  const game = GAME_CATALOG.find(game => game.type === type);
  return game && (EXTRA_WORD_GAMES.has(type) || gameBrowseGroups(game).includes('word')) ? 'turn' : null;
}

export function pictureQuizDeck(config: GameTemplateConfig | undefined, questions: QuizQuestion[]): QuizQuestion[] {
  if (!config?.pictureWordMode) return questions;
  return pictureWordQuestions(config).map((question, index) => {
    const shift = (index + 1) % question.choices.length;
    return { ...question, id: `picture-${question.id}`, choices: [...question.choices.slice(shift), ...question.choices.slice(0, shift)],
      correctIndex: (question.correctIndex - shift + question.choices.length) % question.choices.length };
  });
}

export function pictureWordQuestions(config?: GameTemplateConfig, choiceCount = 4): PictureWordQuestion[] {
  const words = new Map<string, NonNullable<GameTemplateConfig['pictureWords']>[number]>();
  const cards = config?.pictureWords ?? (config?.classroomSource?.kind === 'word' ? config.classroomSource.cards : []);
  for (const card of cards) {
    const word = card.word.trim();
    const key = word.toLowerCase();
    if (word && (!words.has(key) || (!words.get(key)?.imageUrl && card.imageUrl?.trim()))) {
      words.set(key, { ...card, word, imageUrl: card.imageUrl?.trim() || null });
    }
  }
  if (words.size < 2) return [];

  const pool = [...words.values()];
  const questions: PictureWordQuestion[] = [];
  const usedImages = new Set<string>();
  for (const [index, card] of pool.entries()) {
    if (!card.imageUrl || usedImages.has(card.imageUrl)) continue;
    // The same illustration must not have two different correct answers.
    usedImages.add(card.imageUrl);
    const choices = [card.word];
    for (let offset = 1; offset < pool.length && choices.length < choiceCount; offset += 1) {
      const other = pool[(index + offset) % pool.length];
      if (other.imageUrl !== card.imageUrl) choices.push(other.word);
    }
    if (choices.length < 2) continue;
    questions.push({ id: card.id, question: card.word, imageUrl: card.imageUrl, choices, correctIndex: 0 });
  }
  return questions;
}
