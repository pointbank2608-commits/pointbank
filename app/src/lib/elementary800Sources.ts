import { ORIGINAL_VERBS, ELEMENTARY800, partsOfSpeech, type VocabularyBooklet } from './elementary800Workbook';
import type { FullCardItem, WordBankEntry, WordList, WordListItem } from './types';

/** PDF order is authoritative for the uploaded levels; dictionary supplies reusable metadata. */
export function originalVerbBooklets(bank: WordBankEntry[]): VocabularyBooklet[] {
  return ORIGINAL_VERBS.map((words, index) => ({
    id: `verb-${index + 1}`, pos: 'verb', level: index + 1,
    entries: words.flatMap(word => {
      const candidates = bank.filter(row => row.word.toLowerCase() === word && row.meaning?.trim());
      candidates.sort((a,b) => Number(partsOfSpeech(b.part_of_speech).includes('verb')) - Number(partsOfSpeech(a.part_of_speech).includes('verb')) || a.sense_number-b.sense_number || a.id.localeCompare(b.id));
      const row = candidates[0];
      return row ? [{ ...row, image_url: row.image_url?.replace(/^(\/word-bank-images\/.+)\.png$/, '$1.webp') ?? null, elementaryNo: ELEMENTARY800.get(word)!, difficulty: row.level ?? 1 }] : [];
    }),
  }));
}
export function bookletCards(books: VocabularyBooklet[]): FullCardItem[] {
  return books.flatMap(book => book.entries.map(row => ({
    id: row.id, word: row.word, meaning: row.meaning, imageUrl: row.image_url,
    category: row.category, partOfSpeech: row.part_of_speech, example: row.example_sentence,
  })));
}
export function workbookListItems(cards: FullCardItem[]): WordListItem[] {
  return cards.map(card => ({ id: crypto.randomUUID(), word: card.word, meaning: card.meaning,
    image_url: card.imageUrl, category: card.category ?? null, partOfSpeech: card.partOfSpeech, example: card.example }));
}
/** Exact ordered content comparison, not just a matching name. Never overwrite an edited list. */
export function matchingWorkbookList(lists: WordList[], academyId: string, cards: FullCardItem[]) {
  return lists.find(list => list.academy_id === academyId && list.kind !== 'sentence' && list.items.length === cards.length &&
    list.items.every((item, index) => {
      const card = cards[index];
      return item.word === card.word && item.meaning === card.meaning && (item.image_url || null) === (card.imageUrl || null) &&
        (item.example || null) === (card.example || null) && (item.partOfSpeech || null) === (card.partOfSpeech || null) && (item.category || null) === (card.category || null);
    }));
}
