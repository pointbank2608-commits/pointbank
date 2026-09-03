import type { GroupSortGroup, QuizQuestion, TrueFalseStatement, WordListItem } from './types';

/** 실제 단어장뿐 아니라 사전에서 즉석으로 고른 단어 묶음(DictionaryPicker)도 넣을 수 있도록
 * items 배열만 요구한다 — WordList 는 이 모양을 만족하니 그대로 넘겨도 된다. */
type WordListLike = { items: WordListItem[] };

function uid(): string {
  return crypto.randomUUID();
}

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
export function buildQuizQuestions(list: WordListLike, direction: QuizDirection, choiceCount = 4): QuizQuestion[] {
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
export function buildTrueFalseStatements(list: WordListLike, direction: QuizDirection): TrueFalseStatement[] {
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

/**
 * 단어장에서 그룹정렬 그룹을 자동으로 만든다. "직접 입력"으로 넣은 단어는 카테고리가 없어
 * 그룹으로 묶을 수 없으니 건너뛰고, "사전에서 선택"으로 담아 카테고리(word_bank.category,
 * 동물/음식/색깔 등)가 있는 단어만 그 카테고리 이름으로 그룹을 나눈다 — 여러 카테고리를
 * 섞어 담은 단어장일 때만 의미가 있다(한 카테고리뿐이면 그룹이 1개만 나와 플레이가 안 됨).
 */
export function buildGroupSortGroups(list: WordListLike): GroupSortGroup[] {
  const byCategory = new Map<string, GroupSortGroup>();
  for (const item of list.items) {
    if (!item.category) continue;
    let group = byCategory.get(item.category);
    if (!group) {
      group = { id: uid(), name: item.category, items: [] };
      byCategory.set(item.category, group);
    }
    group.items.push({ id: item.id, text: item.word });
  }
  return [...byCategory.values()];
}
