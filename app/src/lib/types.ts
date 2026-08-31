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

export type GameType = 'wheel' | 'ladder' | 'order' | 'bomb' | 'timer' | 'tictactoe' | 'saveorgive' | 'findmissing';

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
  /** 게임 플레이 영역 비주얼 테마. 없으면 기본 색상 그대로. */
  theme?: 'space' | 'jungle' | 'candy';
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
