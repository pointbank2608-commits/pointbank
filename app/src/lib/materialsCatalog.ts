export type MaterialCategory = 'words' | 'phonics' | 'gamecards' | 'roleplay' | 'other';
export type MaterialPreparation = 'topic' | 'words' | 'rule' | 'unit' | 'options' | 'phonicsRules' | 'workbook';

export interface MaterialCatalogEntry {
  id: string;
  displayOrder?: number;
  category?: MaterialCategory;
  preparation?: MaterialPreparation;
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
  { id:'phonicsstage1', displayOrder:4.1, category:'phonics', preparation:'workbook', path:'/materials/phonics-stage-1', icon:'auto_stories', cover:'/covers/material-phonics.jpg', nameKey:'phonicsPrint.title', descKey:'phonicsPrint.description' },
  { id: 'phonicsstage4workbook', displayOrder: 6.1, category: 'phonics', preparation: 'workbook', path: '/materials/phonics-stage-4-workbook', icon: 'menu_book', cover: '/covers/material-cvcworkbook.jpg', nameKey: 'materials.stage4WorkbookName', descKey: 'materials.stage4WorkbookDesc' },
  { id: 'phonicsstage5workbook', displayOrder: 6.2, category: 'phonics', preparation: 'workbook', path: '/materials/phonics-stage-5-workbook', icon: 'menu_book', cover: '/covers/material-longvowelworkbook.jpg', nameKey: 'materials.stage5WorkbookName', descKey: 'materials.stage5WorkbookDesc' },
  { id: 'grammarworkbook', displayOrder: 6.3, category: 'other', preparation: 'topic', path: '/materials/grammar-workbook', icon: 'rule', cover: null, nameKey: 'materials.grammarWorkbookName', descKey: 'materials.grammarWorkbookDesc' },
  {
    id: 'library', displayOrder: 0,
    category: 'words', preparation: 'topic',
    path: '/materials/library',
    icon: 'collections_bookmark',
    cover: '/covers/material-library.jpg',
    nameKey: 'materials.libraryName',
    descKey: 'materials.libraryDesc',
  },
  {
    id: 'phonics', displayOrder: 4,
    category: 'phonics', preparation: 'phonicsRules',
    path: '/materials/phonics',
    icon: 'spellcheck',
    cover: '/covers/material-phonics.jpg',
    nameKey: 'materials.phonicsLibraryName',
    descKey: 'materials.phonicsLibraryDesc',
  },
  {
    // 미리 만들어 둔 파닉스 CVC 워크북(2026-10-02) — 유닛만 고르면 바로 인쇄
    id: 'cvcworkbook', displayOrder: 5,
    category: 'phonics', preparation: 'workbook',
    path: '/materials/cvc-workbook',
    icon: 'menu_book',
    cover: '/covers/material-cvcworkbook.jpg',
    nameKey: 'materials.cvcWorkbookName',
    descKey: 'materials.cvcWorkbookDesc',
  },
  {
    // 미리 만들어 둔 장모음 워크북(2026-10-03) — 매직 e 와 ee·ea, 같은 화면(CvcWorkbookPage book="long")
    id: 'longvowelworkbook', displayOrder: 6,
    category: 'phonics', preparation: 'workbook',
    path: '/materials/long-vowel-workbook',
    icon: 'menu_book',
    cover: '/covers/material-longvowelworkbook.jpg',
    nameKey: 'materials.longVowelWorkbookName',
    descKey: 'materials.longVowelWorkbookDesc',
  },
  {
    id: 'flashcards', displayOrder: 2,
    category: 'words', preparation: 'words',
    path: '/materials/flashcards',
    icon: 'print',
    cover: '/covers/material-flashcards.jpg',
    nameKey: 'materials.flashcardsName',
    descKey: 'materials.flashcardsDesc',
  },
  {
    id: 'memorycards', displayOrder: 3,
    category: 'words', preparation: 'words',
    path: '/materials/memory-cards',
    icon: 'style',
    cover: '/covers/material-memorycards.jpg',
    nameKey: 'materials.memoryCardsName',
    descKey: 'materials.memoryCardsDesc',
  },
  {
    id: 'bingo', displayOrder: 7,
    category: 'gamecards', preparation: 'words',
    path: '/materials/bingo',
    icon: 'grid_on',
    cover: '/covers/material-bingo.jpg',
    nameKey: 'materials.bingoName',
    descKey: 'materials.bingoDesc',
  },
  {
    // 미스터리 박스 인쇄물(2026-10-14) — 문제 카드 + 보상 카드 28장
    id: 'mysterybox', displayOrder: 8,
    category: 'gamecards', preparation: 'options',
    path: '/materials/mystery-box',
    icon: 'redeem',
    cover: '/covers/game-mysterybox.jpg',
    nameKey: 'materials.mysteryBoxName',
    descKey: 'materials.mysteryBoxDesc',
  },
  {
    // 공항 롤플레이 워크시트(2026-10-15) — 대본 빈칸·순서 맞추기·전광판 읽기·역할 카드
    id: 'airport', displayOrder: 10,
    category: 'roleplay', preparation: 'options',
    path: '/materials/airport',
    icon: 'flight',
    cover: '/covers/game-airport.jpg',
    nameKey: 'materials.airportName',
    descKey: 'materials.airportDesc',
  },
  {
    // 병원 워크시트(2026-10-15) — 낱말 카드·짝 맞추기·What's the problem?·역할 카드
    id: 'doctor', displayOrder: 13,
    category: 'roleplay', preparation: 'options',
    path: '/materials/doctor',
    icon: 'medical_services',
    cover: '/covers/game-doctor.jpg',
    nameKey: 'materials.doctorName',
    descKey: 'materials.doctorDesc',
  },
  {
    // 번개 피하기 워크시트(2026-10-16) — 읽기 카드·서바이벌 기록지·빈칸 채우기·내가 번개를 맞으면?
    id: 'lightning', displayOrder: 9,
    category: 'gamecards', preparation: 'options',
    path: '/materials/lightning',
    icon: 'thunderstorm',
    cover: '/covers/game-lightning.jpg',
    nameKey: 'materials.lightningName',
    descKey: 'materials.lightningDesc',
  },
  {
    // 아이스크림 가게 워크시트(2026-10-15) — 메뉴판·대화 빈칸·내 아이스크림 주문서·점원/손님 카드와 주문 카드
    id: 'icecream', displayOrder: 12,
    category: 'roleplay', preparation: 'options',
    path: '/materials/icecream',
    icon: 'icecream',
    cover: '/covers/game-icecream.jpg',
    nameKey: 'materials.iceCreamName',
    descKey: 'materials.iceCreamDesc',
  },
  {
    // 레스토랑 롤플레이 워크시트(2026-10-15) — 메뉴판·주문 대화 빈칸·주문서·짝 연습 카드
    id: 'restaurant', displayOrder: 11,
    category: 'roleplay', preparation: 'options',
    path: '/materials/restaurant',
    icon: 'restaurant',
    cover: '/covers/game-restaurant.jpg',
    nameKey: 'materials.restaurantName',
    descKey: 'materials.restaurantDesc',
  },
  {
    id: 'worksheet', displayOrder: 1,
    category: 'words', preparation: 'words',
    path: '/materials/worksheet',
    icon: 'description',
    cover: '/covers/material-worksheet.jpg',
    nameKey: 'worksheetStudio.title',
    descKey: 'worksheetStudio.subtitle',
  },
];

export interface WorksheetTabCatalogEntry {
  /** WorksheetPrintPage.tsx 의 Tab 값과 같아야 한다(파닉스 전용 4종 제외). */
  tab: string;
  icon: string;
  /** materials.worksheet.<labelKey> 에 이미 있는 탭 이름을 그대로 재사용한다. */
  labelKey: string;
}

/** "워크시트·시험지 인쇄" 한 페이지 안의 18개 탭 — 커리큘럼 슬라이드가 페이지 단위가 아니라
 * 탭 단위로 미리 정해둘 수 있게 목록으로 뽑아둔다(2026-09-24). WorksheetPrintPage.tsx 의 TABS
 * 순서와 맞춘다. */
export const WORKSHEET_TAB_CATALOG: WorksheetTabCatalogEntry[] = [
  { tab: 'list', icon: 'format_list_bulleted', labelKey: 'tabList' },
  { tab: 'card', icon: 'crop_portrait', labelKey: 'tabCard' },
  { tab: 'tracing', icon: 'draw', labelKey: 'tabTracing' },
  { tab: 'quiz', icon: 'quiz', labelKey: 'tabQuiz' },
  { tab: 'coloring', icon: 'palette', labelKey: 'tabColoring' },
  { tab: 'match', icon: 'sync_alt', labelKey: 'tabMatch' },
  { tab: 'wordSearch', icon: 'search', labelKey: 'tabWordSearch' },
  { tab: 'unscramble', icon: 'shuffle', labelKey: 'tabUnscramble' },
  { tab: 'fillBlank', icon: 'edit', labelKey: 'tabFillBlank' },
  { tab: 'grouping', icon: 'category', labelKey: 'tabGrouping' },
  { tab: 'cutPaste', icon: 'content_cut', labelKey: 'tabCutPaste' },
  { tab: 'sentence', icon: 'reorder', labelKey: 'tabSentence' },
  { tab: 'multipleChoice', icon: 'checklist', labelKey: 'tabMultipleChoice' },
  { tab: 'trueFalse', icon: 'rule', labelKey: 'tabTrueFalse' },
  { tab: 'miniBook', icon: 'menu_book', labelKey: 'tabMiniBook' },
  { tab: 'askAnswer', icon: 'forum', labelKey: 'tabAskAnswer' },
  { tab: 'boardGame', icon: 'casino', labelKey: 'tabBoardGame' },
  { tab: 'readMatch', icon: 'link', labelKey: 'tabReadMatch' },
];

/** Both shortcuts and sections use the same catalog; unclassified additions remain visible. */
export const MATERIAL_CATEGORIES: {key: MaterialCategory; icon: string}[] = [
  {key:'words',icon:'menu_book'}, {key:'phonics',icon:'headphones'},
  {key:'gamecards',icon:'casino'}, {key:'roleplay',icon:'theater_comedy'}, {key:'other',icon:'folder'},
];
export function materialSections(catalog = MATERIALS_CATALOG) {
  return MATERIAL_CATEGORIES.map(category => ({...category, items: catalog.filter(item => (item.category ?? 'other') === category.key).sort((a,b) => (a.displayOrder ?? Infinity) - (b.displayOrder ?? Infinity))})).filter(section => section.items.length > 0);
}
export const MATERIAL_PREPARATIONS: Record<MaterialPreparation, {action: 'create' | 'units' | 'settings' | 'createWorksheet'; tone: string}> = {
  topic: {action:'create',tone:'yellow'}, words: {action:'create',tone:'blue'},
  rule: {action:'create',tone:'purple'}, unit: {action:'units',tone:'mint'}, options: {action:'settings',tone:'purple'},
  phonicsRules: {action:'createWorksheet',tone:'purple'}, workbook: {action:'units',tone:'mint'},
};
