import type { GameTemplateConfig, QuizQuestion } from './types';

export type PictureWordQuestion = QuizQuestion & { imageUrl: string };

export function pictureWordQuestions(config?: GameTemplateConfig, choiceCount = 4): PictureWordQuestion[] {
  const words = new Map<string, NonNullable<GameTemplateConfig['pictureWords']>[number]>();
  const cards = config?.pictureWords ?? config?.classroomSource?.cards ?? [];
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
