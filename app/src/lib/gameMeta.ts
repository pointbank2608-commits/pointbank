/**
 * 게임 카드 한 줄 정보(2026-10-17, 외부 평가: "선생님은 게임 이름보다 '우리 반에 지금 쓸 수 있나?'를 먼저 판단한다").
 * 예상 시간(분)·참여 방식·준비물. 새 게임을 추가하면 여기에도 한 줄 더할 것(없으면 칩이 안 보일 뿐 안전하다).
 */
export type GamePlay = 'whole' | 'team' | 'pairs' | 'single';
export interface GameMeta {
  minutes: number;
  play: GamePlay;
  /** 종이·연필이 필요한 게임 */
  paper?: boolean;
  /** 학생 휴대폰이 필요한 게임(앱 설치 없음) */
  phone?: boolean;
}

export const GAME_META: Record<string, GameMeta> = {
  feedmonster: { minutes: 5, play: 'whole' },
  sentencebridge: { minutes: 7, play: 'whole' },
  sentencetower: { minutes: 7, play: 'whole' },
  sentencesplash: { minutes: 6, play: 'whole' },
  shufflefind: { minutes: 8, play: 'team' },
  telepathy: { minutes: 10, play: 'team', paper: true },
  wheel: { minutes: 3, play: 'whole' },
  ladder: { minutes: 5, play: 'whole' },
  order: { minutes: 3, play: 'whole' },
  bomb: { minutes: 5, play: 'whole' },
  timer: { minutes: 3, play: 'whole' },
  tictactoe: { minutes: 8, play: 'team' },
  saveorgive: { minutes: 8, play: 'team' },
  findmissing: { minutes: 5, play: 'whole' },
  baskin31: { minutes: 8, play: 'team' },
  connect4: { minutes: 10, play: 'team' },
  popcorn: { minutes: 5, play: 'whole' },
  passball: { minutes: 5, play: 'whole' },
  twodice: { minutes: 10, play: 'team' },
  quiz: { minutes: 8, play: 'whole' },
  hangman: { minutes: 5, play: 'team' },
  truefalse: { minutes: 5, play: 'whole' },
  matchup: { minutes: 5, play: 'whole' },
  whackamole: { minutes: 5, play: 'team' },
  flashcards: { minutes: 5, play: 'whole' },
  anagram: { minutes: 5, play: 'whole' },
  groupsort: { minutes: 5, play: 'whole' },
  unscramble: { minutes: 5, play: 'whole' },
  typeanswer: { minutes: 5, play: 'single' },
  spellword: { minutes: 5, play: 'whole' },
  rankorder: { minutes: 5, play: 'whole' },
  wordsearch: { minutes: 8, play: 'single' },
  crossword: { minutes: 10, play: 'single' },
  mathgen: { minutes: 5, play: 'single' },
  mazechase: { minutes: 8, play: 'team' },
  airplane: { minutes: 8, play: 'team' },
  labeleddiagram: { minutes: 5, play: 'whole' },
  imagequiz: { minutes: 5, play: 'whole' },
  gameshowquiz: { minutes: 12, play: 'team' },
  winlosequiz: { minutes: 10, play: 'team' },
  watermelon: { minutes: 5, play: 'whole' },
  quizshow: { minutes: 15, play: 'whole', phone: true },
  shopping: { minutes: 10, play: 'pairs' },
  treasuredig: { minutes: 12, play: 'team' },
  fourclues: { minutes: 10, play: 'team' },
  catchsentence: { minutes: 8, play: 'team', paper: true },
  lastbox: { minutes: 10, play: 'whole' },
  mysterybox: { minutes: 15, play: 'team', paper: true },
  airport: { minutes: 15, play: 'pairs' },
  restaurant: { minutes: 15, play: 'pairs' },
  icecream: { minutes: 15, play: 'pairs' },
  doctor: { minutes: 15, play: 'pairs' },
  lightning: { minutes: 8, play: 'whole' },
};
