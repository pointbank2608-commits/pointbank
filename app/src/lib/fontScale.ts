import { useSyncExternalStore } from 'react';

export type FontScale = 'normal' | 'large' | 'xlarge';
export const FONT_SCALES: FontScale[] = ['normal', 'large', 'xlarge'];

const KEY = 'classbank.fontScale';
const EVENT = 'classbank:fontscale';

export function getFontScale(): FontScale {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'large' || v === 'xlarge') return v;
  } catch {
    /* 저장소를 못 읽어도 보통 크기로 동작한다 */
  }
  return 'normal';
}

export function applyFontScale(scale: FontScale): void {
  const root = document.documentElement;
  if (scale === 'normal') root.removeAttribute('data-font-scale');
  else root.setAttribute('data-font-scale', scale);
}

export function setFontScale(scale: FontScale): void {
  try {
    localStorage.setItem(KEY, scale);
  } catch {
    /* 저장 못 해도 이번 화면에서는 적용된다 */
  }
  applyFontScale(scale);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** 글자 크기 설정과 바꾸는 함수. 토글이 두 군데 있어도 서로 맞는다. */
export function useFontScale(): [FontScale, (s: FontScale) => void] {
  const scale = useSyncExternalStore(subscribe, getFontScale, () => 'normal' as FontScale);
  return [scale, setFontScale];
}
