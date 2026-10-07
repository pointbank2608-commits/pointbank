import { supabase } from './supabase';

/**
 * 학생 포털(Classbank Student) — 학원 코드 + 이름 + 학부모 전화번호로 로그인하고, 이 기기에 열쇠를 기억한다.
 * 이메일 계정(Supabase Auth)을 쓰지 않는다. 서버 함수는 supabase/045_student_portal.sql.
 */
const TOKEN_KEY = 'classbank.studentToken';
const CODE_KEY = 'classbank.studentCode';

export type PortalErrorKind = 'bad_login' | 'locked' | 'expired' | 'network' | 'unknown';

export class PortalError extends Error {
  kind: PortalErrorKind;
  constructor(kind: PortalErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

export interface PortalHomework {
  title: string;
  due_at: string | null;
  access: string;
  done: boolean;
}

export interface PortalLesson {
  id: string;
  name: string;
  minutes: number;
  progress: number;
  total: number;
  done: boolean;
  due_at: string | null;
}

export interface PortalHome {
  name: string;
  lessons: PortalLesson[];
  academy: string;
  class_name: string;
  homework: PortalHomework[];
}

function toError(err: unknown): PortalError {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new PortalError('network');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return new PortalError('network');
  for (const k of ['bad_login', 'locked', 'expired'] as const) if (msg.includes(k)) return new PortalError(k);
  return new PortalError('unknown');
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

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 저장이 막힌 브라우저면 이번 방문에서만 쓴다 */
  }
}

/** 학원 코드가 미리 적힌 학생 주소 — 학생이 코드를 따로 치지 않게 한다 */
export function studentLink(code: string): string {
  return `${window.location.origin}/s?c=${encodeURIComponent(code)}`;
}

/** 주소의 ?c=코드(6자리 영문·숫자) */
export function codeFromUrl(): string {
  const c = new URLSearchParams(window.location.search).get('c') ?? '';
  const clean = c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.length === 6 ? clean : '';
}

export const savedToken = () => read(TOKEN_KEY);
export const savedCode = () => read(CODE_KEY) ?? '';

export async function studentLogin(code: string, name: string, phone: string): Promise<string> {
  const r = await rpc<{ token: string }>('student_login', {
    p_code: code.trim().toUpperCase(),
    p_name: name.trim(),
    p_phone: phone,
    p_device: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : null,
  });
  write(TOKEN_KEY, r.token);
  write(CODE_KEY, code.trim().toUpperCase());
  return r.token;
}

export async function studentHome(token: string): Promise<PortalHome> {
  return rpc<PortalHome>('student_home', { p_token: token });
}

export async function studentLogout(token: string): Promise<void> {
  try {
    await supabase.rpc('student_logout', { p_token: token });
  } finally {
    write(TOKEN_KEY, null);
  }
}

export function forgetStudentToken() {
  write(TOKEN_KEY, null);
}

/** 전화번호 입력 보기 좋게: 010-1234-5678 */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}

/* ---------------- 원장·선생님 쪽: 학원 학생 코드, 학부모 번호 등록 ---------------- */

export interface GuardianStatus {
  student_id: string;
  last4: string;
  consent_at: string;
}

export async function fetchStudentCode(): Promise<string> {
  const { data, error } = await supabase.rpc('academy_student_code');
  if (error) throw new Error(error.message);
  return data as string;
}

export async function resetStudentCode(): Promise<string> {
  const { data, error } = await supabase.rpc('academy_student_code_reset');
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchGuardianStatus(): Promise<GuardianStatus[]> {
  const { data, error } = await supabase.rpc('student_guardian_status');
  if (error) throw new Error(error.message);
  return (data ?? []) as GuardianStatus[];
}

export async function saveGuardianPhone(studentId: string, phone: string, consent: boolean): Promise<void> {
  const { error } = await supabase.rpc('student_guardian_set', { p_student: studentId, p_phone: phone, p_consent: consent });
  if (error) throw new Error(error.message);
}

export async function revealGuardianPhone(studentId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('student_guardian_reveal', { p_student: studentId });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function clearGuardianPhone(studentId: string): Promise<void> {
  const { error } = await supabase.rpc('student_guardian_clear', { p_student: studentId });
  if (error) throw new Error(error.message);
}
