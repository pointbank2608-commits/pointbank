export interface MaterialCatalogEntry {
  id: string;
  path: string;
  icon: string;
  /** MaterialsPage 카드 커버 사진 경로. 없으면 그라데이션+아이콘으로 대체 표시. */
  cover: string | null;
  nameKey: string;
  descKey: string;
}

/** 수업 자료실 카드 목록 — /materials 페이지가 그대로 매핑한다. 새 인쇄 자료를 추가할 땐
 * 여기 한 줄 + App.tsx 라우트 한 줄이면 된다(게임 카탈로그와 같은 방식). */
export const MATERIALS_CATALOG: MaterialCatalogEntry[] = [
  {
    id: 'memorycards',
    path: '/materials/memory-cards',
    icon: 'style',
    cover: '/covers/material-memorycards.jpg',
    nameKey: 'materials.memoryCardsName',
    descKey: 'materials.memoryCardsDesc',
  },
  {
    id: 'bingo',
    path: '/materials/bingo',
    icon: 'grid_on',
    cover: '/covers/material-bingo.jpg',
    nameKey: 'materials.bingoName',
    descKey: 'materials.bingoDesc',
  },
];
