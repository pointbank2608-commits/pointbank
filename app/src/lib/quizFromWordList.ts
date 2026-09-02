import type { QuizQuestion, WordList } from './types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type QuizDirection = 'wordToMeaning' | 'meaningToWord';

/**
 * 단어장에서 오지선다 퀴즈 문제를 자동으로 만든다. AI 호출 없이 단어장 자체의 데이터만
 * 쓴다 — 정답은 그 단어의 짝(뜻 또는 단어), 오답 보기는 같은 단어장 안의 "다른" 단어들의
 * 뜻/단어를 무작위로 뽑아서 채운다. 단어장이 작아서 보기 후보가 모자라면 그만큼만 만들고,
 * 오답 후보가 하나도 없는(사실상 단어장에 그 항목 하나뿐인) 경우는 문제를 만들 수 없어 건너뛴다.
 */
export function buildQuizQuestions(list: WordList, direction: QuizDirection, choiceCount = 4): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const item of list.items) {
    const correctText = direction === 'wordToMeaning' ? item.meaning : item.word;
    const questionText = direction === 'wordToMeaning' ? item.word : item.meaning;
    const pool = [
      ...new Set(
        list.items
          .filter((other) => other.id !== item.id)
          .map((other) => (direction === 'wordToMeaning' ? other.meaning : other.word))
          .filter((text) => text !== correctText),
      ),
    ];
    if (pool.length === 0) continue;
    const distractors = shuffle(pool).slice(0, choiceCount - 1);
    const choices = shuffle([correctText, ...distractors]);
    questions.push({
      id: item.id,
      question: questionText,
      choices,
      correctIndex: choices.indexOf(correctText),
    });
  }
  return questions;
}
