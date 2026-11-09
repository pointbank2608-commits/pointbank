import { buildGameContent, wordListToCards } from "./gameFromWords";
import type { FullCardItem, GameType, WordList } from "./types";
import { GAME_CATALOG } from './gameCatalog';
import { sampleAdventure } from './adventureGames';
import { caseFromCorrect } from './detectiveSuggestion';
import {
  prepareWordListGame,
  WORD_LIST_GAMES,
  SENTENCE_LIST_GAMES,
  type WordListGame,
} from "./wordListLaunch";

const SENTENCE_GAMES = new Set<GameType>([
  "wordtrain",
  "grammardetective",
  "unscramble",
  "sentencesplash",
  "catchsentence",
  "lightning",
  "shufflefind",
  "telepathy",
  "lastbox",
  "mysterybox",
  "treasuredig",
  "wheel",
  "flashcards",
  "typeanswer",
  "passball",
  "bomb",
]);
const BUILTIN = new Set<GameType>([
  "airport",
  "doctor",
  "restaurant",
  "icecream",
]);
/** 저장 유형(kind)이 문장이거나, 모든 항목이 마침표·물음표·느낌표로 끝나는 3낱말 이상 문장이면 문장 모음으로 본다. */
export function isSentenceList(list: Pick<WordList, "kind" | "items">): boolean {
  if (list.kind === "sentence") return true;
  if (list.kind && list.kind !== "word") return false;
  const rows = (list.items ?? []).map(item => (item.word ?? "").trim()).filter(Boolean);
  return rows.length > 0 && rows.every(text => /[.!?]["”')\]]*$/.test(text) && text.split(/\s+/).length >= 3);
}

/** 문장 게임(문장만 받는 게임)에서는 문장 모음만 보여 주고, 단어와 문장을 모두 받는 게임에서는 모두 보여 준다. */
export function listsForGame(kinds: readonly string[], lists: readonly WordList[]): WordList[] {
  return kinds.includes("sentence") && !kinds.includes("word") ? lists.filter(isSentenceList) : [...lists];
}

export function prepareClassroomGame(
  type: GameType,
  source: Pick<WordList, "kind" | "items"> | FullCardItem[],
  kind: "word" | "sentence" = "word",
) {
  const rawCards = Array.isArray(source)
    ? source
    : wordListToCards(source as WordList);
  const cards = rawCards.filter(c => c.word.trim()).map(c => ({ ...c, word: c.word.trim() }));
  const sourceKind = Array.isArray(source) ? kind : isSentenceList(source) ? "sentence" : source.kind || "word";
  const minimum = GAME_CATALOG.find(g => g.type === type)?.minItems || 1;
  const usable = cards.filter(c => c.word.trim());
  if (!usable.length || (minimum !== 999 && usable.length < minimum)) return null;
  if (sourceKind === "sentence" && !SENTENCE_GAMES.has(type)) return null;
  if (BUILTIN.has(type)) return null; // built-in roleplay scripts do not pretend to use a selected vocabulary list.
  if (type === 'grammardetective') {
    if (sourceKind !== 'sentence') return null;
    const cases = cards.map(c => caseFromCorrect(c.word));
    return cases.every(c => c.errors.length) ? { items: [], config: { adventure: { ...sampleAdventure(type), cases } } } : null;
  }
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
  if (type === 'matchup' || type === 'wordhoops') return { key: 'quick.needPairs', count: 2 };
  if (type === 'labeleddiagram') return { key: 'quick.needDiagram', count: 0 };
  if (type === 'imagequiz') return { key: 'quick.needImages', count: 0 };
  if (type === 'groupsort') return { key: 'quick.needGroups', count: 2 };
  const minimum = GAME_CATALOG.find(g => g.type === type)?.minItems || 1;
  return { key: minimum === 999 ? 'quick.needFormat' : 'quick.needItems', count: minimum === 999 ? 0 : minimum };
}
