import { useSyncExternalStore } from 'react';

/**
 * 인쇄물 워터마크(학원 로고·이름) 켜기/끄기. 브라우저별 설정이라 localStorage 에 두고(기본 켜짐),
 * 설정 화면과 AppLayout 이 같은 값을 보도록 구독 방식으로 공유한다.
 */
const KEY = 'classbank.printWatermark';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setPrintWatermark(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* 저장이 막혀 있어도 이번 세션의 화면은 아래 알림으로 바뀐다 */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function usePrintWatermark(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}
