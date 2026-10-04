/**
 * Classbank Student ② 학생 숙제 링크(2026-10-04, `supabase/040_homework.sql`).
 * 선생님: 단어장 → 활동 고르기 → 숙제 번호·링크·QR. 학생: /hw/번호 → 이름 → PIN → 문제(바로 정답 알려 줌).
 * 문제는 대회 퀴즈쇼의 자동 만들기(buildContestQuestions)를 그대로 쓰고, 문제마다 스탯 태그(skill)를 붙여
 * 답과 함께 남긴다 — ③ 학생 스탯 카드의 재료.
 */
import { supabase } from './supabase';
import { buildContestQuestions, type ContestRoundNames } from './liveQuiz';
import type { ContestRoundType, FullCardItem, LiveQuestion } from './types';

/** 숙제에 쓰는 활동(부저는 혼자 하는 숙제에 맞지 않아 뺀다) */
export const HOMEWORK_ROUND_TYPES: ContestRoundType[] = ['choice', 'picture', 'listen', 'text', 'scramble', 'blank', 'ox'];

/** 활동 → 스탯 태그. ③ 스탯 계산이 이 태그로 묶는다(CLAUDE.md "Classbank Student"의 스탯 초안). */
export const ROUND_SKILL: Record<ContestRoundType, string> = {
  choice: 'vocab.meaning',
  ox: 'vocab.meaning',
  picture: 'vocab.picture',
  listen: 'listening.word',
  text: 'vocab.spelling',
  scramble: 'vocab.spelling',
  blank: 'vocab.context',
  buzzer: 'vocab.spelling',
};

export interface HomeworkQuestion extends LiveQuestion {
  skill: string;
  /** 이 문제가 묻는 낱말(스탯·자주 틀리는 낱말에 쓴다) */
  word: string;
}

export interface HomeworkRoundSetting {
  type: ContestRoundType;
  count: number;
  on: boolean;
}

export const DEFAULT_HOMEWORK_ROUNDS: HomeworkRoundSetting[] = HOMEWORK_ROUND_TYPES.map((type) => ({
  type,
  count: 5,
  on: type === 'choice' || type === 'listen' || type === 'text',
}));

export function buildHomeworkQuestions(words: FullCardItem[], names: ContestRoundNames, rounds: HomeworkRoundSetting[]): HomeworkQuestion[] {
  const qs = buildContestQuestions(words, names, rounds);
  return qs.map((q) => {
    const type = q.roundType ?? 'choice';
    const word =
      type === 'choice' ? q.prompt
      : type === 'picture' || type === 'blank' ? (q.choices?.[q.correctIndex ?? 0] ?? '')
      : type === 'listen' ? (q.speak ?? '')
      : type === 'ox' ? (q.prompt.split(/\s*=\s*/)[0] ?? '')
      : (q.answer ?? '');
    return { ...q, skill: ROUND_SKILL[type], word: word.trim() };
  });
}

/** 주관식 채점 — 대소문자·앞뒤 공백·마침표 무시, '/'로 나눈 답 중 하나면 정답 */
export function textIsCorrect(answer: string | undefined, response: string): boolean {
  const n = (s: string) => s.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  return (answer ?? '').split('/').some((a) => n(a) && n(a) === n(response));
}

/* ---------------- 선생님 ---------------- */

export interface HomeworkAssignment {
  id: string;
  academy_id: string;
  class_id: string;
  title: string;
  code: string;
  questions: HomeworkQuestion[];
  word_list_id: string | null;
  settings: { rounds?: HomeworkRoundSetting[] };
  due_at: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface HomeworkAttempt {
  id: string;
  assignment_id: string;
  student_id: string;
  started_at: string;
  last_seen_at: string;
  finished_at: string | null;
  score: number;
  total: number;
}

export interface HomeworkAnswer {
  id: string;
  attempt_id: string;
  q_index: number;
  skill: string;
  word: string;
  correct: boolean;
  response: string | null;
  ms: number | null;
  answered_at: string;
}

export async function createHomework(args: {
  classId: string;
  title: string;
  questions: HomeworkQuestion[];
  wordListId: string | null;
  rounds: HomeworkRoundSetting[];
  dueAt: string | null;
}): Promise<HomeworkAssignment> {
  const { data, error } = await supabase.rpc('hw_create', {
    p_class_id: args.classId,
    p_title: args.title,
    p_questions: args.questions,
    p_word_list_id: args.wordListId,
    p_settings: { rounds: args.rounds },
    p_due_at: args.dueAt,
  });
  if (error) throw error;
  return data as HomeworkAssignment;
}

export async function fetchHomeworks(classId: string): Promise<HomeworkAssignment[]> {
  const { data, error } = await supabase.from('homework_assignments').select('*').eq('class_id', classId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as HomeworkAssignment[];
}

export async function fetchHomeworkAttempts(assignmentIds: string[]): Promise<HomeworkAttempt[]> {
  if (assignmentIds.length === 0) return [];
  const { data, error } = await supabase.from('homework_attempts').select('*').in('assignment_id', assignmentIds);
  if (error) throw error;
  return (data ?? []) as HomeworkAttempt[];
}

export async function fetchHomeworkAnswers(attemptIds: string[]): Promise<HomeworkAnswer[]> {
  if (attemptIds.length === 0) return [];
  const { data, error } = await supabase.from('homework_answers').select('*').in('attempt_id', attemptIds);
  if (error) throw error;
  return (data ?? []) as HomeworkAnswer[];
}

export async function closeHomework(id: string, closed: boolean): Promise<void> {
  const { error } = await supabase.from('homework_assignments').update({ closed_at: closed ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}

export async function deleteHomework(id: string): Promise<void> {
  const { error } = await supabase.from('homework_assignments').delete().eq('id', id);
  if (error) throw error;
}

/** 반 학생 PIN 목록 */
export async function fetchStudentPins(classId: string): Promise<{ id: string; name: string; hw_pin: string | null }[]> {
  const { data, error } = await supabase.from('students').select('id,name,hw_pin').eq('class_id', classId).order('name');
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; hw_pin: string | null }[];
}

export const randomPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');

export async function setStudentPin(studentId: string, pin: string): Promise<void> {
  const { error } = await supabase.from('students').update({ hw_pin: pin }).eq('id', studentId);
  if (error) throw error;
}

export function homeworkUrl(code: string): string {
  return `${window.location.origin}/hw/${code}`;
}

/* ---------------- 학생 ---------------- */

export interface HomeworkOpenInfo {
  title: string;
  class_name: string | null;
  due_at: string | null;
  count: number;
  students: { id: string; name: string; done: boolean }[];
}

export interface HomeworkState {
  title: string;
  name: string;
  questions: HomeworkQuestion[];
  closed: boolean;
  finished: boolean;
  answers: { q_index: number; correct: boolean; response: string | null }[];
}

const tokenKey = (code: string) => `classbank.hw.${code}`;

export function readHomeworkToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

export function forgetHomeworkToken(code: string) {
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    /* 무시 */
  }
}

export async function hwOpen(code: string): Promise<HomeworkOpenInfo> {
  const { data, error } = await supabase.rpc('hw_open', { p_code: code });
  if (error) throw error;
  return data as HomeworkOpenInfo;
}

export async function hwLogin(code: string, studentId: string, pin: string): Promise<string> {
  const { data, error } = await supabase.rpc('hw_login', { p_code: code, p_student_id: studentId, p_pin: pin });
  if (error) throw error;
  const token = (data as { token: string }).token;
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    /* 새로고침하면 다시 PIN 을 넣을 뿐 */
  }
  return token;
}

export async function hwState(token: string): Promise<HomeworkState> {
  const { data, error } = await supabase.rpc('hw_state', { p_token: token });
  if (error) throw error;
  return data as HomeworkState;
}

export async function hwAnswer(token: string, qIndex: number, q: HomeworkQuestion, correct: boolean, response: string, ms: number): Promise<void> {
  const { error } = await supabase.rpc('hw_answer', {
    p_token: token,
    p_q_index: qIndex,
    p_correct: correct,
    p_response: response,
    p_skill: q.skill,
    p_word: q.word,
    p_ms: Math.round(ms),
  });
  if (error) throw error;
}

export async function hwFinish(token: string): Promise<{ score: number; total: number }> {
  const { data, error } = await supabase.rpc('hw_finish', { p_token: token });
  if (error) throw error;
  return data as { score: number; total: number };
}

export function hwErrorKey(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  for (const code of ['not_found', 'wrong_pin', 'locked']) if (msg.includes(code)) return `studentHw.err_${code}`;
  return 'studentHw.err_network';
}
