import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cuteAsset, FONT_TITLE, type CuteTone } from './cuteTheme';

/**
 * 유치원~초등 저학년용 "귀여운" 워크시트 스타일(파닉스 워크시트에 먼저 적용). 둥근 모서리·굵은 글씨·
 * 알록달록한 카드·리본 제목·별 칸 같은 것을 코드로 그린다. 컬러 인쇄를 끄면 색은 검정/흰색으로 바뀌지만
 * 둥근 모양과 굵은 선으로 여전히 귀엽게 보이게 했다. 그림(마스코트·스티커)이 생기면 여기 슬롯에 끼운다
 * (CURSOR_DESIGN_BRIEF_PHONICS.md 참고).
 */

export function Star({ size = 9, fill = 'none', stroke = '#1b1b1b' }: { size?: number; fill?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: `${size}mm`, height: `${size}mm` }} aria-hidden>
      <path
        d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CORNERS = [
  { key: 'tl', id: 'corner-flowers', pos: { top: '-4mm', left: '-4mm' }, flip: 'none' },
  { key: 'tr', id: 'corner-stars', pos: { top: '-4mm', right: '-4mm' }, flip: 'scaleX(-1)' },
  { key: 'bl', id: 'corner-stars', pos: { bottom: '-4mm', left: '-4mm' }, flip: 'scaleY(-1)' },
  { key: 'br', id: 'corner-flowers', pos: { bottom: '-4mm', right: '-4mm' }, flip: 'scale(-1, -1)' },
] as const;

/** 페이지 한 장: 둥근 점선 테두리 안에 머리글·본문·바닥글이 들어간다. */
export function CutePage({ children, color }: { children: ReactNode; color: boolean }) {
  return (
    <section className="print-board mb-6 rounded-lg border border-outline-variant/40 bg-white p-[6mm] text-black shadow-sm print:mb-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div
        className="relative flex min-h-[262mm] flex-col rounded-[9mm] p-[6mm]"
        style={{ border: `1.2mm dashed ${color ? '#3f97e0' : '#1b1b1b'}` }}
      >
        {/* 모서리 장식: 왼쪽 위 기준 그림을 뒤집어 네 모서리에 놓는다(글 뒤에 깔리고 내용과 겹치지 않는 자리). */}
        {CORNERS.map((c) => (
          <img
            key={c.key}
            src={cuteAsset(c.id, color)}
            alt=""
            aria-hidden
            className="pointer-events-none absolute h-[19mm] w-[19mm] object-contain"
            style={{ ...c.pos, transform: c.flip }}
          />
        ))}
        {children}
      </div>
    </section>
  );
}

/** 제목 리본 + 해·구름 장식 + 이름/날짜 칸 + 안내 문구. */
export function CuteHeader({ title, instruction, color }: { title: string; instruction: string; color: boolean }) {
  const { t } = useTranslation();
  return (
    <header className="mb-[5mm]">
      {/* 코너 장식과 겹치지 않게 좌우를 8mm 안쪽으로 들인다. */}
      <div className="mx-[8mm] flex items-center gap-[3mm]">
        <img src={cuteAsset('ollie-wave', color)} alt="" className="h-[22mm] w-[22mm] shrink-0 object-contain" />
        <div
          className="flex flex-1 items-center justify-center text-center leading-tight"
          style={{
            height: '19mm',
            backgroundImage: `url(${cuteAsset('ribbon-blue', color)})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            color: color ? '#0d3b66' : '#1b1b1b',
            fontFamily: FONT_TITLE,
            fontWeight: 700,
            fontSize: '30px',
            padding: '0 12mm',
          }}
        >
          {title}
        </div>
        <img src={cuteAsset('pip-hello', color)} alt="" className="h-[22mm] w-[22mm] shrink-0 object-contain" />
      </div>
      <div className="mt-[3mm] flex justify-end gap-[4mm] text-[15px]" style={{ fontFamily: FONT_TITLE }}>
        {[
          [t('materials.worksheet.sheet.name'), '48mm'],
          [t('materials.worksheet.sheet.date'), '34mm'],
        ].map(([label, w]) => (
          <span
            key={label}
            className="flex items-end gap-1 rounded-full px-[4mm] py-[1mm]"
            style={{ border: `0.6mm dashed ${color ? '#3f97e0' : '#1b1b1b'}` }}
          >
            {label}: <span className="inline-block border-b border-black" style={{ width: w }} />
          </span>
        ))}
      </div>
      <p
        className="mt-[3mm] rounded-[5mm] px-[5mm] py-[2.5mm] text-[19px] font-bold leading-snug"
        style={{ background: color ? '#fff5d6' : '#ffffff', border: `0.7mm solid ${color ? '#f2a516' : '#1b1b1b'}`, fontFamily: FONT_TITLE }}
      >
        {instruction}
      </p>
    </header>
  );
}

/** 바닥글: "Great job!" + 별 5개(잘하면 색칠) + 스티커 자리. */
export function CuteFooter({ color }: { color: boolean }) {
  const { t } = useTranslation();
  return (
    <footer className="mx-[8mm] mt-auto flex items-center justify-between gap-[4mm] pt-[4mm]">
      <img src={cuteAsset('ollie-thumbsup', color)} alt="" className="h-[18mm] w-[18mm] shrink-0 object-contain" />
      <div className="flex items-center gap-[2mm]">
        <span
          className="rounded-full px-[5mm] py-[1.5mm] text-[20px] font-bold"
          style={{ fontFamily: FONT_TITLE, background: color ? '#48b56b' : '#ffffff', color: color ? '#ffffff' : '#1b1b1b', border: `0.8mm solid ${color ? '#2f8f4d' : '#1b1b1b'}` }}
        >
          {t('materials.worksheet.sheet.greatJob')}
        </span>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={9} stroke={color ? '#e39a00' : '#1b1b1b'} />
        ))}
      </div>
      <div
        className="flex h-[18mm] w-[18mm] shrink-0 items-center justify-center rounded-full text-center text-[9px] leading-tight"
        style={{ border: `0.6mm dashed ${color ? '#ee6f9a' : '#1b1b1b'}`, fontFamily: FONT_TITLE }}
      >
        {t('materials.worksheet.sheet.sticker')}
      </div>
    </footer>
  );
}

/** 카드 번호 동그라미. */
export function CuteBadge({ n, tone }: { n: number; tone: CuteTone }) {
  return (
    <span
      className="flex h-[11mm] w-[11mm] shrink-0 items-center justify-center rounded-full text-[19px] font-bold"
      style={{ background: tone.main, color: '#ffffff', fontFamily: FONT_TITLE }}
    >
      {n}
    </span>
  );
}
