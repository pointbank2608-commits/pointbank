import type { HelperPosition, SlideHelper } from './types';

/**
 * 보조 블록(BLOCK_SPEC §3·§6) — 슬라이드의 주 블록 곁에 놓이는 제목·타이머·점수판.
 * 슬라이드마다 `helpers` 에 저장되고, 발표 중에만 보인다(SlideHelpersLayer). 판서는 따로 진행바의 "판서" 층이다.
 */
export type HelperType = SlideHelper['type'];

export const HELPER_TYPES: HelperType[] = ['title', 'timer', 'scoreboard'];
export const HELPER_POSITIONS: HelperPosition[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right'];
export const TIMER_PRESETS = [30, 60, 180, 300, 600];
export const TEAM_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706'];

/** 보조 블록 종류 → 블록 규격 id(lib/blocks/registry.ts) */
export const helperBlockId = (type: HelperType) => `helper.${type}`;

const uid = () => crypto.randomUUID();

/** 새 보조 블록의 기본값 */
export function newHelper(type: HelperType): SlideHelper {
  switch (type) {
    case 'title':
      return { id: uid(), type, text: '', position: 'top-center' };
    case 'timer':
      return { id: uid(), type, seconds: 180, position: 'top-right' };
    case 'scoreboard':
      return { id: uid(), type, teams: 2, position: 'bottom-left' };
  }
}

/** m:ss */
export function formatClock(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 위치별로 묶는다(같은 자리에 여러 개면 위에서 아래로 쌓는다) */
export function groupByPosition(helpers: SlideHelper[]): Map<HelperPosition, SlideHelper[]> {
  const m = new Map<HelperPosition, SlideHelper[]>();
  for (const h of helpers) m.set(h.position, [...(m.get(h.position) ?? []), h]);
  return m;
}

export const POSITION_CLASS: Record<HelperPosition, string> = {
  'top-left': 'left-3 top-3 items-start',
  'top-center': 'left-1/2 top-3 -translate-x-1/2 items-center',
  'top-right': 'right-3 top-3 items-end',
  'bottom-left': 'bottom-3 left-3 items-start',
  'bottom-right': 'bottom-3 right-3 items-end',
};
