import type { Material } from './materialPlan';
import type { HwShadowLine } from './types';

/** Older saved drafts selected whole sources. An explicit empty array selects nothing. */
export type ContentSelection = { cardIds?: string[]; lineIds?: string[]; meanings?: Record<string,string> };

export const dialogueKey = (line: HwShadowLine) => JSON.stringify([line.s,line.e,line.speaker ?? '',line.en]);

export function selectHomeworkMaterial<T extends Material>(material: T, selection: ContentSelection): T {
  const cards = selection.cardIds && new Set(selection.cardIds);
  const lines = selection.lineIds && new Set(selection.lineIds);
  return {
    ...material,
    cards: material.cards.filter(card => !cards || cards.has(card.id)).map(card => {
      const meaning = selection.meanings?.[card.id];
      return material.kind === 'sentence' && !card.meaning?.trim() && typeof meaning === 'string'
        ? { ...card, meaning: meaning.trim() } : card;
    }),
    scene: material.scene && {
      ...material.scene,
      lines: lines ? material.scene.lines.filter(line => lines.has(dialogueKey(line))) : material.scene.lines,
    },
  };
}
