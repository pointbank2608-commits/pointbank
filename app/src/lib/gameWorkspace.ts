import { buildGameContent, wordListToCards } from "./gameFromWords";
import type { FullCardItem, GameType, WordList } from "./types";
import { GAME_CATALOG } from './gameCatalog';
import {
  prepareWordListGame,
  WORD_LIST_GAMES,
  SENTENCE_LIST_GAMES,
  type WordListGame,
} from "./wordListLaunch";

const SENTENCE_GAMES = new Set<GameType>([
  "unscramble",
  "sentencesplash",
  "catchsentence",
  "lightning",
  "lastbox",
  "mysterybox",
  "treasuredig",
  "wheel",
  "flashcards",
  "typeanswer",
]);
const BUILTIN = new Set<GameType>([
  "airport",
  "doctor",
  "restaurant",
  "icecream",
]);
export function prepareClassroomGame(
  type: GameType,
  source: Pick<WordList, "kind" | "items"> | FullCardItem[],
  kind: "word" | "sentence" = "word",
) {
  const rawCards = Array.isArray(source)
    ? source
    : wordListToCards(source as WordList);
  const cards = rawCards.filter(c => c.word.trim()).map(c => ({ ...c, word: c.word.trim() }));
  const sourceKind = Array.isArray(source) ? kind : source.kind || "word";
  const minimum = GAME_CATALOG.find(g => g.type === type)?.minItems || 1;
  const usable = cards.filter(c => c.word.trim());
  if (!usable.length || (minimum !== 999 && usable.length < minimum)) return null;
  if (sourceKind === "sentence" && !SENTENCE_GAMES.has(type)) return null;
  if (BUILTIN.has(type)) return null; // built-in roleplay scripts do not pretend to use a selected vocabulary list.
  if (
    (
      [...WORD_LIST_GAMES, ...SENTENCE_LIST_GAMES] as readonly string[]
    ).includes(type)
  ) {
    const prepared = prepareWordListGame(
      cards.map((c) => ({
        id: c.id,
        word: c.word,
        meaning: c.meaning,
        image_url: c.imageUrl,
        category: c.category || null,
      })),
      type as WordListGame,
    );
    return prepared.ready
      ? { items: prepared.items, config: prepared.config }
      : null;
  }
  if (type === "unscramble") {
    const sentences = cards
      .map((c) => c.word)
      .filter((s) => s.trim().split(/\s+/).length >= 2);
    return sentences.length
      ? {
          items: sentences.map((label) => ({ id: crypto.randomUUID(), label })),
          config: {},
        }
      : null;
  }
  return buildGameContent(type, cards);
}

/** Used only when conversion failed, so explanations match the actual adapter. */
export function classroomGameRequirement(type: GameType, kind: 'word' | 'sentence' = 'word') {
  if (BUILTIN.has(type)) return { key: 'quick.builtin', count: 0 };
  if (kind === 'sentence' && !SENTENCE_GAMES.has(type)) return { key: 'quick.wordsOnly', count: 0 };
  if (type === 'unscramble' || type === 'sentencesplash') return { key: 'quick.needSentence', count: 0 };
  if (type === 'matchup') return { key: 'quick.needPairs', count: 2 };
  if (type === 'imagequiz' || type === 'labeleddiagram') return { key: 'quick.needImages', count: 0 };
  if (type === 'groupsort') return { key: 'quick.needGroups', count: 2 };
  const minimum = GAME_CATALOG.find(g => g.type === type)?.minItems || 1;
  return { key: minimum === 999 ? 'quick.needFormat' : 'quick.needItems', count: minimum === 999 ? 0 : minimum };
}
