import type { CSSProperties } from 'react';

/** 귀여운 워크시트 스타일의 색·글꼴·카드 모양(컴포넌트는 CuteStyle.tsx). */
/** 카드마다 돌려 쓰는 파스텔 색(main = 테두리·번호, bg = 카드 배경). */
const PALETTE = [
  { main: '#3f97e0', bg: '#e8f3fd' },
  { main: '#f2a516', bg: '#fff5d6' },
  { main: '#48b56b', bg: '#e5f6eb' },
  { main: '#ee6f9a', bg: '#fde8f0' },
  { main: '#8b6fd6', bg: '#eee8fa' },
];

export interface CuteTone {
  main: string;
  bg: string;
  /** 제목 리본 바탕색 */
  ribbon: string;
  /** 리본 위 글자색 */
  ribbonText: string;
}

export function cuteTone(index: number, color: boolean): CuteTone {
  if (!color) return { main: '#1b1b1b', bg: '#ffffff', ribbon: '#ffffff', ribbonText: '#1b1b1b' };
  const c = PALETTE[index % PALETTE.length];
  return { main: c.main, bg: c.bg, ribbon: '#3f97e0', ribbonText: '#ffffff' };
}

export const FONT_TITLE = "'Fredoka', 'Andika', 'Noto Sans KR', sans-serif";
/** 글자를 배우는 아이들이 따라 읽기 좋은 학습용 글꼴(a·g 가 손글씨 모양) */
export const FONT_LETTER = "'Andika', 'Comic Sans MS', sans-serif";

/** 둥근 카드(번호·그림·글자를 담는 한 줄). */
export function cuteCardStyle(tone: CuteTone): CSSProperties {
  return { background: tone.bg, border: `0.9mm solid ${tone.main}`, borderRadius: '7mm' };
}

/**
 * 커서가 만든 마스코트·장식 그림(app/public/worksheet-cute/<id>.webp, 흑백판은 <id>-bw.webp).
 * 컬러 인쇄를 끄면 흑백판을 쓴다. 리본은 흑백판 이름이 ribbon-bw 하나뿐이다.
 */
export function cuteAsset(id: string, color: boolean): string {
  if (id.startsWith('ribbon-')) return `/worksheet-cute/${color ? id : 'ribbon-bw'}.webp`;
  return `/worksheet-cute/${id}${color ? '' : '-bw'}.webp`;
}
