import { useEffect, useRef } from 'react';
import {useGameHistory} from '../context/GameHistoryContext';
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const remotePhone = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  accessToken: async () => null,
});

export interface RemotePairing {
  id: string;
  key: string;
}

export interface RemotePoints {
  unit: string;
  locked: boolean;
  students: { id: string; name: string; today: number }[];
  presets: { id: string; label: string; delta: number }[];
}

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
  pointerEnabled?: boolean;
  pointerClickEnabled?: boolean;
  textTarget?: RemoteTextTarget | null;
  scrollEnabled?: boolean;
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
  pointer: RemotePointer | null;
  text_seq: number;
  text_input: RemoteTextMessage | null;
  scroll: RemoteScrollUpdate | null;
}

export interface RemoteTextTarget {
  id: string;
  limit: number;
  multiline: boolean;
}

export interface RemoteTextMessage {
  target: string;
  draft: string;
  expiresAt: number;
}

export interface RemotePointer {
  seq: number;
  x: number;
  y: number;
  click?: RemotePointerClick;
}

export interface RemoteScrollUpdate {
  seq: number;
  step: number;
  total: number;
}

export interface RemotePointerClick {
  seq: number;
  x: number;
  y: number;
  count: 1 | 2;
  step: number;
}

export function remoteUrl(pair: RemotePairing): string {
  return `${window.location.origin}/remote/${pair.id}#${pair.key}`;
}

export async function createRemoteSession(classId: string | null): Promise<RemotePairing> {
  const { data, error } = await supabase.rpc('remote_qr_open', { p_class: classId });
  if (error || !data) throw error ?? new Error('remote session');
  return data as RemotePairing;
}

export async function deleteRemoteSession(id: string): Promise<void> {
  const { error } = await supabase.from('remote_sessions').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchRemoteSession(id: string): Promise<RemoteRow | null> {
  const { data, error } = await supabase.from('remote_sessions')
    .select('id, state, cmd, pointer, text_seq, text_input, scroll').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as RemoteRow;
}

export async function publishRemoteState(id: string, state: RemoteState): Promise<void> {
  await supabase.from('remote_sessions').update({ state, updated_at: new Date().toISOString() })
    .eq('id', id).or('state->>ended.is.null,state->>ended.eq.false');
}

function remotePhoneArgs(pair: RemotePairing) {
  return { p_id: pair.id, p_key: pair.key };
}

export async function fetchRemotePhoneState(pair: RemotePairing, signal: AbortSignal): Promise<Partial<RemoteState> | null> {
  const { data, error } = await remotePhone.rpc('remote_qr_poll', remotePhoneArgs(pair)).abortSignal(signal);
  if (error) throw error;
  return data?.state ?? null;
}

export async function sendRemoteCmd(pair: RemotePairing, name: RemoteCmdName, arg?: number, actionId?: string): Promise<void> {
  const { data, error } = await remotePhone.rpc('remote_qr_send', {
    ...remotePhoneArgs(pair), p_name: name, p_arg: arg ?? null, p_action: actionId ?? null,
  });
  if (error || !data) throw error ?? new Error('remote unavailable');
}

export async function moveRemotePointer(pair: RemotePairing, dx: number, dy: number, signal: AbortSignal): Promise<void> {
  const { data, error } = await remotePhone.rpc('remote_qr_move_pointer', {
    ...remotePhoneArgs(pair), p_dx: dx, p_dy: dy,
  }).abortSignal(signal);
  if (error || data !== true) throw error ?? new Error('remote pointer unavailable');
}

export async function clickRemotePointer(pair: RemotePairing, count: 1 | 2, step: number, signal: AbortSignal): Promise<void> {
  const { data, error } = await remotePhone.rpc('remote_qr_click_pointer', {
    ...remotePhoneArgs(pair), p_count: count, p_step: step,
  }).abortSignal(signal);
  if (error || data !== true) throw error ?? new Error('remote pointer click unavailable');
}

export async function scrollRemotePresentation(pair: RemotePairing, delta: number, step: number, signal: AbortSignal): Promise<void> {
  const { data, error } = await remotePhone.rpc('remote_qr_scroll', {
    ...remotePhoneArgs(pair), p_delta: delta, p_step: step,
  }).abortSignal(signal);
  if (error || data !== true) throw error ?? new Error('remote presentation scroll unavailable');
}

export async function writeRemoteText(pair: RemotePairing, target: string, draft: string, signal: AbortSignal): Promise<void> {
  const { data, error } = await remotePhone.rpc('remote_qr_write_text', {
    ...remotePhoneArgs(pair), p_target: target, p_text: draft,
  }).abortSignal(signal);
  if (error || data !== true) throw error ?? new Error('remote text target unavailable');
}

export async function acknowledgeRemoteText(id: string, seq: number): Promise<void> {
  await supabase.from('remote_sessions').update({ text_input: null }).eq('id', id).eq('text_seq', seq);
}

export async function fetchRemotePoints(pair: RemotePairing): Promise<RemotePoints> {
  const { data, error } = await remotePhone.rpc('remote_qr_points', remotePhoneArgs(pair));
  if (error || !data) throw error ?? new Error('remote points unavailable');
  return data as RemotePoints;
}

export async function giveRemotePoints(pair: RemotePairing, requestId: string, presetId: string, studentIds: string[]): Promise<void> {
  const { data, error } = await remotePhone.rpc('remote_qr_give', {
    ...remotePhoneArgs(pair), p_request: requestId, p_preset: presetId, p_students: studentIds,
  });
  if (error || data !== studentIds.length) throw error ?? new Error('remote points unavailable');
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
  const history=useGameHistory();
  const latest = useRef(defs);
  latest.current = defs;
  const sig = defs.map((d) => `${d.id}:${d.label}:${d.tone}:${d.color ?? ''}`).join('|');
  useEffect(() => {
    setRemoteActions(latest.current.map((d) => ({ ...d, run: () => {
      if(history?.restoring)return;
      history?.begin();latest.current.find((x) => x.id === d.id)?.run();requestAnimationFrame(()=>history?.changed());
    } })));
    return () => setRemoteActions([]);
  }, [sig,history]);
}
