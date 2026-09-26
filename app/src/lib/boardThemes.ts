/**
 * 수업 화면 배경 테마(칠판·화이트보드·공책 등, 2026-09-25). "직접 만들기" 슬라이드의 배경과, 발표 중
 * 워크시트 화면(단어 리스트·카드·사선지·퀴즈처럼 A4 종이 없이 글자만 나오는 유형)의 바탕으로 쓴다.
 * 배경마다 어울리는 기본 글자색·글꼴·크기를 같이 정해 둔다 — 녹색 칠판이면 흰 분필 글씨처럼.
 *
 * 크기 단위가 쓰는 곳마다 달라서(슬라이드 무대는 cqh, 워크시트는 px) background 는 단위 함수를 받는다.
 */

import type { CSSProperties } from 'react';

export type BoardThemeId = 'green' | 'black' | 'whiteboard' | 'notebook' | 'grid' | 'pastel';
export type BoardFont = 'sans' | 'round' | 'kids' | 'hand';

export interface BoardTheme {
  id: BoardThemeId;
  /** i18n: curriculum.board.<id> */
  labelKey: string;
  /** 고르는 칩에 보여줄 작은 견본 배경 */
  swatch: string;
  background: (u: (n: number) => string) => string;
  /** 나무·알루미늄 테두리 색(없으면 테두리 없음) */
  frame: string | null;
  /** 기본 글자색 / 흐린 글자(뜻·번호) / 선 / 칩·상자 바탕 / 강조 */
  text: string;
  muted: string;
  line: string;
  chip: string;
  accent: string;
  font: BoardFont;
  /** 슬라이드 새 글상자 기본 크기(무대 높이 %) */
  fontSize: number;
  titleSize: number;
  bold: boolean;
  dark: boolean;
}

const chalkTexture = (base: string) =>
  `radial-gradient(ellipse at 25% 20%, rgba(255,255,255,0.09), transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(0,0,0,0.22), transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.05), transparent 40%), ${base}`;

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'green',
    labelKey: 'curriculum.board.green',
    swatch: '#2f5b45',
    background: () => chalkTexture('#2f5b45'),
    frame: '#9a6b3f',
    text: '#f8fafc',
    muted: 'rgba(248,250,252,0.78)',
    line: 'rgba(248,250,252,0.35)',
    chip: 'rgba(255,255,255,0.12)',
    accent: '#fde68a',
    font: 'hand',
    fontSize: 10,
    titleSize: 16,
    bold: true,
    dark: true,
  },
  {
    id: 'black',
    labelKey: 'curriculum.board.black',
    swatch: '#263238',
    background: () => chalkTexture('#263238'),
    frame: '#8d6e63',
    text: '#f8fafc',
    muted: 'rgba(248,250,252,0.75)',
    line: 'rgba(248,250,252,0.3)',
    chip: 'rgba(255,255,255,0.1)',
    accent: '#fde68a',
    font: 'hand',
    fontSize: 10,
    titleSize: 16,
    bold: true,
    dark: true,
  },
  {
    id: 'whiteboard',
    labelKey: 'curriculum.board.whiteboard',
    swatch: 'linear-gradient(135deg, #ffffff, #e9eef2)',
    background: () => 'linear-gradient(135deg, #ffffff 0%, #f5f7f9 55%, #e9eef2 100%)',
    frame: '#b8c2cc',
    text: '#111827',
    muted: '#4b5563',
    line: '#d1d5db',
    chip: '#f1f5f9',
    accent: '#2563eb',
    font: 'sans',
    fontSize: 9,
    titleSize: 14,
    bold: true,
    dark: false,
  },
  {
    id: 'notebook',
    labelKey: 'curriculum.board.notebook',
    swatch: 'repeating-linear-gradient(to bottom, #fffef8 0, #fffef8 5px, #bfdbfe 5px, #bfdbfe 6px)',
    background: (u) =>
      `linear-gradient(to right, transparent ${u(10)}, #fca5a5 ${u(10)}, #fca5a5 calc(${u(10)} + 2px), transparent calc(${u(10)} + 2px)), repeating-linear-gradient(to bottom, transparent 0, transparent calc(${u(8)} - 1px), #bfdbfe calc(${u(8)} - 1px), #bfdbfe ${u(8)}), #fffef8`,
    frame: null,
    text: '#1e3a8a',
    muted: '#475569',
    line: '#bfdbfe',
    chip: '#eff6ff',
    accent: '#dc2626',
    font: 'hand',
    fontSize: 10,
    titleSize: 15,
    bold: true,
    dark: false,
  },
  {
    id: 'grid',
    labelKey: 'curriculum.board.grid',
    swatch: 'linear-gradient(#d1d5db 1px, transparent 1px) 0 0 / 6px 6px, linear-gradient(90deg, #d1d5db 1px, transparent 1px) 0 0 / 6px 6px, #ffffff',
    background: (u) =>
      `linear-gradient(#e5e7eb 1px, transparent 1px) 0 0 / ${u(5)} ${u(5)}, linear-gradient(90deg, #e5e7eb 1px, transparent 1px) 0 0 / ${u(5)} ${u(5)}, #ffffff`,
    frame: null,
    text: '#1f2937',
    muted: '#4b5563',
    line: '#d1d5db',
    chip: '#f3f4f6',
    accent: '#16a34a',
    font: 'round',
    fontSize: 9,
    titleSize: 14,
    bold: true,
    dark: false,
  },
  {
    id: 'pastel',
    labelKey: 'curriculum.board.pastel',
    swatch: 'linear-gradient(135deg, #dbeafe, #fef9c3)',
    background: () => 'linear-gradient(135deg, #dbeafe 0%, #fce7f3 50%, #fef9c3 100%)',
    frame: null,
    text: '#1e3a5f',
    muted: '#475569',
    line: 'rgba(30,58,95,0.2)',
    chip: 'rgba(255,255,255,0.6)',
    accent: '#db2777',
    font: 'round',
    fontSize: 9,
    titleSize: 15,
    bold: true,
    dark: false,
  },
];

export function boardTheme(id: string | null | undefined): BoardTheme | null {
  return BOARD_THEMES.find((th) => th.id === id) ?? null;
}

export const BOARD_FONTS: Record<BoardFont, string> = {
  sans: "'Noto Sans KR', 'Hanken Grotesk', sans-serif",
  round: "'Fredoka', 'Quicksand', 'Noto Sans KR', sans-serif",
  kids: "'Andika', 'Noto Sans KR', sans-serif",
  hand: "'Gaegu', 'Andika', 'Noto Sans KR', sans-serif",
};

/** 슬라이드 무대(cqh) 배경 + 테두리 */
export function boardSlideStyle(th: BoardTheme): CSSProperties {
  return {
    background: th.background((n) => `${n}cqh`),
    boxShadow: th.frame ? `inset 0 0 0 1.8cqh ${th.frame}, inset 0 0 0 2.3cqh rgba(0,0,0,0.18)` : undefined,
  };
}

/**
 * 발표 중 워크시트 화면을 칠판·화이트보드로 — 화면에서만(@media screen) 적용하고 인쇄는 그대로.
 * 글자색은 앱 색 토큰(--color-*)·글자 크기 토큰(--text-*)을 바꿔서 기존 워크시트 마크업을 하나도
 * 안 고치고 바꾼다. A4 종이 모양(흰 종이) 유형은 종이 안 글자가 흰색이 되면 안 되므로,
 * 토큰 교체는 [data-board-text] 가 붙은 "종이 없는" 블록에만 건다.
 */
export function boardWorksheetCss(th: BoardTheme): string {
  const sel = `[data-board="${th.id}"]`;
  const font = BOARD_FONTS[th.font];
  // 손글씨(Gaegu)는 글자가 작아 보여서 조금 더 키운다.
  const k = th.font === 'hand' ? 1.25 : 1;
  const px = (n: number) => `${Math.round(n * k)}px`;
  return `@media screen {
  ${sel} {
    background: ${th.background((n) => `${n * 5}px`)};
    ${th.frame ? `border: 14px solid ${th.frame}; box-shadow: inset 0 0 0 3px rgba(0,0,0,0.18), 0 10px 30px rgba(0,0,0,0.18);` : 'box-shadow: 0 10px 30px rgba(0,0,0,0.12);'}
  }
  ${sel} [data-board-text] {
    --color-deep-navy: ${th.text};
    --color-on-surface: ${th.text};
    --color-on-surface-variant: ${th.muted};
    --color-outline: ${th.muted};
    --color-outline-variant: ${th.line};
    --color-surface-container-low: ${th.chip};
    --color-surface-container-high: ${th.chip};
    --color-primary: ${th.accent};
    --trace-stroke: ${th.muted};
    --font-title-md: ${font};
    --font-body-md: ${font};
    --font-body-sm: ${font};
    --font-caption: ${font};
    --text-title-md: ${px(30)};
    --text-title-md--line-height: ${px(40)};
    --text-body-md: ${px(22)};
    --text-body-md--line-height: ${px(32)};
    --text-body-sm: ${px(19)};
    --text-caption: ${px(18)};
    color: ${th.text};
    font-family: ${font};
  }
  ${sel} .print-sheet[data-board-text] { width: 100%; max-width: 1100px; }
  ${sel} [data-board-text] .font-bold, ${sel} [data-board-text] .font-title-md { font-weight: ${th.bold ? 700 : 600}; }
}`;
}

/** 슬라이드 글꼴 미리 받기 — 구글 폰트는 "처음 쓰일 때" 받아서, 글상자를 처음 입력하는 동안은
 * 다른 글꼴(대체 글꼴)로 보이다가 다른 곳을 누르면 원래 글꼴로 바뀌어 보였다(학원 와이파이처럼
 * 느린 곳에서 특히). 편집기를 열 때 영문·한글 모두 굵게/보통을 먼저 받아 둔다. */
let boardFontsPromise: Promise<unknown> | null = null;
export function preloadBoardFonts(): Promise<unknown> {
  if (boardFontsPromise) return boardFontsPromise;
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve();
  const families = ['Gaegu', 'Andika', 'Fredoka', 'Quicksand', 'Noto Sans KR'];
  const jobs: Promise<unknown>[] = [];
  for (const fam of families) {
    for (const weight of [400, 700]) {
      jobs.push(document.fonts.load(`${weight} 20px '${fam}'`, 'AaBb 가나다').catch(() => null));
    }
  }
  boardFontsPromise = Promise.all(jobs);
  return boardFontsPromise;
}
