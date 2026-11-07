import { supabase } from './supabase';
import type { GrammarBlockAction, GrammarBlockFeedback, GrammarBlockStep, GrammarLesson } from './grammarLearningContent';

export type GrammarMode = 'homework' | 'individual';
export type GrammarCatalogItem = Pick<GrammarLesson, 'goalId' | 'version' | 'title' | 'objective' | 'grammarIds'> & { adaptive?: boolean };
export interface GrammarAssignment {
  assignmentId: string;
  title: string;
  mode: GrammarMode;
  status: 'assigned' | 'in_progress' | 'waiting' | 'review_ready' | 'finished';
  initialDueAt: string | null;
  reviewDueAt: string | null;
}
export type GrammarState = {
  assignmentId: string;
  runId: string;
  revision: number;
  adaptive?: boolean;
  state: { kind: 'step'; position: number; step: GrammarBlockStep }
    | { kind: 'feedback'; position: number; feedback: GrammarBlockFeedback }
    | { kind: 'waiting'; dueAt: string }
    | { kind: 'finished'; finishedAt: string };
};
export interface GrammarOutcome {
  assignmentId: string;
  student: string;
  title: string;
  reasoning: boolean | null;
  practice: boolean | null;
  transfer: boolean | null;
  review: string;
  evidence?: {
    diagnosed: number; diagnosed_ok: number;
    practiced: number; practiced_ok: number;
    transferred: number; transferred_ok: number;
    reviewed: number; reviewed_ok: number;
  } | null;
}
export interface GrammarAggregate {
  goalId: string; version: number; mode: GrammarMode; title: string;
  assigned: number; reasoningAnswered: number; reasoningCorrect: number;
  practiceAnswered: number; practiceCorrect: number; transferAnswered: number; transferCorrect: number;
  reviewCorrect: number; reviewWrong: number; reviewMissing: number; reviewWaiting: number;
  reviewUnscheduled: number; excluded: number;
}
export class GrammarRpcError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}
export const grammarNotReady = (error: unknown) => error instanceof GrammarRpcError && ['PGRST202','42883'].includes(error.code ?? '');
async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new GrammarRpcError(error.message, error.code);
  return data as T;
}
export const grammarCatalog = () => rpc<GrammarCatalogItem[]>('grammar_catalog');
export const grammarPreview = (goal: GrammarCatalogItem) => rpc<GrammarLesson>('grammar_preview', { p_goal_id: goal.goalId, p_version: goal.version });
export const grammarAssign = (request: string, classId: string, mode: GrammarMode, goal: GrammarCatalogItem, students: string[], dueAt: string | null) =>
  rpc<{ planId: string }>('grammar_assign', { p_request_id: request, p_class_id: classId, p_student_ids: students,
    p_mode: mode, p_goal_id: goal.goalId, p_version: goal.version, p_initial_due_at: dueAt });
export const grammarList = (token: string) => rpc<GrammarAssignment[]>('grammar_student_list', { p_token: token });
export const grammarOpen = (token: string, assignment: string) =>
  rpc<GrammarState>('grammar_open', { p_token: token, p_assignment_id: assignment });
export const grammarAct = (token: string, assignment: string, request: string, revision: number, action: GrammarBlockAction) =>
  rpc<GrammarState>('grammar_act', { p_token: token, p_assignment_id: assignment, p_request_id: request, p_revision: revision,
    p_action: action.type, p_item_id: action.type === 'answer' ? action.itemId : null, p_option_id: action.type === 'answer' ? action.optionId : null });
export const grammarTeacherSummary = (classId: string, mode: GrammarMode) =>
  rpc<GrammarOutcome[]>('grammar_teacher_summary', { p_class_id: classId, p_mode: mode });
export const grammarAdminSummary = () => rpc<GrammarAggregate[]>('admin_grammar_summary', { p_days: 30 });
