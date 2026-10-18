import { supabase } from './supabase';
import type { SoloPublicQuestion } from './soloLessons';

export interface GameCheckResponse {
  correct: boolean;
  last_correct: boolean;
  attempts: number;
  answer: string | null;
}
export interface GameCheckState {
  id?: string;
  disabled?: boolean;
  questions: SoloPublicQuestion[];
  responses: Record<string, GameCheckResponse>;
}
export interface GameCheckAnswer {
  correct: boolean;
  answer: string | null;
  first: boolean;
}
export interface GameCheckSummary {
  right: number;
  total: number;
  missed: string[];
}
export interface GameGrowth {
  checked: number;
  remembered: number;
  transferred: number;
  measured: number;
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export const openGameCheck = (
  token: string,
  assignment: string,
  step: number,
) =>
  rpc<GameCheckState>('solo_game_check_open', {
    p_token: token,
    p_assignment: assignment,
    p_step: step,
  });
export const answerGameCheck = (
  token: string,
  assignment: string,
  step: number,
  question: number,
  value: string,
  request: string,
) =>
  rpc<GameCheckAnswer>('solo_game_check_answer', {
    p_token: token,
    p_assignment: assignment,
    p_step: step,
    p_question: question,
    p_value: value,
    p_request: request,
  });
export const startPersonalGame = (token: string, before?: string) =>
  rpc<{ assignment?: string; empty?: boolean }>('solo_start_personal_game', {
    p_token: token,
    p_before: before ?? null,
  });
export const fetchGameGrowth = (student: string, days: number) =>
  rpc<GameGrowth>('student_game_growth', { p_student: student, p_days: days });
export const fetchGameLessonResults = (lesson: string) =>
  rpc<
    {
      assignment_id: string;
      right_count: number;
      wrong_count: number;
      missed_words: string[];
    }[]
  >('solo_game_results', { p_lesson: lesson });
export const isGameLearningUnavailable = (err: unknown) => {
  const e = err as { code?: string; message?: string };
  return (
    e.code === 'PGRST202' ||
    e.code === '42883' ||
    /Could not find the function/.test(e.message || '')
  );
};
