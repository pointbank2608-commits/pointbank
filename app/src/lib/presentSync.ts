import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * 학생 따라보기(2026-09-27)용 "슬라이드 안 단계" 맞추기.
 * - 선생님(발표 중, 따라보기 링크를 켰을 때): 문법·노래·카드·단어 소개 보드가 지금 단계를 report 로 알린다.
 * - 학생(/watch): 보드가 remote 로 받은 단계를 그대로 적용하고, 자기 키보드로는 넘기지 않는다.
 * 컨텍스트가 없으면(평소 편집·발표) 아무 일도 안 한다.
 */
export type SubState = Record<string, unknown> | null;

export interface PresentSyncApi {
  role: 'teacher' | 'student';
  report: (sub: SubState) => void;
  remote: SubState;
}

export const PresentSyncContext = createContext<PresentSyncApi | null>(null);

export function usePresentSync(): PresentSyncApi | null {
  return useContext(PresentSyncContext);
}

/**
 * 보드가 쓰는 도우미. 선생님이면 state 가 바뀔 때마다 알리고, 학생이면 선생님 단계가 올 때마다 apply 한다.
 * 돌려주는 값: 학생 화면인지(true 면 키보드·자동 읽기 등을 끈다).
 */
export function useSyncedSubState<T extends Record<string, unknown>>(state: T, apply: (s: T) => void): boolean {
  const sync = usePresentSync();
  const json = JSON.stringify(state);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (sync?.role === 'teacher') sync.report(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, sync?.role]);
  useEffect(() => {
    if (sync?.role === 'student' && sync.remote) applyRef.current(sync.remote as T);
  }, [sync?.role, sync?.remote]);
  return sync?.role === 'student';
}
