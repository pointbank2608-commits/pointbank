/**
 * Classbank Student 숙제 — 선생님 쪽 서버 호출(2026-10-05 2단계, `supabase/041_homework_v2.sql`).
 * 학생 쪽은 `lib/homework/studentApi.ts`, 문제 만들기는 `lib/homework/build.ts`, 추천은 `lib/homework/recommend.ts`.
 * 집계(완료 수·평균·학습 카드)는 서버 함수가 계산한다 — 답 전체를 브라우저로 가져오지 않는다.
 */
import { supabase } from './supabase';
import type { HwItemDraft } from './homework/types';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export interface HomeworkOverviewRow {
  id: string;
  title: string;
  code: string;
  kind: 'class' | 'selected' | 'custom';
  group_id: string | null;
  due_at: string | null;
  closed_at: string | null;
  created_at: string;
  target_count: number;
  done: number;
  doing: number;
  avg_pct: number | null;
  kinds: string[] | null;
  question_count: number;
  custom_student: string | null;
}

export interface HomeworkSummary {
  target_count: number;
  items: { id: string; kind: string; title: string; count: number }[];
  students: {
    student_id: string;
    name: string;
    archived: boolean;
    status: 'none' | 'doing' | 'done';
    answered: number;
    correct: number;
    minutes: number | null;
    retries: number;
    /** 042: 이 숙제로 포인트를 받았나(042 전에는 없음) */
    rewarded?: boolean;
    wrong_words: string[];
  }[];
  class_wrong_words: { word: string; count: number; card: Record<string, unknown> | null }[];
}

export interface PersonalLink {
  student_id: string;
  name: string;
  access: string;
  has_pin: boolean;
}

export interface LearningCard {
  student: { id: string; name: string; archived: boolean };
  days: number;
  graded: number;
  completed_activities: number;
  skills: { skill: string; n: number; correct: number; weighted: number | null; prev_n: number; prev_correct: number }[];
  habit: { assigned: number; finished: number; prev_assigned: number; prev_finished: number };
  retries: { count: number; corrected: number };
  shadowing: { lines: number; listens: number };
  wrong_words: { word: string; count: number; skills: string[] }[];
  recent: { id: string; title: string; created_at: string; kind: string; status: 'none' | 'doing' | 'done'; score: number | null; total: number | null }[];
  passbook_homework: { done: number; missing: number };
}

export interface CreateHomeworkArgs {
  classId: string;
  title: string;
  items: HwItemDraft[];
  studentIds: string[] | null;
  dueAt: string | null;
  kind: 'class' | 'selected' | 'custom';
  groupId?: string | null;
  recommendation?: Record<string, unknown> | null;
}

export async function createHomework(a: CreateHomeworkArgs): Promise<{ id: string; code: string }> {
  return rpc('hw_create_v2', {
    p_class_id: a.classId,
    p_title: a.title,
    p_items: a.items,
    p_student_ids: a.studentIds,
    p_due_at: a.dueAt,
    p_kind: a.kind,
    p_group_id: a.groupId ?? null,
    p_recommendation: a.recommendation ?? null,
  });
}

export const fetchHomeworkOverview = (classId: string) => rpc<HomeworkOverviewRow[]>('hw_class_overview', { p_class_id: classId });
export const fetchHomeworkSummary = (assignmentId: string) => rpc<HomeworkSummary>('hw_assignment_summary', { p_assignment_id: assignmentId });
export const fetchPersonalLinks = (assignmentId: string) => rpc<PersonalLink[]>('hw_personal_links', { p_assignment_id: assignmentId });
/** 새 PIN — 이 순간에만 원문을 알 수 있다(서버엔 해시만) */
export const resetStudentPin = (studentId: string) => rpc<string>('hw_reset_pin', { p_student_id: studentId });
/** 반 학생의 PIN 있음/없음(원문·해시는 오지 않는다) */
export const fetchPinStatus = (classId: string) => rpc<{ student_id: string; name: string; has_pin: boolean; updated_at: string | null }[]>('hw_pin_status', { p_class_id: classId });
/** 숙제를 끝낸 학생에게 통장 프리셋 지급(042). 같은 숙제로 두 번 주지 않고, 그날 반 통장이 마감됐으면 locked */
export const rewardHomework = (assignmentId: string, presetId: string, studentIds: string[], today: string) =>
  rpc<{ given: number; locked: boolean }>('hw_reward', { p_assignment_id: assignmentId, p_preset_id: presetId, p_student_ids: studentIds, p_today: today });

export interface ReportExtras {
  class_name: string | null;
  attended_days: number;
  points_earned: number;
  online_finished: number;
}
/** 학부모 리포트용 기간 숫자(042) */
export const fetchReportExtras = (studentId: string, days: 30 | 90) => rpc<ReportExtras>('student_report_extras', { p_student_id: studentId, p_days: days });

export const fetchLearningCard = (studentId: string, days: 30 | 90) => rpc<LearningCard>('student_learning_card', { p_student_id: studentId, p_days: days });
export const fetchReviewCandidates = (studentId: string) => rpc<import('./homework/recommend').ReviewCandidates>('student_review_candidates', { p_student_id: studentId });
/** 다음 단계 학생 좌석 요금용 사용량(지금은 계산만 — 결제·제한 없음) */
export const fetchHomeworkUsage = (from: Date, to: Date) => rpc<{ active_students: number }>('academy_homework_usage', { p_from: from.toISOString(), p_to: to.toISOString() });

export async function closeHomework(id: string, closed: boolean): Promise<void> {
  const { error } = await supabase.from('homework_assignments').update({ closed_at: closed ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}

export async function deleteHomework(id: string): Promise<void> {
  const { error } = await supabase.from('homework_assignments').delete().eq('id', id);
  if (error) throw error;
}

/** 숙제의 활동 내용(선생님 미리보기 — 정답 포함, RLS 로 자기 학원 것만) */
export async function fetchHomeworkItems(assignmentId: string): Promise<HwItemDraft[]> {
  const { data, error } = await supabase.from('homework_items').select('kind,title,config,content').eq('assignment_id', assignmentId).order('position');
  if (error) throw error;
  return (data ?? []) as HwItemDraft[];
}

export const homeworkUrl = (code: string) => `${window.location.origin}/hw/${code}`;
export const personalHomeworkUrl = (access: string) => `${window.location.origin}/hw/p/${access}`;

/** 서버 오류 → 화면 문구 키 */
export function teacherErrorKey(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/homework_items|hw_create_v2|hw_reward|student_report_extras|function .* does not exist|Could not find the function|schema cache|PGRST202|student_learning_card|relation/i.test(msg)) return 'studentHw.needSetup';
  if (msg.includes('no_students')) return 'studentHw.errNoStudents';
  if (msg.includes('no_items')) return 'studentHw.errNoItems';
  return 'studentHw.errGeneric';
}
