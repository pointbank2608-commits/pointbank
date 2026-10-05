/**
 * 직접 만들기 슬라이드의 발표 중 효과(2026-10-05) — 파워포인트의 "애니메이션 창"처럼 요소마다 효과를 정하고,
 * 순서는 슬라이드의 motionOrder(없으면 요소 순서)를 따른다.
 *
 *  - trigger 'click': 클릭(클리커·Space·→)마다 새 단계
 *  - trigger 'with' : 앞 효과와 같은 순간에 시작
 *  - trigger 'auto' : 앞 효과가 끝난 뒤 시작(같은 단계 안)
 *  - out: true      : 나타나는 게 아니라 사라진다 — 정답 가리개
 *  단계 0 = 슬라이드가 열리자마자(처음에 click 이 아닌 효과들).
 */
import type { CanvasElement, CanvasMotion, CanvasMotionEffect, CanvasSlide } from './types';

export interface MotionInfo {
  id: string;
  /** 0 = 슬라이드가 열릴 때, 1.. = 클릭 단계 */
  step: number;
  /** 단계 안에서 효과가 시작하는 시각(초, 자기 지연 포함) */
  start: number;
  /** 정해 둔 순서(0부터) */
  order: number;
  motion: CanvasMotion;
}

export interface MotionPlan {
  /** 클릭이 필요한 단계 수 */
  clickSteps: number;
  byId: Map<string, MotionInfo>;
  /** 순서대로 */
  ordered: MotionInfo[];
}

export const DEFAULT_MOTION: CanvasMotion = { effect: 'fade', trigger: 'click', duration: 0.6, delay: 0 };

export const GENERIC_EFFECTS: CanvasMotionEffect[] = ['fade', 'pop', 'zoom', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'wipe', 'bounce', 'spin'];

/** 이 요소에서 고를 수 있는 효과 — 그려지기는 손으로 그린 표시와 선·화살표 선만 */
export function effectsFor(el: CanvasElement): CanvasMotionEffect[] {
  const drawable = el.type === 'mark' || (el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow'));
  return drawable ? ['draw', ...GENERIC_EFFECTS] : GENERIC_EFFECTS;
}

export function effectIcon(effect: CanvasMotionEffect): string {
  switch (effect) {
    case 'fade': return 'blur_on';
    case 'pop': return 'bubble_chart';
    case 'zoom': return 'zoom_in';
    case 'slide-left': return 'arrow_right_alt';
    case 'slide-right': return 'keyboard_backspace';
    case 'slide-up': return 'north';
    case 'slide-down': return 'south';
    case 'wipe': return 'wipe';
    case 'bounce': return 'sports_basketball';
    case 'spin': return 'autorenew';
    case 'draw': return 'draw';
  }
}

export function buildMotionPlan(slide: Pick<CanvasSlide, 'elements' | 'motionOrder'>): MotionPlan {
  const animated = slide.elements.filter((el) => !!el.motion);
  const byElement = new Map(animated.map((el) => [el.id, el]));
  const ids: string[] = [];
  for (const id of slide.motionOrder ?? []) if (byElement.has(id) && !ids.includes(id)) ids.push(id);
  for (const el of animated) if (!ids.includes(el.id)) ids.push(el.id);

  const byId = new Map<string, MotionInfo>();
  const ordered: MotionInfo[] = [];
  let step = 0;
  let lastStart = 0;
  let lastEnd = 0;
  ids.forEach((id, order) => {
    const m = byElement.get(id)!.motion!;
    let start: number;
    if (m.trigger === 'click') {
      step += 1;
      start = 0;
    } else if (m.trigger === 'with') {
      start = lastStart;
    } else {
      start = lastEnd;
    }
    const begin = start + Math.max(0, m.delay);
    lastStart = start;
    lastEnd = begin + Math.max(0.1, m.duration);
    const info: MotionInfo = { id, step, start: begin, order, motion: m };
    byId.set(id, info);
    ordered.push(info);
  });
  return { clickSteps: step, byId, ordered };
}

/** 편집기에 보여 줄 짧은 이름표(번역 키와 값) */
export function motionBadge(info: MotionInfo): { key: 'click' | 'with' | 'auto'; n: number } {
  return { key: info.motion.trigger, n: info.step };
}
