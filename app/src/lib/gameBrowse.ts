import { GAME_MOMENTS, type GameCatalogEntry, type GameMoment } from './gameCatalog';
export type GameBrowseGroup = GameMoment | 'sentence';
export const GAME_BROWSE_GROUPS: GameBrowseGroup[] = [...GAME_MOMENTS.slice(0,2),'sentence',...GAME_MOMENTS.slice(2)];
export const gameBrowseGroup = (game: GameCatalogEntry): GameBrowseGroup => game.category === 'sentence' ? 'sentence' : game.moment;
