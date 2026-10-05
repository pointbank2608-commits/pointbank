/**
 * 직접 만들기 슬라이드의 그려지는 표시(체크·동그라미·X·화살표·밑줄·별·네모)와 특수 문자 모음(2026-10-05).
 * 표시는 0~100 상자에 그린 선(path)이고, 상자 크기에 맞춰 늘어난다(선 굵기는 그대로).
 * 선마다 pathLength=1 로 두고 stroke-dashoffset 을 1→0 으로 움직여 "펜으로 그리듯" 나타낸다(tailwind.css `.canvas-mark-draw`).
 */
import type { CanvasMarkElement, CanvasMarkShape, CanvasShapeElement, CanvasShapeKind } from './types';

/** 모양마다 그리는 선(순서대로 그려진다) */
export const MARK_PATHS: Record<CanvasMarkShape, string[]> = {
  check: ['M8 55 L36 84 L93 14'],
  circle: ['M52 7 C80 6 96 27 95 51 C94 77 73 95 48 94 C22 93 5 73 6 48 C7 23 27 6 58 10'],
  cross: ['M14 14 L86 86', 'M86 14 L14 86'],
  arrow: ['M4 50 L93 50', 'M70 24 L95 50 L70 76'],
  underline: ['M3 62 C28 52 52 70 75 58 C85 53 92 55 97 57'],
  star: ['M50 5 L61 37 L95 38 L68 58 L78 92 L50 72 L22 92 L32 58 L5 38 L39 37 Z'],
  box: ['M9 8 L91 8 L91 92 L9 92 Z'],
};

export const MARK_SHAPES: { shape: CanvasMarkShape; icon: string }[] = [
  { shape: 'check', icon: 'check' },
  { shape: 'circle', icon: 'radio_button_unchecked' },
  { shape: 'cross', icon: 'close' },
  { shape: 'arrow', icon: 'arrow_forward' },
  { shape: 'underline', icon: 'format_underlined' },
  { shape: 'star', icon: 'star' },
  { shape: 'box', icon: 'check_box_outline_blank' },
];

/** 모양마다 처음 크기(무대 %). 무대가 16:9 라 w 를 h 의 9/16 쯤으로 두면 정사각형에 가깝다. */
const MARK_SIZE: Record<CanvasMarkShape, { w: number; h: number }> = {
  check: { w: 11, h: 19 },
  circle: { w: 16, h: 26 },
  cross: { w: 11, h: 19 },
  arrow: { w: 16, h: 14 },
  underline: { w: 26, h: 8 },
  star: { w: 12, h: 21 },
  box: { w: 16, h: 26 },
};

export function newMarkElement(shape: CanvasMarkShape, patch: Partial<CanvasMarkElement> = {}): CanvasMarkElement {
  const { w, h } = MARK_SIZE[shape];
  return {
    id: crypto.randomUUID(),
    type: 'mark',
    shape,
    x: 50 - w / 2,
    y: 50 - h / 2,
    w,
    h,
    color: '#e11d48',
    stroke: 1.4,
    // 발표 중 펜으로 그리듯 — 클릭할 때 하나씩
    motion: { effect: 'draw', trigger: 'click', duration: 0.6, delay: 0 },
    ...patch,
  };
}

/** 영어 수업에서 자주 쓰는 특수 문자 — 그룹 이름은 번역 키(curriculum.canvas.chars_<id>) */
export const SPECIAL_CHAR_GROUPS: { id: string; chars: string[] }[] = [
  { id: 'check', chars: ['✓', '✔', '✗', '✘', '☐', '☑', '☒', '★', '☆', '♥', '♡', '✿'] },
  { id: 'shape', chars: ['○', '●', '◎', '△', '▲', '▽', '▼', '□', '■', '◇', '◆', '◯'] },
  { id: 'arrow', chars: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇔', '➜', '↗', '↘', '↻'] },
  { id: 'number', chars: ['•', '·', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '…', '※'] },
  { id: 'phonetic', chars: ['ˈ', 'ˌ', 'ː', 'ə', 'ɚ', 'æ', 'ʌ', 'ɑ', 'ɔ', 'ɪ', 'ʊ', 'ɛ', 'θ', 'ð', 'ʃ', 'ʒ', 'ŋ', 'tʃ', 'dʒ', '//', '[]'] },
  { id: 'punct', chars: ['“”', '‘’', '—', '–', '¿', '¡', '♪', '♫', '☀', '☁', '☂', '☺'] },
];

/** 짝으로 넣는 문자 — 넣은 뒤 커서를 가운데에 둔다 */
export const PAIRED_CHARS = new Set(['“”', '‘’', '//', '[]']);

/* ---------- 도형 ---------- */

export const SHAPE_KINDS: { shape: CanvasShapeKind; icon: string }[] = [
  { shape: 'rect', icon: 'crop_square' },
  { shape: 'roundrect', icon: 'rounded_corner' },
  { shape: 'ellipse', icon: 'circle' },
  { shape: 'triangle', icon: 'change_history' },
  { shape: 'diamond', icon: 'diamond' },
  { shape: 'star', icon: 'star' },
  { shape: 'speech', icon: 'chat_bubble' },
  { shape: 'blockarrow', icon: 'arrow_right_alt' },
  { shape: 'line', icon: 'horizontal_rule' },
  { shape: 'arrow', icon: 'trending_flat' },
];

export const isLineShape = (shape: CanvasShapeKind) => shape === 'line' || shape === 'arrow';

const SHAPE_SIZE: Record<CanvasShapeKind, { w: number; h: number }> = {
  rect: { w: 20, h: 30 },
  roundrect: { w: 24, h: 24 },
  ellipse: { w: 18, h: 32 },
  triangle: { w: 18, h: 32 },
  diamond: { w: 18, h: 32 },
  star: { w: 14, h: 25 },
  speech: { w: 26, h: 32 },
  blockarrow: { w: 24, h: 22 },
  line: { w: 24, h: 5 },
  arrow: { w: 24, h: 6 },
};

export function newShapeElement(shape: CanvasShapeKind, patch: Partial<CanvasShapeElement> = {}): CanvasShapeElement {
  const { w, h } = SHAPE_SIZE[shape];
  const line = isLineShape(shape);
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    shape,
    x: 50 - w / 2,
    y: 50 - h / 2,
    w,
    h,
    fill: line ? null : '#fde68a',
    stroke: line ? '#1f2937' : '#f59e0b',
    strokeWidth: line ? 0.9 : 0.6,
    dash: 'solid',
    radius: shape === 'roundrect' ? 4 : 0,
    ...patch,
  };
}

/** 정답 가리개 — 클릭하면 사라지는 네모(그 위에 가려진 글·그림을 보여 준다) */
export function newCoverElement(patch: Partial<CanvasShapeElement> = {}): CanvasShapeElement {
  return newShapeElement('roundrect', {
    w: 30,
    h: 28,
    fill: '#2563eb',
    stroke: '#1e40af',
    strokeWidth: 0.5,
    radius: 3,
    motion: { effect: 'fade', out: true, trigger: 'click', duration: 0.4, delay: 0 },
    ...patch,
  });
}
