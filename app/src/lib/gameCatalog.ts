import type { GameType } from './types';

/**
 * 게임 용도 구분. GamesPage.tsx 필터 탭과 커뮤니케이션(카테고리별로 무엇이 몇 개인지)에 쓴다.
 * - simple: 어떤 단어 리스트든 넣을 수 있는 범용 교실 게임(팀 대결·랜덤 뽑기 등)
 * - vocabulary: 단어 뜻/철자 암기에 특화된 게임(워드월 스타일 템플릿)
 * - sentence: 문장 만들기/어순 연습
 * - listening / reading / speaking: 각 언어 영역 특화
 */
export type GameCategory = 'simple' | 'vocabulary' | 'sentence' | 'listening' | 'reading' | 'speaking';

export interface GameCatalogEntry {
  type: GameType;
  /**
   * 참고용 번호. "3번 게임 고쳐줘" 식으로 대화에서 가리키기 위한 용도일 뿐, game_type
   * 문자열이 실제 식별자다 — DB에는 번호가 저장되지 않으니 순서를 바꿔도 데이터는 안 깨진다.
   */
  number: number;
  category: GameCategory;
  /** 이 게임이 필요로 하는 최소 항목 개수. 모자라면 각 게임이 반복/샘플링으로 자동 보정한다. */
  minItems: number;
  icon: string;
  path: string;
  /** GamesPage 카드 커버 사진 경로. 없으면 그라데이션+아이콘으로 대체 표시. */
  cover: string | null;
  nameKey: string;
  descKey: string;
}

/**
 * 전체 게임 메타데이터 — 단일 소스. GamesPage.tsx(카드 목록), OpenInOtherGame.tsx(다른
 * 게임으로 열기 후보)가 전부 여기서 읽는다. 새 게임을 추가하면 여기에 한 줄만 추가하면
 * 두 화면 모두에 자동 반영된다.
 */
export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    type: 'wheel',
    number: 1,
    category: 'simple',
    minItems: 1,
    icon: 'target',
    path: '/games/wheel',
    cover: '/covers/game-wheel.jpg',
    nameKey: 'gamesList.wheelName',
    descKey: 'gamesList.wheelDesc',
  },
  {
    type: 'ladder',
    number: 2,
    category: 'simple',
    minItems: 2,
    icon: 'alt_route',
    path: '/games/ladder',
    cover: '/covers/game-ladder.jpg',
    nameKey: 'gamesList.ladderName',
    descKey: 'gamesList.ladderDesc',
  },
  {
    type: 'order',
    number: 3,
    category: 'simple',
    minItems: 2,
    icon: 'sports_baseball',
    path: '/games/order',
    cover: '/covers/game-balls.jpg',
    nameKey: 'gamesList.orderName',
    descKey: 'gamesList.orderDesc',
  },
  {
    type: 'bomb',
    number: 4,
    category: 'simple',
    minItems: 1,
    icon: 'bolt',
    path: '/games/bomb',
    cover: '/covers/game-bomb.jpg',
    nameKey: 'gamesList.bombName',
    descKey: 'gamesList.bombDesc',
  },
  {
    type: 'timer',
    number: 5,
    category: 'simple',
    minItems: 1,
    icon: 'timer',
    path: '/games/timer',
    cover: '/covers/game-timer.jpg',
    nameKey: 'gamesList.timerName',
    descKey: 'gamesList.timerDesc',
  },
  {
    type: 'tictactoe',
    number: 6,
    category: 'simple',
    minItems: 1,
    icon: 'grid_3x3',
    path: '/games/tictactoe',
    cover: '/covers/game-tictactoe.jpg',
    nameKey: 'gamesList.tictactoeName',
    descKey: 'gamesList.tictactoeDesc',
  },
  {
    type: 'saveorgive',
    number: 7,
    category: 'simple',
    minItems: 1,
    icon: 'redeem',
    path: '/games/saveorgive',
    cover: '/covers/game-saveorgive.jpg',
    nameKey: 'gamesList.saveorgiveName',
    descKey: 'gamesList.saveorgiveDesc',
  },
  {
    type: 'findmissing',
    number: 8,
    category: 'simple',
    minItems: 2,
    icon: 'search',
    path: '/games/findmissing',
    cover: '/covers/game-findmissing.jpg',
    nameKey: 'gamesList.findmissingName',
    descKey: 'gamesList.findmissingDesc',
  },
  {
    type: 'baskin31',
    number: 9,
    category: 'simple',
    minItems: 1,
    icon: 'icecream',
    path: '/games/baskin31',
    cover: '/covers/game-baskin31.jpg',
    nameKey: 'gamesList.baskin31Name',
    descKey: 'gamesList.baskin31Desc',
  },
  {
    type: 'connect4',
    number: 10,
    category: 'simple',
    minItems: 1,
    icon: 'grid_on',
    path: '/games/connect4',
    cover: '/covers/game-connect4.jpg',
    nameKey: 'gamesList.connect4Name',
    descKey: 'gamesList.connect4Desc',
  },
  {
    type: 'popcorn',
    number: 11,
    category: 'simple',
    minItems: 1,
    icon: 'casino',
    path: '/games/popcorn',
    cover: '/covers/game-popcorn.jpg',
    nameKey: 'gamesList.popcornName',
    descKey: 'gamesList.popcornDesc',
  },
  {
    type: 'passball',
    number: 12,
    category: 'simple',
    minItems: 1,
    icon: 'sports_volleyball',
    path: '/games/passball',
    cover: '/covers/game-passball.jpg',
    nameKey: 'gamesList.passballName',
    descKey: 'gamesList.passballDesc',
  },
  {
    type: 'twodice',
    number: 13,
    category: 'simple',
    minItems: 1,
    icon: 'casino',
    path: '/games/twodice',
    cover: '/covers/game-twodice.jpg',
    nameKey: 'gamesList.twodiceName',
    descKey: 'gamesList.twodiceDesc',
  },
  {
    type: 'quiz',
    number: 14,
    category: 'vocabulary',
    // 퀴즈는 항목(단어) 리스트가 아니라 질문+보기 구조라 다른 게임에서 "퀴즈로 열기"가
    // 성립하지 않는다 — 실제 항목 개수로는 절대 못 채울 값을 넣어 후보에서 자연히 빠지게 한다.
    minItems: 999,
    icon: 'quiz',
    path: '/games/quiz',
    cover: '/covers/game-quiz.jpg',
    nameKey: 'gamesList.quizName',
    descKey: 'gamesList.quizDesc',
  },
  {
    type: 'hangman',
    number: 15,
    category: 'vocabulary',
    minItems: 1,
    icon: 'abc',
    path: '/games/hangman',
    cover: '/covers/game-hangman.jpg',
    nameKey: 'gamesList.hangmanName',
    descKey: 'gamesList.hangmanDesc',
  },
  {
    type: 'truefalse',
    number: 16,
    category: 'vocabulary',
    // 퀴즈와 마찬가지로 문장+정답 구조라 공용 items 모델과 안 맞아 다른 게임으로 열기에서 빠진다.
    minItems: 999,
    icon: 'fact_check',
    path: '/games/truefalse',
    cover: '/covers/game-truefalse.jpg',
    nameKey: 'gamesList.truefalseName',
    descKey: 'gamesList.truefalseDesc',
  },
  {
    type: 'matchup',
    number: 17,
    category: 'vocabulary',
    // 단어+뜻 짝 구조라 공용 items 모델과 안 맞아 다른 게임으로 열기에서 빠진다.
    minItems: 999,
    icon: 'link',
    path: '/games/matchup',
    cover: '/covers/game-matchup.jpg',
    nameKey: 'gamesList.matchupName',
    descKey: 'gamesList.matchupDesc',
  },
  {
    type: 'whackamole',
    number: 18,
    category: 'vocabulary',
    minItems: 1,
    icon: 'touch_app',
    path: '/games/whackamole',
    cover: '/covers/game-whackamole.jpg',
    nameKey: 'gamesList.whackamoleName',
    descKey: 'gamesList.whackamoleDesc',
  },
  {
    type: 'flashcards',
    number: 19,
    category: 'vocabulary',
    // 앞/뒤 카드 짝 구조라 공용 items 모델과 안 맞아 다른 게임으로 열기에서 빠진다.
    minItems: 999,
    icon: 'flip',
    path: '/games/flashcards',
    cover: '/covers/game-flashcards.jpg',
    nameKey: 'gamesList.flashcardsName',
    descKey: 'gamesList.flashcardsDesc',
  },
  {
    type: 'anagram',
    number: 20,
    category: 'vocabulary',
    minItems: 1,
    icon: 'shuffle',
    path: '/games/anagram',
    cover: '/covers/game-anagram.jpg',
    nameKey: 'gamesList.anagramName',
    descKey: 'gamesList.anagramDesc',
  },
  {
    type: 'groupsort',
    number: 21,
    category: 'vocabulary',
    // 그룹(이름+소속 항목) 구조라 공용 items 모델과 안 맞아 다른 게임으로 열기에서 빠진다.
    minItems: 999,
    icon: 'category',
    path: '/games/groupsort',
    cover: '/covers/game-groupsort.jpg',
    nameKey: 'gamesList.groupsortName',
    descKey: 'gamesList.groupsortDesc',
  },
  {
    type: 'unscramble',
    number: 22,
    category: 'sentence',
    // 문장(여러 단어)이 통째로 하나의 항목이라 다른 게임(칸에 짧은 단어를 넣는 식)과는
    // 안 맞아 다른 게임으로 열기에서 빠진다.
    minItems: 999,
    icon: 'reorder',
    path: '/games/unscramble',
    cover: '/covers/game-unscramble.jpg',
    nameKey: 'gamesList.unscrambleName',
    descKey: 'gamesList.unscrambleDesc',
  },
  {
    type: 'typeanswer',
    number: 23,
    category: 'vocabulary',
    // 질문/빈칸+정답 구조라 공용 items 모델과 안 맞아 다른 게임으로 열기에서 빠진다.
    minItems: 999,
    icon: 'keyboard',
    path: '/games/typeanswer',
    cover: '/covers/game-typeanswer.jpg',
    nameKey: 'gamesList.typeanswerName',
    descKey: 'gamesList.typeanswerDesc',
  },
  {
    type: 'spellword',
    number: 24,
    category: 'vocabulary',
    minItems: 1,
    icon: 'edit',
    path: '/games/spellword',
    cover: '/covers/game-spellword.jpg',
    nameKey: 'gamesList.spellwordName',
    descKey: 'gamesList.spellwordDesc',
  },
  {
    type: 'rankorder',
    number: 25,
    category: 'vocabulary',
    minItems: 2,
    icon: 'sort',
    path: '/games/rankorder',
    cover: '/covers/game-rankorder.jpg',
    nameKey: 'gamesList.rankorderName',
    descKey: 'gamesList.rankorderDesc',
  },
  {
    type: 'wordsearch',
    number: 26,
    category: 'vocabulary',
    minItems: 2,
    icon: 'grid_view',
    path: '/games/wordsearch',
    cover: '/covers/game-wordsearch.jpg',
    nameKey: 'gamesList.wordsearchName',
    descKey: 'gamesList.wordsearchDesc',
  },
  {
    type: 'crossword',
    number: 27,
    category: 'vocabulary',
    minItems: 2,
    icon: 'border_all',
    path: '/games/crossword',
    cover: '/covers/game-crossword.jpg',
    nameKey: 'gamesList.crosswordName',
    descKey: 'gamesList.crosswordDesc',
  },
  {
    type: 'mathgen',
    number: 28,
    // 단어 리스트가 아니라 설정값으로 문제를 매번 새로 만들어내는 유일한 게임이라
    // 다른 카테고리에 안 맞는다 — 특정 콘텐츠 없이도 쓸 수 있는 범용 도구라는 점에서 simple로 분류.
    category: 'simple',
    // items 를 아예 안 써서(설정값만으로 문제 생성) 다른 게임으로 열기 대상/후보 양쪽에서 자연히 제외된다.
    minItems: 999,
    icon: 'calculate',
    path: '/games/mathgen',
    cover: '/covers/game-mathgen.jpg',
    nameKey: 'gamesList.mathgenName',
    descKey: 'gamesList.mathgenDesc',
  },
  {
    type: 'mazechase',
    number: 29,
    category: 'vocabulary',
    minItems: 2,
    icon: 'directions_run',
    path: '/games/mazechase',
    cover: '/covers/game-mazechase.jpg',
    nameKey: 'gamesList.mazechaseName',
    descKey: 'gamesList.mazechaseDesc',
  },
  {
    type: 'airplane',
    number: 30,
    category: 'vocabulary',
    minItems: 2,
    icon: 'flight',
    path: '/games/airplane',
    cover: '/covers/game-airplane.jpg',
    nameKey: 'gamesList.airplaneName',
    descKey: 'gamesList.airplaneDesc',
  },
];

export function getGameCatalogEntry(type: GameType): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((g) => g.type === type);
}
