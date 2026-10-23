import type { FullCardItem, PhonicsBankEntry } from './types';

/** Saved cards carry their own word/meaning/marked spelling; never rewrite them to a new course. */
export function savedPhonicsEntries(cards: FullCardItem[], bank: PhonicsBankEntry[]): PhonicsBankEntry[] {
  return cards.flatMap((card, index) => {
    const matches = bank.filter(e => e.word.toLowerCase() === card.word.trim().toLowerCase());
    const exact = matches.find(e => e.rule === card.category);
    const hit = exact ?? (!card.category ? matches.find(e => e.tier === 'basic') : undefined);
    if (!card.patternMarked && !hit) return [];
    return [{ ...(hit ?? {}), id: card.id, word: card.word, meaning: card.meaning,
      image_url: card.imageUrl,
      pattern_marked: card.patternMarked ?? hit!.pattern_marked, step: hit?.step ?? 1,
      rule: card.category ?? hit?.rule ?? '', sort_order: index, tier: 'legacy' as const }];
  });
}
