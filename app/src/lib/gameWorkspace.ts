import { buildGameContent, wordListToCards } from "./gameFromWords";
import type { FullCardItem, GameType, WordList } from "./types";
import {
  prepareWordListGame,
  WORD_LIST_GAMES,
  SENTENCE_LIST_GAMES,
  type WordListGame,
} from "./wordListLaunch";

const SENTENCE_GAMES = new Set<GameType>([
  "unscramble",
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
  const cards = Array.isArray(source)
    ? source
    : wordListToCards(source as WordList);
  const sourceKind = Array.isArray(source) ? kind : source.kind || "word";
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
