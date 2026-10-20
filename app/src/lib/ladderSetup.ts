import type { GameItem } from './types';

export type LadderResultOrder = 'input' | 'random';
export interface LadderResultSlot { label: string; miss: boolean }
export interface LadderResultDraft { slots: LadderResultSlot[]; order: LadderResultOrder }

/** Reads the previous multiline editor too, without writing or discarding hidden slots. */
export function ladderResultDraft(raw: string, fallback: GameItem[] = []): LadderResultDraft {
  try {
    const draft = JSON.parse(raw);
    if (Array.isArray(draft.slots) && draft.slots.every((s: LadderResultSlot) => typeof s?.label === 'string' && typeof s.miss === 'boolean')) {
      return { slots: draft.slots, order: draft.order === 'random' ? 'random' : 'input' };
    }
  } catch { /* Legacy multiline text remains recoverable. */ }
  return { slots: (raw ? raw.split(/\r?\n/) : fallback.map(r => r.label)).map(label => ({ label, miss: false })), order: 'input' };
}

export function ladderSlots(draft: LadderResultDraft, count: number): LadderResultSlot[] {
  return Array.from({ length: count }, (_, i) => draft.slots[i] || { label: '', miss: false });
}

export function shuffledResultIds(results: GameItem[], random = Math.random): string[] {
  const ids = results.map(r => r.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
