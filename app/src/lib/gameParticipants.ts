import type { GameItem } from './types';
import type { TeamOrderState } from './teamOrder';

export type GameParticipantMode = 'none' | 'solo' | 'team';
export interface GameParticipant { id: string; label: string }

/** Resolve the same attending names and order for native turns, scores and results. */
export function gameParticipants(mode: GameParticipantMode, roster: GameItem[], order: TeamOrderState | null,
  teams: number, teamLabel: (n: number) => string, soloLabel: string): GameParticipant[] {
  if (mode === 'none') return [];
  if (mode === 'solo') {
    if (!roster.length) return soloLabel ? [{ id: 'solo', label: soloLabel }] : [];
    const ids = order?.mode === 'individual' ? order.order : roster.map(row => row.id);
    return ids.flatMap(id => { const row = roster.find(student => student.id === id); return row ? [{ id: row.id, label: row.label }] : []; });
  }
  const ids = Array.from({ length: teams }, (_, i) => `team-${i}`);
  const sorted = order?.mode === 'team' ? [...order.order.filter(id => ids.includes(id)), ...ids.filter(id => !order.order.includes(id))] : ids;
  return sorted.map(id => ({ id, label: order?.teamNames?.[id] || teamLabel(Number(id.slice(5)) + 1) }));
}
