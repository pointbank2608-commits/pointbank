import { supabase } from './supabase';
import type { SoloPublicStep, SoloStep } from './soloLessons';

/** 개별수업 서버 연동(047_solo_lessons.sql) — 선생님 쪽(RLS·함수)과 학생 쪽(기기 열쇠 함수). */

export interface SoloLesson {
  id: string;
  academy_id: string;
  class_id: string | null;
  name: string;
  level: string | null;
  minutes: number;
  steps: SoloStep[];
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoloStatusRow {
  assignment_id: string;
  student_id: string;
  name: string;
  progress: number;
  total: number;
  started_at: string | null;
  finished_at: string | null;
  due_at: string | null;
  right_count: number;
  wrong_count: number;
  unsure_count: number;
  unsure_steps: number[];
}

/* ---------------- 선생님 ---------------- */

export async function fetchSoloLessons(academyId: string, classId: string): Promise<SoloLesson[]> {
  const { data, error } = await supabase
    .from('solo_lessons')
    .select('*')
    .eq('academy_id', academyId)
    .or(`class_id.eq.${classId},class_id.is.null`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoloLesson[];
}

export async function createSoloLesson(params: {
  academyId: string;
  classId: string | null;
  name: string;
  level: string | null;
  minutes: number;
  steps: SoloStep[];
  source: string | null;
}): Promise<SoloLesson> {
  const { data, error } = await supabase
    .from('solo_lessons')
    .insert({
      academy_id: params.academyId,
      class_id: params.classId,
      name: params.name,
      level: params.level,
      minutes: params.minutes,
      steps: params.steps,
      source: params.source,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SoloLesson;
}

export async function renameSoloLesson(id: string, name: string) {
  const { error } = await supabase.from('solo_lessons').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSoloLesson(id: string) {
  const { error } = await supabase.from('solo_lessons').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function assignSoloLesson(lessonId: string, studentIds: string[], dueAt: string | null): Promise<number> {
  const { data, error } = await supabase.rpc('solo_assign', { p_lesson: lessonId, p_students: studentIds, p_due: dueAt });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function fetchSoloStatus(lessonId: string): Promise<SoloStatusRow[]> {
  const { data, error } = await supabase.rpc('solo_status', { p_lesson: lessonId });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoloStatusRow[];
}

/** 이 반 학생들에게 낸 수업 수(목록 배지용) */
export async function fetchSoloAssignmentCounts(lessonIds: string[]): Promise<Map<string, { total: number; done: number }>> {
  const map = new Map<string, { total: number; done: number }>();
  if (lessonIds.length === 0) return map;
  const { data, error } = await supabase.from('solo_assignments').select('lesson_id, finished_at').in('lesson_id', lessonIds);
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as { lesson_id: string; finished_at: string | null }[]) {
    const c = map.get(r.lesson_id) ?? { total: 0, done: 0 };
    c.total += 1;
    if (r.finished_at) c.done += 1;
    map.set(r.lesson_id, c);
  }
  return map;
}

/* ---------------- 학생(기기 열쇠) ---------------- */

export interface SoloOpenResult {
  name: string;
  can_record?: boolean;
  progress: number;
  done: boolean;
  steps: SoloPublicStep[];
}

export type SoloStudentError = 'expired' | 'not_found' | 'network' | 'unknown';

export class SoloError extends Error {
  kind: SoloStudentError;
  constructor(kind: SoloStudentError) {
    super(kind);
    this.kind = kind;
  }
}

function toError(err: unknown): SoloError {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new SoloError('network');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return new SoloError('network');
  if (msg.includes('expired')) return new SoloError('expired');
  if (msg.includes('not_found')) return new SoloError('not_found');
  return new SoloError('unknown');
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let res;
  try {
    res = await supabase.rpc(fn, args);
  } catch (e) {
    throw toError(e);
  }
  if (res.error) throw toError(res.error);
  const data = res.data as T & { error?: string };
  if (data && typeof data === 'object' && 'error' in data && data.error) throw toError(data.error);
  return data;
}

export const soloOpen = (token: string, assignment: string) => rpc<SoloOpenResult>('solo_open', { p_token: token, p_assignment: assignment });

export async function soloAnswer(token: string, assignment: string, step: number, value: string): Promise<boolean> {
  const r = await rpc<{ correct: boolean }>('solo_answer', { p_token: token, p_assignment: assignment, p_step: step, p_value: value });
  return !!r.correct;
}

export const soloAdvance = (token: string, assignment: string, step: number, unsure: boolean) =>
  rpc<{ answer: string | null; done: boolean }>('solo_advance', { p_token: token, p_assignment: assignment, p_step: step, p_unsure: unsure });

export async function soloReveal(token: string, assignment: string, step: number): Promise<string | null> {
  const r = await rpc<{ answer: string | null }>('solo_reveal', { p_token: token, p_assignment: assignment, p_step: step });
  return r.answer ?? null;
}

/* ---------------- 녹음 보관·학부모 공유(051) ---------------- */

/** Blob → base64(앞의 data: 머리 없이) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(blob);
  });
}

export function base64ToBlobUrl(b64: string, mime: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'audio/webm' }));
}

/** 학생: 따라 부른 녹음 보내기(보호자 동의가 없으면 서버가 거절) */
export async function soloRecordSave(token: string, assignment: string, step: number, blob: Blob, seconds: number, sub = 0): Promise<boolean> {
  try {
    const b64 = await blobToBase64(blob);
    const r = await rpc<{ ok?: boolean }>('solo_record_save', {
      p_token: token,
      p_assignment: assignment,
      p_step: step,
      p_mime: blob.type || 'audio/webm',
      p_b64: b64,
      p_seconds: seconds,
      // 052 를 아직 안 돌린 서버(이 칸이 없는 함수)에서도 노래 녹음이 되도록, 번호가 있을 때만 보낸다
      ...(sub > 0 ? { p_sub: sub } : {}),
    });
    return !!r.ok;
  } catch {
    return false;
  }
}

export interface SoloRecordingMeta {
  id: string;
  step: number;
  sub?: number;
  seconds: number | null;
  created_at: string;
}

export async function fetchSoloRecordings(assignmentId: string): Promise<SoloRecordingMeta[]> {
  const { data, error } = await supabase.rpc('solo_record_list', { p_assignment: assignmentId });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoloRecordingMeta[];
}

export async function fetchSoloRecordingAudio(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('solo_record_get', { p_recording: id });
  if (error) throw new Error(error.message);
  const r = data as { mime: string; b64: string };
  return base64ToBlobUrl(r.b64, r.mime);
}

export type ShareNameMode = 'full' | 'given' | 'hidden';

export interface SoloShareRow {
  token: string;
  name_mode: ShareNameMode;
  created_at: string;
  expires_at: string;
  revoked: boolean;
}

export async function createSoloShare(assignmentId: string, nameMode: ShareNameMode, days: number): Promise<string> {
  const { data, error } = await supabase.rpc('solo_share_create', { p_assignment: assignmentId, p_name_mode: nameMode, p_days: days });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function revokeSoloShare(token: string) {
  const { error } = await supabase.rpc('solo_share_revoke', { p_token: token });
  if (error) throw new Error(error.message);
}

export async function fetchSoloShares(assignmentId: string): Promise<SoloShareRow[]> {
  const { data, error } = await supabase.rpc('solo_share_list', { p_assignment: assignmentId });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoloShareRow[];
}

export async function setRecordConsent(studentId: string, on: boolean) {
  const { error } = await supabase.rpc('student_record_consent_set', { p_student: studentId, p_on: on });
  if (error) throw new Error(error.message);
}

export interface SharedRecording {
  academy: string | null;
  lesson: string;
  student: string | null;
  expires_at: string;
  items: {
    step: number;
    seconds: number | null;
    mime: string;
    b64: string;
    line: { en: string | null; ko: string | null; videoId: string | null; start: number | null; end: number | null } | null;
  }[];
}

/** 학부모(로그인 없음): 링크로 녹음 보기 */
export async function fetchSharedRecording(token: string): Promise<SharedRecording | null> {
  const { data, error } = await supabase.rpc('solo_share_get', { p_token: token });
  if (error) throw new Error(error.message);
  const r = data as (SharedRecording & { error?: string }) | null;
  if (!r || r.error) return null;
  return r;
}
