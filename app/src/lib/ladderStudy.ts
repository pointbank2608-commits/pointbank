import { generateLadder, traceAll } from './ladder';
import { sampleActivityCards } from './quickActivity';
import type { GameTemplateConfig, LadderStudy } from './types';

export function ladderStudySettings(config: GameTemplateConfig): LadderStudy {
  if (config.ladderStudy) return config.ladderStudy;
  const source = config.classroomSource;
  if (source && source.id !== 'temporary' && source.kind === 'word') {
    return {from:'word', to:'meaning', cards:source.cards, listId:source.id, listName:source.name, listVersion:source.version};
  }
  return {from:'word', to:'meaning', cards:sampleActivityCards('word')};
}

/** Keep only unambiguous, complete pairs for the two visible faces. */
export function ladderStudyCards({cards, from, to}: LadderStudy) {
  const starts = new Set<string>();
  const ends = new Set<string>();
  return cards.filter(card => {
    const start = card[from]?.trim();
    const end = card[to]?.trim();
    if (!start || !end || from === to) return false;
    const left = from === 'imageUrl' ? start : start.toLowerCase();
    const right = to === 'imageUrl' ? end : end.toLowerCase();
    if (starts.has(left) || ends.has(right)) return false;
    starts.add(left);
    ends.add(right);
    return true;
  });
}

export function studyLadderRound(order: number[], offset: number) {
  const remaining = order.length - offset;
  // Avoid leaving a single card on the final board.
  const size = remaining === 6 ? 4 : Math.min(5, remaining);
  const starts = order.slice(offset, offset + size);
  const grid = generateLadder(size, 8);
  const destinations = traceAll(grid);
  const ends: number[] = [];
  starts.forEach((card, col) => { ends[destinations[col]] = card; });
  return {order, offset, starts, ends, grid, destinations};
}

export function firstStudyLadder(count: number) {
  const order = Array.from({length:count}, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return studyLadderRound(order, 0);
}
