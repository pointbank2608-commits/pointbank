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
  | 'rankorder';

export interface GameItem {
  id: string;
  label: string;
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
   * 매치업 전용: 단어+뜻 짝 목록. 역시 공용 items 모델(단일 라벨)로는 "짝"을 표현할 수
   * 없어 별도로 둔다 — 다른 게임으로 열기 대상에서 자연히 제외된다.
   */
  pairs?: MatchPair[];
  /**
   * 답 입력하기 전용: 질문(또는 빈칸 있는 문장)+정답 목록. 워드월의 "답을 입력합니다"와
   * "문장 완성"은 둘 다 "프롬프트 보여주고 텍스트로 답 입력받기"라는 같은 상호작용이라
   * 하나의 게임에 모드 옵션(typeAnswerMode)으로 합쳤다.
   */
  typeAnswerEntries?: TypeAnswerEntry[];
  /** 답 입력하기 전용: 'question'(질문에 답하기) 또는 'cloze'(빈칸 채우기 — 프롬프트에 ___ 포함). 기본 'question'. */
  typeAnswerMode?: 'question' | 'cloze';
  /** 단어 철자 전용: 단어를 보여주는 시간(초). 기본 3. */
  spellPreviewSeconds?: number;
  /** 그룹 정렬 전용: 그룹(이름+소속 항목) 목록. 항목이 어느 그룹인지가 곧 정답이라 공용 items 모델로는 표현이 안 돼 별도로 둔다. */
  groups?: GroupSortGroup[];
  /** 플래시카드 전용: 카드 앞(left)/뒤(right) 목록. 매치업의 MatchPair 모양을 그대로 재사용한다. */
  flashcards?: MatchPair[];
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

/** Save it or Give it 상자 결과 하나. kind:'points' 면 value 만큼 점수 증감, kind:'swap' 이면 두 팀 점수를 서로 바꾼다. */
export interface SaveOrGiveReward {
  kind: 'points' | 'swap';
  value?: number;
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
