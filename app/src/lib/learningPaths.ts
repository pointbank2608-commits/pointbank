import { supabase } from './supabase';
import type { SoloPublicStep } from './soloLessons';
export interface PathCard { word: string; meaning: string; imageUrl?: string | null; example?: string | null }
export type PathPractice = 'letters' | 'recall';
export interface PathState {
  run_id: string; position: number; goal_index: number; words: number; round: number;
  phase: 'diagnostic' | 'learn' | 'practice' | 'check' | 'delayed_check';
  waiting: boolean; due_at: string | null; finished: boolean; step: SoloPublicStep | null; hint: string | null;
}
export interface PathActionResult { state: PathState; game_correct?: boolean; feedback?: { phase: PathState['phase']; correct: boolean; answer: string | null } }
export interface PathSummary {
  /** Compatibility problems of the server-side wrappers (empty/undefined = intact). */
  protection?: string[];
  plans: { lesson_id: string; name: string; practice: string; words: number; assigned: number; first_completed: number; delayed_checked: number; delayed_correct: number; delayed_planned: number }[];
  recommendations: { assignment_id: string; student_name: string; goal_index: number; card: PathCard; failed_checks: number; delayed_checks: number }[];
}
export async function learningPathRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883' ? 'path_not_ready' : error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export const pathOpen = (token: string, assignment: string) => learningPathRpc<PathState>('learning_path_open', { p_token: token, p_assignment: assignment });
export const pathAct = (token: string, assignment: string, request: string, position: number, action: 'answer' | 'unknown' | 'continue' | 'hint', value: string | null = null) =>
  learningPathRpc<PathActionResult>('learning_path_action', { p_token: token, p_assignment: assignment, p_request: request, p_position: position, p_action: action, p_value: value });
export const pathAssign = (request: string, classId: string, students: string[], title: string, cards: PathCard[], practice: PathPractice) =>
  learningPathRpc<{ lesson_id: string; duplicate: boolean }>('learning_path_assign', { p_request: request, p_class: classId, p_students: students, p_title: title, p_cards: cards, p_practice: practice });
export const pathSummary = (classId: string) => learningPathRpc<PathSummary>('learning_path_teacher_summary', { p_class: classId });
export const pathFeedback = (assignment: string, goal: number, decision: 'assigned' | 'dismissed', request: string, practice: 'recall'|'letters' = 'recall') =>
  learningPathRpc<{ decision: string; lesson_id?: string }>('learning_path_feedback', { p_assignment: assignment, p_goal: goal, p_decision: decision, p_request: request, p_practice: practice });
export const isLearningPath = (steps: readonly unknown[]) => (steps[0] as { path_version?: string } | undefined)?.path_version === 'path-v1';

export function parsePathCards(text: string): PathCard[] {
  const cards = text.split(/\r?\n/).filter(x => x.trim()).map(line => {
    const [word, meaning, ...example] = line.split('|').map(x => x.trim());
    if (!/^[A-Za-z][A-Za-z-]{0,39}$/.test(word || '') || !meaning || meaning.length > 120) throw new Error('bad_card');
    return { word: word.toLowerCase(), meaning, example: example.join(' | ') || null };
  });
  if (cards.length < 1 || cards.length > 12) throw new Error('bad_cards');
  if (new Set(cards.map(c => JSON.stringify([c.word, c.meaning]))).size !== cards.length) throw new Error('duplicate_card');
  return cards;
}
