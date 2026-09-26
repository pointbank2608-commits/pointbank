export type Role = 'owner' | 'teacher' | 'student' | 'admin';

export interface Academy {
  id: string;
  name: string;
  point_unit: string;
  invite_code: string;
  logo_url: string | null;
  created_at: string;
  plan: 'free' | 'paid';
  plan_status: 'active' | 'pending_cancel';
  next_billing_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
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

export interface BillingHistoryRow {
  id: string;
  academy_id: string;
  billed_at: string;
  period_start: string;
  period_end: string;
  student_count: number;
  amount_krw: number;
  status: 'success' | 'failed';
  portone_payment_id: string | null;
  failure_reason: string | null;
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
  plan: 'free' | 'paid';
  plan_expires_at: string | null;
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
  | 'winlosequiz'
  | 'watermelon';

export interface GameItem {
  id: string;
  label: string;
  /**
   * 수박 문장 게임 전용: 이 단어가 문장에서 맡는 자리(주어/동사/목적어 등).
   * 다른 게임은 무시한다. 값은 `sentencePatterns.ts` 의 SentenceSlot.
   */
  slot?: string | null;
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
  /** 시한폭탄 전용: 폭발까지 걸리는 시간(초)의 무작위 범위. */
  bombRange?: { min: number; max: number };
  /** 시한폭탄 전용: 폭탄이 넘어갈 때마다 무작위로 하나 보여주는 읽을 단어·문장 목록. */
  words?: GameItem[];
  /** 타이머 맞추기 전용: 목표 시간(밀리초). */
  targetMs?: number;
  /** 재생할 배경음악. 없으면 무음. */
  music?: MusicSelection | null;
  /** 결과가 확정되는 순간 울리는 사운드. 한 번도 설정 안 했으면(undefined) "짜잔"을 기본으로 쓴다. */
  resultSound?: MusicSelection | null;
  /** Save it or Give it 전용: 상자를 열었을 때 나올 수 있는 반전 결과 목록. */
  rewardPool?: SaveOrGiveReward[];
  /** Save it or Give it 전용: 개인전(학생 각자) / 팀전(N개 팀) 모드. 기본은 팀전. */
  saveOrGiveMode?: 'individual' | 'team';
  /** Save it or Give it 전용: 팀전일 때 팀 수 (기본 2). */
  saveOrGiveTeamCount?: number;
  /** Save it or Give it 전용: 개인전일 때 참가자 명단(학생 명단에서 담음). items(상자 안 단어·상품
   * 목록)와는 별개다. */
  saveOrGiveParticipants?: GameItem[];
  /** 사라진 항목 찾기 전용: 한 판에서 몇 개를 숨길지 (기본 1). */
  revealCount?: number;
  /** 사라진 항목 찾기 전용: 숨긴 뒤 카드 자리를 섞을지 (기본 끔). */
  shuffleCards?: boolean;
  /** 사라진 항목 찾기 전용: 카드를 외우는 시간(초). undefined(한 번도 설정 안 함) → 기본값(10초).
   * null(선생님이 "직접 진행"을 골라 시간제한을 껐음) → 시간 없이 "섞기" 버튼으로 수동 진행. */
  memorizeSeconds?: number | null;
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
  /**
   * 수박 문장 게임 전용: SENTENCE_PATTERNS 의 id (sv, svo, …).
   * 없으면 기본값 svo. 새 문장 틀은 sentencePatterns.ts 에만 추가하면 된다.
   */
  watermelonPatternId?: string;
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

/** 단어+뜻+이미지를 한꺼번에 쓰는 인쇄물(메모리 카드 등) 전용. 이미지는 없을 수 있다. */
export interface FullCardItem {
  id: string;
  word: string;
  meaning: string;
  imageUrl: string | null;
  /** 사전·단어장에서 담았을 때만 있다(분류하기 워크시트가 묶는 기준). 직접 입력한 단어는 없다. */
  category?: string | null;
  /** 사전에서 담았을 때만 있는 예문(문장 순서 바꾸기가 쓴다). */
  example?: string | null;
  /** 사전에서 담았을 때만 있는 품사(단어 리스트가 보여준다). */
  partOfSpeech?: string | null;
  /** 파닉스에서 담았을 때만 있는 소리 규칙 글자를 {} 로 감싼 표기(예: "r{ai}n"). 파닉스 전용 워크시트가 쓴다. */
  patternMarked?: string | null;
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
  /** 020 마이그레이션 전에는 응답에 아예 없다 — 전부 optional로 다룬다. */
  level?: number | null;
  subcategory?: string | null;
  extra_categories?: string[] | null;
  origin?: 'moe' | 'classbank' | null;
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
  /** "사전에서 선택"으로 담았을 때만 채워짐(word_bank.part_of_speech 복사). 수박 문장 게임 자리 자동 부여에 씀. */
  partOfSpeech?: string | null;
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

/* ---------------- 내 커리큘럼 (반별 수업 유닛 — 단어장+슬라이드 목록 묶음) ---------------- */

/** 슬라이드 한 장. id 는 드래그 순서변경 시 React key 겸 dnd-kit sortable id.
 * 캔바 프레젠테이션처럼 이미지·영상·게임을 자유 순서로 배치한다(2026-09-24 슬라이드 빌더 도입).
 * 다음 단계에서 'flashcard'/'worksheet' kind 를 추가할 자리를 남겨둔다 — 지금은 구현하지 않음. */
export interface ImageSlide {
  id: string;
  kind: 'image';
  /** 스토리지 경로(삭제용). lesson-slide-images 버킷 기준. */
  imagePath: string;
  imageUrl: string;
}

export interface VideoSlide {
  id: string;
  kind: 'video';
  videoUrl: string;
}

export interface GameSlide {
  id: string;
  kind: 'game';
  gameType: GameType;
  /** 편집 화면에서 미리 만들어/골라 둔 게임 콘텐츠(game_templates.id). 발표 중엔 이 템플릿을
   * 그대로 연다 — 없으면 그 게임 페이지가 반의 첫 템플릿을 연다. */
  templateId?: string;
}

/** 워크시트 탭별 세부 옵션(WorksheetPrintPage.tsx 의 listShow/tracingShow/showAnswerKey/
 * includeAnswers/askTemplate/coloring 을 그대로 저장). worksheetGenerators.ts 의
 * ColoringOptions/AskTemplate 타입을 그대로 가져오면 그 파일이 이 파일(FullCardItem)을 거꾸로
 * 참조하고 있어 순환 참조가 생긴다 — 구조적으로 같은 리터럴 타입을 여기 복제해 피한다. 전부
 * optional이라 예전에 저장된 슬라이드(옵션 없음)도 기본값으로 그대로 동작한다. */
export interface WorksheetSlideOptions {
  listShow?: { pos: boolean; example: boolean; image: boolean };
  tracingShow?: { meaning: boolean; image: boolean };
  showAnswerKey?: boolean;
  includeAnswers?: boolean;
  askTemplate?: 'like' | 'have' | 'see';
  coloringTitle?: string;
  coloringLabelMode?: 'word' | 'write' | 'none';
  coloringPerPage?: 4 | 6 | 8 | 9;
  coloringDecorTheme?: string | null;
}

/** 수업 자료실(플래시카드·워크시트·빙고·메모리 카드 등) 화면 하나. materialId 는
 * lib/materialsCatalog.ts 의 MATERIALS_CATALOG 항목 id. materialId 가 'worksheet' 일 때만
 * worksheetTab 을 같이 저장할 수 있다 — /materials/worksheet 페이지 안 18개 탭(빈칸 채우기·
 * 선 잇기 등) 중 어떤 탭을 열어둘지(WorksheetPrintPage 의 Tab, lib/worksheetGenerators.ts 의
 * NEW_WORKSHEET_KINDS + 'list'/'card'/'tracing'/'quiz'). 없으면 그 페이지의 기본 탭(단어
 * 리스트)으로 연다. worksheetOptions 는 그 탭의 세부 설정(2026-09-25 추가) — 발표 중엔 옵션
 * 컨트롤이 안 보이므로 여기서 미리 정해둔 값이 그대로 쓰인다. */
export interface MaterialSlide {
  id: string;
  kind: 'material';
  materialId: string;
  worksheetTab?: string;
  worksheetOptions?: WorksheetSlideOptions;
  /** 발표 중 워크시트 화면 바탕(칠판·화이트보드 등, lib/boardThemes.ts). 없으면 앱 기본 바탕. */
  boardTheme?: string | null;
}

/** 외부 웹페이지(캔바 프레젠테이션·출판사 E-book 등) 슬라이드. mode:
 * - 'embed' : 슬라이드 안에 iframe 으로 띄운다(캔바 view?embed 링크처럼 끼워 넣기를 허용하는 곳).
 * - 'window': 로그인이 필요한 E-book처럼 다른 사이트 안에선 로그인이 안 되는 곳 — 수업 중 큰 버튼으로
 *   새 창을 연다(선생님 브라우저의 로그인이 그대로 쓰인다). lib/webSlides.ts 가 주소로 기본값을 고른다. */
export interface WebSlide {
  id: string;
  kind: 'web';
  url: string;
  title?: string;
  mode: 'embed' | 'window';
}

/** "직접 만들기" 슬라이드(PPT처럼 텍스트 상자·이미지를 자유 배치, 2026-09-25). 좌표·크기는 전부
 * 16:9 무대 기준 %(0~100), 글자 크기는 무대 높이 대비 %(cqh) — 편집 화면·썸네일·발표 화면 어디서
 * 그려도 같은 비율로 보인다. */
export interface CanvasElementBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface CanvasTextElement extends CanvasElementBase {
  type: 'text';
  text: string;
  /** 무대 높이 대비 % */
  fontSize: number;
  color: string;
  bold: boolean;
  italic?: boolean;
  align: 'left' | 'center' | 'right';
  font: 'sans' | 'round' | 'kids' | 'hand';
  /** 글상자 배경색(없으면 투명) */
  fill?: string | null;
}
export interface CanvasImageElement extends CanvasElementBase {
  type: 'image';
  url: string;
  /** 직접 올린 이미지만 있다(lesson-slide-images). 사전 그림은 없음. */
  path?: string;
  fit: 'contain' | 'cover';
}
export type CanvasElement = CanvasTextElement | CanvasImageElement;
export interface CanvasSlide {
  id: string;
  kind: 'canvas';
  background: string;
  /** 칠판·화이트보드 등 배경 테마(lib/boardThemes.ts). 있으면 background 색 대신 이걸 그린다. */
  theme?: string | null;
  backgroundImageUrl?: string | null;
  backgroundImagePath?: string | null;
  elements: CanvasElement[];
}

/** "카드로 외우기" 슬라이드 — 단어 사전의 카드로 외우기 화면(FlashcardStudy)을 수업 단어장으로 띄운다. */
export interface StudySlide {
  id: string;
  kind: 'study';
  /** 섞은 순서로 시작 */
  shuffle?: boolean;
}

/** "문법" 슬라이드 — 초등 영문법(lib/grammar.ts)의 한 항목을 칠판 화면(GrammarBoard)으로 띄운다. */
export interface GrammarSlide {
  id: string;
  kind: 'grammar';
  grammarId: string;
  /** 수업 단어장 낱말로 만든 예문도 같이 보여줄지 */
  useWordList?: boolean;
  /** 단어장 예문 조합(다시 섞기) — 같은 값이면 미리보기와 발표가 같은 문장 */
  seed?: number;
  /** 칠판·화이트보드 배경(lib/boardThemes.ts). 없으면 녹색 칠판. */
  boardTheme?: string | null;
  /** 발표 시작할 때 예문 해석을 켠 채로 */
  showKo?: boolean;
  /** 발표 시작할 때 예문을 하나씩 꺼내지 않고 모두 보여주기 */
  revealAll?: boolean;
}

/** "노래·지문 한 줄씩" 슬라이드 — 원문 형식은 lib/readingLines.ts. 가사 등 원문은 이 수업 안에만 저장. */
export interface ReadingSlide {
  id: string;
  kind: 'reading';
  title?: string;
  /** 한 줄에 "[분:초] 영어 | 해석", ** ** = 강조·빈칸 */
  source: string;
  videoUrl?: string | null;
  mode: 'lines' | 'cloze';
  boardTheme?: string | null;
}

export type LessonSlide = ImageSlide | VideoSlide | GameSlide | MaterialSlide | WebSlide | CanvasSlide | StudySlide | GrammarSlide | ReadingSlide;

/** 옛 데이터 호환용 — 마이그레이션 전 playlist 가 이 모양이면 lib/lessonSlides.ts 의
 * effectiveSlides() 가 GameSlide[] 로 간주해 읽는다. */
export interface LegacyCurriculumStep {
  id: string;
  gameType: GameType;
}

export interface CurriculumLesson {
  id: string;
  academy_id: string;
  /** null 이면 학원 전체 공용 */
  class_id: string | null;
  name: string;
  /** 이 레슨(모든 게임 슬라이드)이 공통으로 쓰는 단어장. 삭제되면 null(레슨 자체는 남음). */
  word_list_id: string | null;
  /** 예전 데이터 호환용 컬럼 — 더 이상 새로 쓰지 않는다. 영상은 이제 playlist 안의
   * VideoSlide 로 순서 자유롭게 들어간다. effectiveSlides() 가 이 값을 읽어 옛 레슨에
   * 한해서만 맨 앞 영상 슬라이드로 합성해준다. */
  video_url: string | null;
  /** 자유 태그(예: "초2", "P1"). 강제 분류가 아니라 화면 표시·정렬용 힌트일 뿐. */
  level: string | null;
  /** DB 컬럼명은 그대로 playlist(jsonb) 지만, 이제 슬라이드 목록이다. 옛 레슨은
   * LegacyCurriculumStep[] 모양일 수 있어 effectiveSlides() 를 거쳐서 쓴다. */
  playlist: LessonSlide[] | LegacyCurriculumStep[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
