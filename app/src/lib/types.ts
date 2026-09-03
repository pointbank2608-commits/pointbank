export type Role = 'owner' | 'teacher' | 'student' | 'admin';

export interface Academy {
  id: string;
  name: string;
  point_unit: string;
  invite_code: string;
  logo_url: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  academy_id: string | null;
  role: Role;
  display_name: string;
  created_at: string;
}

export interface ClassRow {
  id: string;
  academy_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Student {
  id: string;
  academy_id: string;
  class_id: string;
  name: string;
  claim_code: string;
  user_id: string | null;
  created_at: string;
}

export interface Preset {
  id: string;
  academy_id: string;
  label: string;
  delta: number;
  sort_order: number;
  /** 숙제 캘린더에 반영할 프리셋인지 (양수=완료, 음수=미제출) */
  is_homework: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  academy_id: string;
  class_id: string | null;
  student_id: string;
  delta: number;
  reason: string;
  created_by: string | null;
  created_by_name: string;
  /** 지급 당시 사용한 프리셋이 숙제 관련으로 표시돼 있었는지 (프리셋이 나중에 바뀌어도 유지) */
  is_homework: boolean;
  created_at: string;
}

export interface StudentBalance {
  student_id: string;
  academy_id: string;
  class_id: string;
  name: string;
  balance: number;
  tx_count: number;
  last_tx_at: string | null;
}

export interface RankRow {
  student_id: string;
  name: string;
  class_name: string;
  balance: number;
}

/** 학생 카드 한 장에 필요한 정보를 합쳐놓은 형태 */
export interface StudentWithBalance extends Student {
  balance: number;
}

export interface Settlement {
  id: string;
  academy_id: string;
  class_id: string;
  settled_on: string;
  settled_by: string | null;
  settled_by_name: string;
  total_delta: number;
  student_count: number;
  created_at: string;
}

/** ranking_summary RPC 결과 */
export interface SummaryRow {
  student_id: string;
  name: string;
  class_name: string;
  balance: number;
  earned: number;
  spent: number;
  tx_count: number;
}

/** admin_list_academies() RPC 결과 */
export interface AdminAcademyRow {
  academy_id: string;
  name: string;
  point_unit: string;
  invite_code: string;
  created_at: string;
  owner_count: number;
  teacher_count: number;
  student_count: number;
}

export interface Attendance {
  id: string;
  academy_id: string;
  class_id: string;
  student_id: string;
  attended_on: string; // YYYY-MM-DD
  checked_in_at: string | null;
  checked_out_at: string | null;
  checked_in_by: string | null;
  checked_out_by: string | null;
  created_at: string;
}

/** 반별 통장 화면에서 카드 한 장이 쓰는 데이터 */
export interface BoardRow {
  studentId: string;
  name: string;
  /** 오늘 적립분 */
  today: number;
  /** 누적 잔액 (토글을 켰을 때만 표시) */
  total: number;
  /** 오늘 거래 내역 */
  todayTx: Transaction[];
}

/* ---------------- 미니게임 ---------------- */

export type GameType =
  | 'wheel'
  | 'ladder'
  | 'order'
  | 'bomb'
  | 'timer'
  | 'tictactoe'
  | 'saveorgive'
  | 'findmissing'
  | 'baskin31'
  | 'connect4'
  | 'popcorn'
  | 'passball'
  | 'twodice'
  | 'quiz'
  | 'hangman'
  | 'truefalse'
  | 'matchup'
  | 'whackamole'
  | 'flashcards'
  | 'anagram'
  | 'groupsort'
  | 'unscramble'
  | 'typeanswer'
  | 'spellword'
  | 'rankorder'
  | 'wordsearch'
  | 'crossword'
  | 'mathgen'
  | 'mazechase'
  | 'airplane'
  | 'labeleddiagram'
  | 'imagequiz'
  | 'gameshowquiz'
  | 'winlosequiz';

export interface GameItem {
  id: string;
  label: string;
}

/** 한 수만 되돌리기가 있는 게임 컴포넌트가 forwardRef로 노출하는 손잡이. */
export interface UndoHandle {
  undo: () => void;
}

/** 배경음악 선택. 기본 제공 효과음이거나, 학원이 직접 올린 음원. */
export type MusicSelection =
  | { kind: 'builtin'; id: string }
  | { kind: 'upload'; path: string; name: string; url: string };

export interface GameTemplateConfig {
  /** 사다리 전용: 맨 아래 결과 라벨 (items 와 개수가 같아야 함). 없으면 items 를 그대로 재사용. */
  results?: GameItem[];
  /** 순서정하기 전용: 순위 이름표 (items 와 개수가 같아야 함, 예: "1등"/"1번"). */
  ranks?: GameItem[];
  /** 시한폭탄 전용: 폭발까지 걸리는 시간(초)의 무작위 범위. */
  bombRange?: { min: number; max: number };
  /** 타이머 맞추기 전용: 목표 시간(밀리초). */
  targetMs?: number;
  /** 재생할 배경음악. 없으면 무음. */
  music?: MusicSelection | null;
  /** 결과가 확정되는 순간 울리는 사운드. 한 번도 설정 안 했으면(undefined) "짜잔"을 기본으로 쓴다. */
  resultSound?: MusicSelection | null;
  /** Save it or Give it 전용: 상자를 열었을 때 나올 수 있는 반전 결과 목록. */
  rewardPool?: SaveOrGiveReward[];
  /** 사라진 항목 찾기 전용: 한 판에서 몇 개를 숨길지 (기본 1). */
  revealCount?: number;
  /** 사라진 항목 찾기 전용: 숨긴 뒤 카드 자리를 섞을지 (기본 끔). */
  shuffleCards?: boolean;
  /** 게임 플레이 영역 비주얼 테마 id (app/src/lib/gameThemes.ts 참고). 없으면 기본 색상 그대로. */
  theme?: string;
  /** 베스킨라빈스31 전용: 이 숫자에 도달하면 지는 목표 숫자 (기본 31). */
  targetCount?: number;
  /** 공 돌리기 전용: 음악이 멈추기까지 걸리는 시간(초)의 무작위 범위. */
  ballRange?: { min: number; max: number };
  /**
   * 퀴즈 전용: 질문+보기 목록. 퀴즈는 항목이 "단어 하나"가 아니라 "질문+정답 보기 여러 개"라
   * 공용 items 로 표현이 안 돼서 여기 별도로 둔다 — 그래서 퀴즈는 "다른 게임으로 열기"
   * 대상에서 자연히 빠진다(콘텐츠 모양이 다른 게임들과 안 맞음).
   */
  questions?: QuizQuestion[];
  /** 행맨 전용: 한 단어당 허용되는 오답 횟수 (기본 6). */
  maxAttempts?: number;
  /**
   * 참 또는 거짓 전용: 문장+정답(참/거짓) 목록. 퀴즈와 마찬가지로 공용 items 모델과
   * 모양이 달라 여기 별도로 둔다 — "다른 게임으로 열기" 대상에서 자연히 제외된다.
   */
  statements?: TrueFalseStatement[];
  /**
   * 매치업·두더지잡기 전용: 단어+뜻 짝 목록. 공용 items 모델(단일 라벨)로는 "짝"을
   * 표현할 수 없어 별도로 둔다 — 다른 게임으로 열기 대상에서 자연히 제외된다.
   */
  pairs?: MatchPair[];
  /** 매치업 전용: 점토 트레이(A, 기본) 또는 매달린 나무 이름표(B). */
  matchupStyle?: 'trays' | 'tags';
  /** 두더지잡기 전용: 보드에 단어를 두고 구멍에서 뜻을 고를지, 반대로 할지. */
  whackMode?: 'wordToMeaning' | 'meaningToWord';
  /**
   * 답 입력하기 전용: 질문(또는 빈칸 있는 문장)+정답 목록. 워드월의 "답을 입력합니다"와
   * "문장 완성"은 둘 다 "프롬프트 보여주고 텍스트로 답 입력받기"라는 같은 상호작용이라
   * 하나의 게임에 모드 옵션(typeAnswerMode)으로 합쳤다.
   */
  typeAnswerEntries?: TypeAnswerEntry[];
  /** 답 입력하기 전용: 'question'(질문에 답하기) 또는 'cloze'(빈칸 채우기 — 프롬프트에 ___ 포함). 기본 'question'. */
  typeAnswerMode?: 'question' | 'cloze';
  /** 답 입력하기 전용: 나무 공책(A, 기본) 또는 점토 말풍선(B). */
  typeAnswerStyle?: 'notebook' | 'bubble';
  /** 단어 철자 전용: 단어를 보여주는 시간(초). 기본 3. */
  spellPreviewSeconds?: number;
  /** 단어 철자 전용: 나무 슬레이트(A, 기본) 또는 점토 스탬프(B). */
  spellwordStyle?: 'slate' | 'stamps';
  /** 순위 전용: 나무 단상(A, 기본) 또는 점토 명패(B). */
  rankOrderStyle?: 'podium' | 'plates';
  /** 워드서치 전용: 나무 격자판(A, 기본) 또는 점토 타일(B). */
  wordSearchStyle?: 'board' | 'tiles';
  /** 크로스워드 전용: 나무 퍼즐판(A, 기본) 또는 점토 블록(B). */
  crosswordStyle?: 'board' | 'blocks';
  /** 수학 문제 생성기 전용: 나무 칠판(A, 기본) 또는 점토 숫자(B). */
  mathgenStyle?: 'slate' | 'blocks';
  /** 미로 찾기 전용: 나무 미로(A, 기본) 또는 점토 정원(B). */
  mazeChaseStyle?: 'wood' | 'garden';
  /** 비행기 전용: 나무 활주로(A, 기본) 또는 점토 하늘(B). */
  airplaneStyle?: 'wood' | 'clay';
  /** 명칭이 있는 다이어그램 전용: 나무 액자(A, 기본) 또는 점토 핀(B). */
  labeledDiagramStyle?: 'wood' | 'clay';
  /**
   * 수학 문제 생성기 전용: 단어 리스트 대신 설정값(연산 종류·숫자 범위·문제 개수)으로
   * 매번 새 문제를 만들어낸다. 그래서 items 를 아예 쓰지 않는 유일한 게임이다.
   */
  mathOperations?: MathOperation[];
  mathMin?: number;
  mathMax?: number;
  mathQuestionCount?: number;
  /** 그룹 정렬 전용: 그룹(이름+소속 항목) 목록. 항목이 어느 그룹인지가 곧 정답이라 공용 items 모델로는 표현이 안 돼 별도로 둔다. */
  groups?: GroupSortGroup[];
  /** 그룹 정렬 전용: 나무 상자(A, 기본) 또는 점토 바구니(B). */
  groupSortStyle?: 'crates' | 'baskets';
  /** 플래시카드 전용: 카드 앞(left)/뒤(right) 목록. 매치업의 MatchPair 모양을 그대로 재사용한다. */
  flashcards?: MatchPair[];
  /** 플래시카드 전용: 나무 액자(A, 기본) 또는 점토 카드(B). */
  flashcardsStyle?: 'wood' | 'clay';
  /** 애너그램 전용: 나무 글자판+점토 타일(A, 기본) 또는 매달린 이름표(B). */
  anagramStyle?: 'rack' | 'tags';
  /** 문장 배열하기 전용: 나무 글자판+점토 타일(A, 기본) 또는 매달린 이름표(B). */
  unscrambleStyle?: 'rack' | 'tags';
  /** 명칭이 있는 다이어그램 전용: 배경으로 쓸 업로드 이미지 URL. */
  diagramImageUrl?: string;
  /** 명칭이 있는 다이어그램 전용: 이미지 위에 찍은 핀(정답 라벨+좌표) 목록. */
  diagramPins?: DiagramPin[];
  /** 이미지 퀴즈 전용: 사진+정답 목록. */
  imageQuizItems?: ImageQuizItem[];
  /** 이미지 퀴즈 전용: 사진이 흐림에서 선명해지기까지 걸리는 시간(초). 기본 6. */
  imageQuizRevealSeconds?: number;
  /** 이미지 퀴즈 전용: 나무 액자(A, 기본) 또는 점토 창(B). */
  imageQuizStyle?: 'wood' | 'clay';
  /** 게임쇼 퀴즈 전용: 몇 번째 문제마다 보너스(2배 점수)로 만들지 (기본 5). */
  gameShowBonusEvery?: number;
  /** 게임쇼 퀴즈 전용: 팀마다 쓸 수 있는 "반반(50:50)" 라이프라인 개수 (기본 2). */
  gameShowLifelines?: number;
  /** 게임쇼 퀴즈 전용: 나무 무대(A, 기본) 또는 점토 스튜디오(B). */
  gameShowStyle?: 'wood' | 'clay';
  /** 퀴즈를 이기거나 잃기 전용: 팀 시작 점수 (기본 100). */
  winLoseStartScore?: number;
  /** 퀴즈를 이기거나 잃기 전용: 베팅 금액 선택지 (기본 [10, 20, 50]). */
  winLoseBetOptions?: number[];
  /** 퀴즈를 이기거나 잃기 전용: 나무 테이블(A, 기본) 또는 점토 칩(B). */
  winLoseStyle?: 'wood' | 'clay';
}

export interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
}

export interface TrueFalseStatement {
  id: string;
  text: string;
  isTrue: boolean;
  /** 틀렸을 때만 보여주는 선택 설명. 비우면 안 나온다. */
  explanation?: string;
}

export interface MatchPair {
  id: string;
  left: string;
  right: string;
}

export interface GroupSortItem {
  id: string;
  text: string;
}

export interface GroupSortGroup {
  id: string;
  name: string;
  items: GroupSortItem[];
}

export interface TypeAnswerEntry {
  id: string;
  prompt: string;
  answer: string;
}

export type MathOperation = 'add' | 'sub' | 'mul' | 'div';

/** Save it or Give it 상자 결과 하나. kind:'points' 면 value 만큼 점수 증감, kind:'swap' 이면 두 팀 점수를 서로 바꾼다. */
export interface SaveOrGiveReward {
  kind: 'points' | 'swap';
  value?: number;
}

/** 명칭이 있는 다이어그램 전용: 이미지 위 핀 하나. x/y 는 이미지 너비/높이 대비 0~1 비율. */
export interface DiagramPin {
  id: string;
  label: string;
  x: number;
  y: number;
}

/** 이미지 퀴즈 전용: 사진 한 장 + 정답. */
export interface ImageQuizItem {
  id: string;
  imageUrl: string;
  answer: string;
}

/* ---------------- 단어장 (교육부 지정 초등 필수 영단어 800, 학원 구분 없는 공용 사전) ---------------- */

export interface WordBankEntry {
  id: string;
  word: string;
  sense_number: number;
  part_of_speech: string;
  meaning: string;
  example_sentence: string | null;
  category: string | null;
  image_url: string | null;
  sort_order: number;
}

/* ---------------- 파닉스(소리 규칙) 단어, 학원 구분 없는 공용 데이터 ---------------- */

export interface PhonicsBankEntry {
  id: string;
  word: string;
  /** 소리 규칙에 해당하는 글자를 {} 로 감싼 문자열. 예: "r{ai}n", 비연속 규칙은 "b{a}k{e}". */
  pattern_marked: string;
  step: number;
  rule: string;
  meaning: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface GameTemplate {
  id: string;
  academy_id: string;
  /** null 이면 학원 전체 공용 (반 상관없이 어디서나 보임) */
  class_id: string | null;
  game_type: GameType;
  name: string;
  items: GameItem[];
  config: GameTemplateConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------------- 단어장(선생님이 반/수업별로 만드는 것 — word_bank 와 다름) ---------------- */

export interface WordListItem {
  id: string;
  word: string;
  meaning: string;
  /** "사전에서 선택"으로 담았을 때만 채워짐(word_bank.image_url 복사). 직접 입력이면 null. */
  image_url: string | null;
  /** "사전에서 선택"으로 담았을 때만 채워짐(word_bank.category 복사). 그룹정렬 자동 그룹화에 씀. */
  category: string | null;
}

export interface WordList {
  id: string;
  academy_id: string;
  /** null 이면 학원 전체 공용 */
  class_id: string | null;
  name: string;
  items: WordListItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
