import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * 선생님 폰 리모컨(2026-10-14, 1단계) — 칠판(노트북·태블릿·전자칠판) 화면과 선생님 폰이 같은 계정으로 주고받는다.
 * `remote_sessions` 한 줄(supabase/077)에 칠판이 state(지금 슬라이드·정답 등)를, 폰이 cmd(다음·이전 …)를 쓴다.
 * RLS 가 user_id = auth.uid() 라서 다른 사람은 읽지도 쓰지도 못한다. 실시간 변경을 받고, 못 받아도 2.5초마다 확인한다.
 */

export interface RemoteStep {
  label: string;
  kind: string;
  icon: string;
}

/** 칠판에는 안 보이고 선생님 폰에만 보이는 정보(예: 단서 네 개의 정답) */
export interface RemoteSecret {
  title: string;
  text: string;
  sub?: string;
}

/** 게임이 폰에 띄워 달라고 하는 버튼(맞았어요·아니에요·다음 …) — 2단계 */
export interface RemoteAction {
  id: string;
  label: string;
  tone: 'good' | 'bad' | 'primary' | 'neutral' | 'team';
  /** tone 이 team 일 때 팀 색 */
  color?: string;
}

export interface RemoteState {
  lessonName: string;
  stepIndex: number;
  steps: RemoteStep[];
  secret: RemoteSecret | null;
  /** 지금 화면(게임)의 판정·진행 버튼 */
  actions: RemoteAction[];
  /** 포인트 주기에 쓸 반 */
  classId: string | null;
  ended: boolean;
  at: number;
}

export type RemoteCmdName = 'next' | 'prev' | 'goto' | 'exit' | 'action';

export interface RemoteCmd {
  seq: number;
  name: RemoteCmdName;
  arg?: number;
  /** name 이 action 일 때 누른 버튼 */
  id?: string;
}

export interface RemoteRow {
  id: string;
  state: Partial<RemoteState>;
  cmd: Partial<RemoteCmd>;
}

export const REMOTE_STORAGE_KEY = 'classbank.remoteSession';

export function remoteUrl(id: string): string {
  return `${window.location.origin}/remote/${id}`;
}

export async function createRemoteSession(): Promise<string> {
  // 하루 지난 연결은 정리한다(실패해도 상관없음)
  void supabase.from('remote_sessions').delete().lt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  const { data, error } = await supabase.from('remote_sessions').insert({}).select('id').single();
  if (error || !data) throw error ?? new Error('remote session');
  return data.id as string;
}

export async function deleteRemoteSession(id: string): Promise<void> {
  await supabase.from('remote_sessions').delete().eq('id', id);
}

export async function fetchRemoteSession(id: string): Promise<RemoteRow | null> {
  const { data, error } = await supabase.from('remote_sessions').select('id, state, cmd').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as RemoteRow;
}

export async function publishRemoteState(id: string, state: RemoteState): Promise<void> {
  await supabase.from('remote_sessions').update({ state, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function sendRemoteCmd(id: string, name: RemoteCmdName, arg?: number, actionId?: string): Promise<void> {
  const cmd: RemoteCmd = { seq: Date.now(), name, ...(arg !== undefined ? { arg } : {}), ...(actionId ? { id: actionId } : {}) };
  await supabase.from('remote_sessions').update({ cmd, updated_at: new Date().toISOString() }).eq('id', id);
}

/** 연결 줄이 바뀌면 알려 준다 — 실시간 + 2.5초 확인. 돌려주는 함수를 부르면 끝낸다. */
export function subscribeRemote(id: string, onRow: (row: RemoteRow) => void, onGone?: () => void): () => void {
  let alive = true;
  const channel = supabase
    .channel(`remote-${id}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'remote_sessions', filter: `id=eq.${id}` }, (p) => {
      if (alive && p.new) onRow(p.new as RemoteRow);
    })
    .subscribe();
  const poll = window.setInterval(() => {
    void fetchRemoteSession(id).then((row) => {
      if (!alive) return;
      if (row) onRow(row);
      else onGone?.();
    });
  }, 2500);
  return () => {
    alive = false;
    window.clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}

/* ---------------- 선생님 폰에만 보일 정보(게임이 알려 준다) ---------------- */

let currentSecret: RemoteSecret | null = null;
const listeners = new Set<() => void>();

export function setRemoteSecret(s: RemoteSecret | null): void {
  currentSecret = s;
  listeners.forEach((l) => l());
}

export function getRemoteSecret(): RemoteSecret | null {
  return currentSecret;
}

export function subscribeRemoteSecret(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** 게임이 "선생님만 알아야 할 것"(예: 정답)을 폰 리모컨에 알린다. 게임 화면이 사라지면 저절로 지운다. */
export function useRemoteSecret(secret: RemoteSecret | null): void {
  const key = secret ? `${secret.title}|${secret.text}|${secret.sub ?? ''}` : '';
  useEffect(() => {
    setRemoteSecret(secret);
    return () => setRemoteSecret(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/* ---------------- 폰에 띄울 판정·진행 버튼(게임이 알려 준다) ---------------- */

export interface RemoteActionDef extends RemoteAction {
  run: () => void;
}

let currentActions: RemoteActionDef[] = [];
let actionsSnapshot: RemoteAction[] = [];
const actionListeners = new Set<() => void>();

function setRemoteActions(defs: RemoteActionDef[]): void {
  currentActions = defs;
  actionsSnapshot = defs.map(({ id, label, tone, color }) => ({ id, label, tone, ...(color ? { color } : {}) }));
  actionListeners.forEach((l) => l());
}

/** useSyncExternalStore 용 — 값이 바뀔 때만 새 배열을 준다 */
export function getRemoteActions(): RemoteAction[] {
  return actionsSnapshot;
}

export function subscribeRemoteActions(l: () => void): () => void {
  actionListeners.add(l);
  return () => {
    actionListeners.delete(l);
  };
}

/** 폰에서 누른 버튼을 실행한다. 실행했으면 true */
export function runRemoteAction(id: string): boolean {
  const a = currentActions.find((x) => x.id === id);
  if (!a) return false;
  a.run();
  return true;
}

/**
 * 게임이 지금 화면에서 쓸 판정·진행 버튼을 폰 리모컨에 알린다(2026-10-14, 리모컨 2단계).
 * 목록은 매번 새로 만들어 넘겨도 된다 — 버튼이 달라질 때만 폰에 보내고, 누르면 가장 최근 함수를 실행한다.
 * 게임 화면이 사라지면 저절로 지운다.
 */
export function useRemoteActions(defs: RemoteActionDef[]): void {
  const latest = useRef(defs);
  latest.current = defs;
  const sig = defs.map((d) => `${d.id}:${d.label}:${d.tone}:${d.color ?? ''}`).join('|');
  useEffect(() => {
    setRemoteActions(latest.current.map((d) => ({ ...d, run: () => latest.current.find((x) => x.id === d.id)?.run() })));
    return () => setRemoteActions([]);
  }, [sig]);
}
