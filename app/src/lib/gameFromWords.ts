import i18n from '../i18n';
import { buildContestQuestions, contestRoundNames } from './liveQuiz';
import { buildGroupSortGroups, buildQuizQuestions, buildTrueFalseStatements } from './quizFromWordList';
import type { FullCardItem, GameItem, GameTemplateConfig, GameType, WordList, WordListItem } from './types';

/** word_lists 저장 모양(WordListItem)을 자료실·게임 변환이 받는 모양(FullCardItem)으로 바꾼다. */
export function wordListToCards(wordList: WordList | null | undefined): FullCardItem[] {
  if (!wordList) return [];
  return wordList.items.map((item) => ({
    id: item.id,
    word: item.word,
    meaning: item.meaning,
    imageUrl: item.image_url,
    category: item.category,
    partOfSpeech: item.partOfSpeech ?? null,
  }));
}

function cardsToWordListItems(words: FullCardItem[]): WordListItem[] {
  return words.map((w) => ({
    id: w.id,
    word: w.word,
    meaning: w.meaning,
    image_url: w.imageUrl,
    category: w.category ?? null,
    partOfSpeech: w.partOfSpeech ?? null,
  }));
}

/** 항목이 라벨 하나(GameItem.label)뿐인 게임 — 단어를 그대로 라벨로 넣는다. */
const LABEL_GAMES = new Set<GameType>([
  'wheel',
  'ladder',
  'order',
  'bomb',
  'timer',
  'tictactoe',
  'saveorgive',
  'findmissing',
  'baskin31',
  'connect4',
  'popcorn',
  'passball',
  'twodice',
  'hangman',
  'anagram',
  'spellword',
  'rankorder',
  'wordsearch',
  'crossword',
  'mazechase',
  'airplane',
]);

export interface GameContent {
  items: GameItem[];
  config?: GameTemplateConfig;
}

/**
 * 단어 목록으로 그 게임의 game_templates 내용(items/config)을 만든다. 게임마다 실제로 읽는 필드가
 * 달라서(퀴즈는 config.questions, 매치업은 config.pairs …) 각 게임 페이지가 WordListPicker로
 * 불러올 때 채우는 바로 그 필드를 채운다. 새 게임을 추가하면 여기에도 한 줄 넣을 것.
 * 단어장으로 만들 수 없는 게임(수박 문장·명칭 다이어그램·수학)이나 재료가 모자라면 null.
 */
export function buildGameContent(gameType: GameType, words: FullCardItem[]): GameContent | null {
  if (words.length === 0) return null;
  const labelItems: GameItem[] = words.map((w) => ({ id: w.id, label: w.word }));
  const pairs = () => words.map((w) => ({ id: w.id, left: w.word, right: w.meaning }));

  if (LABEL_GAMES.has(gameType)) return { items: labelItems };

  switch (gameType) {
    case 'quiz':
    case 'gameshowquiz':
    case 'winlosequiz': {
      const questions = buildQuizQuestions({ items: cardsToWordListItems(words) }, 'wordToMeaning');
      return questions.length > 0 ? { items: labelItems, config: { questions } } : null;
    }
    case 'truefalse': {
      const statements = buildTrueFalseStatements({ items: cardsToWordListItems(words) }, 'wordToMeaning');
      return statements.length > 0 ? { items: labelItems, config: { statements } } : null;
    }
    case 'matchup':
    case 'whackamole':
      return { items: labelItems, config: { pairs: pairs() } };
    case 'flashcards':
      return { items: labelItems, config: { flashcards: pairs() } };
    case 'typeanswer':
      return {
        items: labelItems,
        config: { typeAnswerEntries: words.map((w) => ({ id: w.id, prompt: w.meaning, answer: w.word })) },
      };
    case 'groupsort': {
      const groups = buildGroupSortGroups({ items: cardsToWordListItems(words) });
      return groups.length >= 2 ? { items: labelItems, config: { groups } } : null;
    }
    case 'imagequiz': {
      const imageQuizItems = words
        .filter((w) => w.imageUrl)
        .map((w) => ({ id: w.id, imageUrl: w.imageUrl as string, answer: w.word }));
      return imageQuizItems.length > 0 ? { items: labelItems, config: { imageQuizItems } } : null;
    }
    case 'quizshow': {
      const liveQuestions = buildContestQuestions(words, contestRoundNames(i18n.t.bind(i18n) as (k: string, o?: Record<string, unknown>) => string));
      return liveQuestions.length > 0 ? { items: labelItems, config: { liveQuestions } } : null;
    }
    case 'unscramble': {
      const sentences = words.filter((w) => w.example).map((w) => ({ id: w.id, label: w.example as string }));
      return sentences.length > 0 ? { items: sentences } : null;
    }
    default:
      return null;
  }
}

/** 커리큘럼에서 수업 단어장으로 만든 게임 템플릿 이름 — 게임 센터 목록에서도 어느 수업 것인지 보이게. */
export function lessonGameTemplateName(lessonName: string, wordListName: string | null | undefined): string {
  const base = lessonName.trim();
  return wordListName ? `${base} · ${wordListName}` : base;
}

/** 단어장만 있으면 자동으로 만들 수 있는 게임인지(재료 부족 여부와 별개로 종류만 본다). */
export function canBuildFromWords(gameType: GameType): boolean {
  return gameType !== 'watermelon' && gameType !== 'labeleddiagram' && gameType !== 'mathgen';
}
