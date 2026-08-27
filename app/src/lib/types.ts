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

export type GameType = 'wheel' | 'ladder' | 'order';

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
  /** 재생할 배경음악. 없으면 무음. */
  music?: MusicSelection | null;
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
