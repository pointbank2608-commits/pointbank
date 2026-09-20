import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { decorUrl } from '../../lib/lineart';
import { cuteTone, FONT_TITLE, type CuteTone } from './cuteTheme';

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

/** 페이지 한 장: 둥근 점선 테두리 안에 머리글·본문·바닥글이 들어간다. */
export function CutePage({ children, color }: { children: ReactNode; color: boolean }) {
  return (
    <section className="print-board mb-6 rounded-lg border border-outline-variant/40 bg-white p-[6mm] text-black shadow-sm print:mb-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div
        className="flex min-h-[262mm] flex-col rounded-[9mm] p-[6mm]"
        style={{ border: `1.2mm dashed ${color ? '#3f97e0' : '#1b1b1b'}` }}
      >
        {children}
      </div>
    </section>
  );
}

/** 제목 리본 + 해·구름 장식 + 이름/날짜 칸 + 안내 문구. */
export function CuteHeader({ title, instruction, color }: { title: string; instruction: string; color: boolean }) {
  const { t } = useTranslation();
  const tone = cuteTone(0, color);
  return (
    <header className="mb-[5mm]">
      <div className="flex items-center gap-[4mm]">
        <img src={decorUrl('decor-sun')} alt="" className="h-[20mm] w-[20mm] shrink-0 object-contain" />
        <div
          className="flex-1 rounded-[8mm] px-[6mm] py-[2.5mm] text-center leading-tight"
          style={{
            background: tone.ribbon,
            color: tone.ribbonText,
            border: `1mm solid ${color ? '#2b79b8' : '#1b1b1b'}`,
            fontFamily: FONT_TITLE,
            fontWeight: 700,
            fontSize: '34px',
          }}
        >
          {title}
        </div>
        <img src={decorUrl('decor-cloud')} alt="" className="h-[20mm] w-[20mm] shrink-0 object-contain" />
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
    <footer className="mt-auto flex items-center justify-between gap-[4mm] pt-[4mm]">
      <img src={decorUrl('decor-flower')} alt="" className="h-[16mm] w-[16mm] shrink-0 object-contain" />
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
        className="flex h-[16mm] w-[16mm] shrink-0 items-center justify-center rounded-full text-center text-[9px] leading-tight"
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
