/**
 * 학생 숙제 서버 호출(로그인 없음 — 숙제 열쇠 하나로). 답·진행 기록은 보내기 전에 이 기기에 먼저 적어 두고(대기열),
 * 인터넷이 끊기면 다시 연결됐을 때 같은 client_id 로 다시 보낸다 — 서버가 client_id 로 한 번만 남긴다.
 * 학생 이름·id 는 URL·저장소에 남기지 않는다(열쇠만).
 */
import { supabase } from '../supabase';
import type { HwErrorKind, HwOpenInfo, HwStudentState, HwSubmitResult } from './types';

const tokenKey = (code: string) => `classbank.hw.${code}`;
const queueKey = (token: string) => `classbank.hwq.${token}`;

export function readToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}
export function saveToken(code: string, token: string) {
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    /* 새로고침하면 다시 들어오면 된다 */
  }
}
export function forgetToken(code: string) {
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    /* 무시 */
  }
}

export class HwError extends Error {
  kind: HwErrorKind;
  constructor(kind: HwErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

function toError(err: unknown): HwError {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new HwError('network');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return new HwError('network');
  for (const k of ['not_found', 'closed', 'past_due', 'bad_login', 'locked', 'incomplete'] as const) if (msg.includes(k)) return new HwError(k);
  return new HwError('unknown');
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

export const hwOpen = (code: string) => rpc<HwOpenInfo>('hw_open', { p_code: code });

export async function hwLoginName(code: string, name: string, pin: string): Promise<string> {
  const r = await rpc<{ token: string }>('hw_login_name', { p_code: code, p_name: name, p_pin: pin });
  saveToken(code, r.token);
  return r.token;
}

/** 개인 링크(QR) — 열쇠와 숙제 번호를 돌려준다 */
export async function hwOpenPersonal(access: string): Promise<{ token: string; code: string }> {
  const r = await rpc<{ token: string; code: string }>('hw_open_personal', { p_access: access });
  saveToken(r.code, r.token);
  return r;
}

export const hwState = (token: string) => rpc<HwStudentState>('hw_state', { p_token: token });

/* ---------- 대기열 ---------- */

export type QueuedOp =
  | { op: 'submit'; clientId: string; itemId: string; qIndex: number; response: string; ms: number }
  | { op: 'progress'; clientId: string; itemId: string; event: 'shadow_line' | 'item_complete'; meta: Record<string, unknown> };

function readQueue(token: string): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(token)) ?? '[]') as QueuedOp[];
  } catch {
    return [];
  }
}
function writeQueue(token: string, q: QueuedOp[]) {
  try {
    if (q.length) localStorage.setItem(queueKey(token), JSON.stringify(q));
    else localStorage.removeItem(queueKey(token));
  } catch {
    /* 저장소가 막힌 기기 — 메모리에서만 재시도 */
  }
}

async function send(token: string, op: QueuedOp): Promise<HwSubmitResult | null> {
  if (op.op === 'submit')
    return rpc<HwSubmitResult>('hw_submit', { p_token: token, p_item_id: op.itemId, p_q_index: op.qIndex, p_response: op.response, p_client_id: op.clientId, p_ms: Math.round(op.ms) });
  await rpc('hw_progress', { p_token: token, p_item_id: op.itemId, p_event: op.event, p_meta: op.meta, p_client_id: op.clientId });
  return null;
}

/** 대기열에 넣고 바로 보내 본다. 인터넷 문제면 'queued'(나중에 다시), 숙제가 닫혔으면 오류를 던진다. */
export async function enqueue(token: string, op: QueuedOp): Promise<HwSubmitResult | null | 'queued'> {
  writeQueue(token, [...readQueue(token), op]);
  // 앞에 밀린 것부터
  const flushed = await flush(token);
  if (!flushed.ok) {
    if (flushed.error && flushed.error.kind !== 'network') throw flushed.error;
    return 'queued';
  }
  return flushed.results.get(op.clientId) ?? null;
}

export async function flush(token: string): Promise<{ ok: boolean; results: Map<string, HwSubmitResult | null>; error?: HwError }> {
  const results = new Map<string, HwSubmitResult | null>();
  let q = readQueue(token);
  while (q.length) {
    try {
      results.set(q[0].clientId, await send(token, q[0]));
    } catch (e) {
      const err = e instanceof HwError ? e : toError(e);
      // 진행 기록이 아직 못 끝난 활동이면(incomplete) 그 기록만 버린다 — 학생이 다시 끝내면 된다
      if (err.kind === 'incomplete') {
        q = q.slice(1);
        writeQueue(token, q);
        continue;
      }
      return { ok: false, results, error: err };
    }
    q = q.slice(1);
    writeQueue(token, q);
  }
  return { ok: true, results };
}

export const pendingCount = (token: string) => readQueue(token).length;
/** 아직 못 보낸 답(이어 풀기 때 "이미 낸 답"으로 친다) */
export const pendingOps = (token: string) => readQueue(token);

export async function hwFinish(token: string): Promise<{ score: number; total: number }> {
  const f = await flush(token);
  if (!f.ok) throw f.error ?? new HwError('network');
  return rpc<{ score: number; total: number }>('hw_finish', { p_token: token });
}
