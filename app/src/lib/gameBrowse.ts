import type { GameCatalogEntry } from './gameCatalog';
import type { GameType } from './types';

export const GAME_BROWSE_GROUPS = ['word', 'sentence', 'grammar', 'phonics', 'speaking', 'tools'] as const;
export type GameBrowseGroup = (typeof GAME_BROWSE_GROUPS)[number];

const TOOLS = new Set<GameType>(['wheel', 'ladder', 'order', 'timer', 'twodice', 'mathgen']);
// The preparation/import path and native game both accept these two source types.
const BOTH = new Set<GameType>([
  'wheel', 'bomb', 'passball', 'flashcards', 'typeanswer', 'lastbox', 'mysterybox',
  'treasuredig', 'shufflefind', 'telepathy', 'catchsentence', 'lightning', 'quizshow',
]);

export function gameBrowseGroups(game: GameCatalogEntry): GameBrowseGroup[] {
  const groups: GameBrowseGroup[] = [];
  if (game.type.startsWith('grammar')) groups.push('grammar');
  else if (game.category === 'roleplay' || game.category === 'speaking') groups.push('speaking');
  else if (game.category === 'sentence' || game.category === 'reading') groups.push('sentence');
  else if (!TOOLS.has(game.type)) groups.push('word');
  if (TOOLS.has(game.type)) groups.push('tools');
  if (BOTH.has(game.type)) {
    if (!groups.includes('word')) groups.push('word');
    if (!groups.includes('sentence')) groups.push('sentence');
  }
  return groups;
}
