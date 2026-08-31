import type { GameType } from './types';

export interface GameCatalogEntry {
  type: GameType;
  /** 이 게임이 필요로 하는 최소 항목 개수. 모자라면 각 게임이 반복/샘플링으로 자동 보정한다. */
  minItems: number;
  icon: string;
}

/**
 * 8개 게임의 메타데이터. "다른 게임으로 열기" 기능이 여기서 호환 후보를 고른다.
 * 아이콘 값은 GamesPage.tsx 카드 아이콘과 동일하게 맞춰뒀다(중복이지만 그쪽은 건드리지 않음).
 */
export const GAME_CATALOG: GameCatalogEntry[] = [
  { type: 'wheel', minItems: 1, icon: 'target' },
  { type: 'ladder', minItems: 2, icon: 'alt_route' },
  { type: 'order', minItems: 2, icon: 'sports_baseball' },
  { type: 'bomb', minItems: 1, icon: 'bolt' },
  { type: 'timer', minItems: 1, icon: 'timer' },
  { type: 'tictactoe', minItems: 1, icon: 'grid_3x3' },
  { type: 'saveorgive', minItems: 1, icon: 'redeem' },
  { type: 'findmissing', minItems: 2, icon: 'search' },
];
