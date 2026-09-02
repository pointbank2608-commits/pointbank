import type { QuizQuestion, TrueFalseStatement, WordList } from './types';

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

/**
 * 단어장에서 참/거짓 문장을 자동으로 만든다. 항목마다 절반 확률로 "맞는 짝"을 그대로
 * 문장에 넣어 참 문장을, 나머지 절반은 같은 단어장의 다른 항목의 짝을 대신 넣어 거짓
 * 문장을 만든다 — 오답 후보가 없으면(단어장에 1개뿐이면) 참 문장으로 대체한다.
 */
export function buildTrueFalseStatements(list: WordList, direction: QuizDirection): TrueFalseStatement[] {
  const statements: TrueFalseStatement[] = [];
  for (const item of list.items) {
    const correctText = direction === 'wordToMeaning' ? item.meaning : item.word;
    const pool = [
      ...new Set(
        list.items
          .filter((other) => other.id !== item.id)
          .map((other) => (direction === 'wordToMeaning' ? other.meaning : other.word))
          .filter((text) => text !== correctText),
      ),
    ];
    const makeFalse = pool.length > 0 && Math.random() < 0.5;
    const shown = makeFalse ? pool[Math.floor(Math.random() * pool.length)] : correctText;
    const isTrue = !makeFalse;
    const text =
      direction === 'wordToMeaning'
        ? `"${item.word}"는 "${shown}"라는 뜻이에요.`
        : `"${item.meaning}"의 뜻을 가진 단어는 "${shown}"예요.`;
    statements.push({
      id: item.id,
      text,
      isTrue,
      explanation: isTrue ? undefined : `정답은 "${correctText}"예요.`,
    });
  }
  return statements;
}
