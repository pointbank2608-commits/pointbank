/**
 * 단어암기숙제(2026-10-26, `supabase/090a~m`) — 서버(wm_*)와 주고받는 모양.
 * 한 번 배정하면 여러 날에 걸쳐 같은 단어를 간격을 두고 다시 만나게 한다. 문제·정답·일정은 서버가 만들고, 학생 화면에는 정답이 가지 않는다.
 */
import type { HwQStyle, HwQType } from '../homework/types';

/** 배정 시점의 단어 스냅샷(원본 단어장을 고쳐도 그대로) */
export interface WmCard {
  word: string;
  meaning: string;
  pos?: string | null;
  imageUrl?: string | null;
  example?: string | null;
}

export type WmDailyMode = 'light' | 'normal';

/** 낱말 상태: 아직 안 만남 → 처음 만남 → 연습 중 → 혼자 맞힘 → 며칠 뒤에도 기억함 */
export type WmWordState = 'unseen' | 'seen' | 'practicing' | 'alone' | 'kept';
export const WM_STATES: WmWordState[] = ['unseen', 'seen', 'practicing', 'alone', 'kept'];

export interface WmStageCounts {
  unseen: number;
  seen: number;
  practicing: number;
  alone: number;
  kept: number;
  total: number;
}

export interface WmAssignInput {
  requestId: string;
  classId: string;
  title: string;
  cards: WmCard[];
  source: { type: string; id?: string; name?: string };
  studentIds: string[];
  mode: WmDailyMode;
  studyDays: number;
  reviewDays: number;
}

export interface WmAssignResult {
  plan_id: string | null;
  duplicate: boolean;
  created: number;
  skipped: string[];
  total: number;
  words: number;
}

/** 학생에게 가는 문제 한 칸(정답·낱말 열쇠 없음). 풀었으면 결과만 */
export interface WmItem {
  i: number;
  kind: 'study' | 'ask';
  phase: 'review' | 'hard' | 'new';
  state: 'todo' | 'done';
  retry?: boolean;
  correct?: boolean | null;
  // 소개 카드
  word?: string;
  meaning?: string;
  pos?: string;
  imageUrl?: string;
  example?: string;
  speak?: string;
  // 문제
  qtype?: HwQType;
  style?: HwQStyle;
  prompt?: string;
  sub?: string;
  choices?: string[];
  tokens?: string[];
  joiner?: string;
  help?: boolean;
  elim?: number[];
  hint?: string;
}

export interface WmToday {
  ended?: boolean;
  session_id: string;
  day: string;
  done: boolean;
  counts: { review: number; hard: number; new: number; asks: number };
  retry_left: number;
  items: WmItem[];
  waiting_review: number;
  next_due: string | null;
  unseen: number;
  stages: WmStageCounts;
}

export interface WmOpen {
  title: string;
  student_name: string;
  daily_mode: WmDailyMode;
  day_index: number;
  study_days: number;
  review_days: number;
  phase: 'study' | 'review' | 'ended';
  stages: WmStageCounts;
  rule_version: string;
}

export interface WmAnswerResult {
  correct: boolean;
  answer: string | null;
  first: boolean;
  requeued: boolean;
  helped?: boolean;
  example?: string | null;
  done: boolean;
}

export interface WmHint {
  type: 'eliminate' | 'letters' | 'first' | 'none';
  index?: number;
  text?: string;
}

export interface WmCollectionWord {
  state: WmWordState;
  word?: string;
  meaning?: string;
  imageUrl?: string;
  pos?: string;
  relearning?: boolean;
  carried?: boolean;
  days?: number;
}

export interface WmPlanSummary {
  id: string;
  title: string;
  source: { type?: string; name?: string };
  words: number;
  daily_mode: WmDailyMode;
  start_date: string;
  study_days: number;
  review_days: number;
  closed: boolean;
  ended: boolean;
  day_index: number;
  students: number;
  today_done: number;
  created_at: string;
}

export interface WmStudentResult {
  student_id: string;
  name: string;
  today: 'done' | 'started' | 'not_started' | 'nothing';
  last_active: string | null;
  stages: WmStageCounts;
  met: number;
  alone_words: number;
  kept_words: number;
  hard_words: number;
  skill_miss: Record<string, number>;
  days_active: number;
}

export interface WmPlanResults {
  plan: { id: string; title: string; words: number; daily_mode: WmDailyMode; start_date: string; study_days: number; review_days: number; rule_version: string; closed: boolean };
  students: WmStudentResult[];
}

export type WmErrorKind = 'not_found' | 'closed' | 'feature_closed' | 'stale' | 'network' | 'too_few_words' | 'bad_student' | 'no_students' | 'unknown';
