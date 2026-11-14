import { detectiveVariants } from './detectiveSuggestion';
import { GAME_CATALOG } from './gameCatalog';
import { prepareClassroomGame } from './gameWorkspace';
import type { SoloReviewGameType, SoloStep } from './soloLessons';
import type { FullCardItem, GameTemplateConfig } from './types';
import { normalizedWord } from './wordListLaunch';

type ReviewGame = SoloReviewGameType | 'matchup' | 'whackamole' | 'unscramble';
export type VideoReviewGames = Partial<Record<ReviewGame, boolean>>;

const wordGames = ['matchup', 'whackamole', 'quiz', 'truefalse', 'typeanswer', 'anagram', 'hangman', 'wordsearch', 'balloonpop', 'wordfishing'] as const;
const sentenceGames = ['unscramble', 'wordtrain', 'sentencesplash', 'grammardetective'] as const;
const spellingGames = new Set<ReviewGame>(['anagram', 'hangman', 'wordsearch']);
const pairGames = new Set<ReviewGame>(['matchup', 'whackamole']);
const needsChoices = new Set<ReviewGame>(['quiz', 'truefalse', ...pairGames]);
const games = [...wordGames.map(type => ({ type, kind: 'word' as const })),
  ...sentenceGames.map(type => ({ type, kind: 'sentence' as const }))].map(({ type, kind }) => {
  const entry = GAME_CATALOG.find(game => game.type === type)!;
  return { type, kind, nameKey: entry.nameKey, minimum: entry.minItems === 999 ? (needsChoices.has(type) ? 2 : 1) : entry.minItems };
});

function uniqueCards(cards: FullCardItem[], key: (card: FullCardItem) => string) {
  const seen = new Set<string>();
  return cards.filter(card => {
    const value = key(card);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function videoReviewChoices(steps: readonly SoloStep[]) {
  const words = uniqueCards(steps.flatMap((step, index) => step.t === 'meet' && step.word.trim() && step.meaning.trim()
    ? [{ id: `word-${index}`, word: step.word.trim(), meaning: step.meaning.trim(), imageUrl: step.imageUrl, example: step.example }] : []),
  card => `${normalizedWord(card.word)}\0${normalizedWord(card.meaning)}`);
  const spelling = uniqueCards(words.filter(card => /^[A-Za-z]{2,15}$/.test(card.word)), card => normalizedWord(card.word));
  const pairs = uniqueCards(uniqueCards(words, card => normalizedWord(card.word)), card => normalizedWord(card.meaning));
  const meaningCounts = new Map<string, number>();
  for (const word of words) {
    const key = normalizedWord(word.meaning);
    meaningCounts.set(key, (meaningCounts.get(key) ?? 0) + 1);
  }
  const typing = words.filter(card => meaningCounts.get(normalizedWord(card.meaning)) === 1);
  const sentences = uniqueCards(steps.flatMap((step, index) => {
    if (step.t !== 'lineSing' || step.practice !== 'shadow') return [];
    const word = step.en.trim();
    if (!/^[A-Za-z].*[.!?]$/.test(word) || /[.!?]\s/.test(word) || word.split(/\s+/).length < 3 || word.split(/\s+/).length > 14) return [];
    return [{ id: `line-${index}`, word, meaning: step.ko, imageUrl: null, example: null }];
  }), card => normalizedWord(card.word));
  return games.map(game => {
    const cards = game.kind === 'sentence' ? sentences : spellingGames.has(game.type) ? spelling
      : pairGames.has(game.type) ? pairs : game.type === 'typeanswer' ? typing : words;
    const playable = game.type === 'grammardetective' ? cards.filter(card => detectiveVariants(card.word).length > 0) : cards;
    const content = prepareClassroomGame(game.type, playable, game.kind);
    const config: GameTemplateConfig = content?.config ?? {};
    // Adventure settings start with sample counts. Limit rounds to the actual source material.
    const adventure = config.adventure;
    if (adventure) {
      const rows = game.kind === 'word' ? adventure.words : game.type === 'grammardetective' ? adventure.cases : adventure.sentences;
      adventure.count = Math.min(50, rows.length);
    }
    const size = adventure?.count ?? config.pairs?.length ?? config.questions?.length ?? config.statements?.length
      ?? config.typeAnswerEntries?.length ?? content?.items.length ?? 0;
    return { ...game, content, config, count: size >= game.minimum ? size : 0,
      seconds: size * (game.kind === 'sentence' ? 35 : spellingGames.has(game.type) || game.type === 'typeanswer' ? 25 : 15),
      requirement: game.type === 'grammardetective' ? '오류 고치기 문제로 바꿀 수 있는 문장을 골라 주세요'
        : game.type === 'typeanswer' ? '뜻 하나에 답이 하나인 표현을 골라 주세요'
        : game.kind === 'sentence' ? '3~14단어로 된 한 문장을 골라 주세요'
        : spellingGames.has(game.type) ? `영문 단어를 ${game.minimum}개 이상 골라 주세요`
        : `영어와 뜻이 있는 항목을 ${game.minimum}개 이상 골라 주세요` };
  });
}

export function videoReviewSteps(choices: ReturnType<typeof videoReviewChoices>, selected: VideoReviewGames, name: (key: string) => string): SoloStep[] {
  return choices.flatMap(({ type, content, config, count, nameKey }): SoloStep[] => {
    if (!selected[type] || !content || count === 0) return [];
    if (type === 'unscramble') return content.items.map(({ label: sentence }) => {
      const words = sentence.split(/\s+/);
      return { t: 'unscramble', sentence, words: [...words.slice(1), words[0]] };
    });
    const title = name(nameKey);
    if (type === 'matchup' || type === 'whackamole') {
      return [{ t: 'game', gameType: type, templateId: '', measure: false,
        title: type === 'matchup' ? '오늘의 단어·표현 매치업' : '오늘의 단어·표현 두더지 잡기', pairs: config.pairs }];
    }
    return [{ t: 'game', gameType: type, templateId: '', measure: false, title, review: { items: content.items, config } }];
  });
}
