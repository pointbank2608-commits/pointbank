import { useTranslation } from 'react-i18next';
import type {
  MatchPage,
  OddRow,
  PhonicsBlankRow,
  PhonicsCircleRow,
} from '../../lib/worksheetGenerators';
import { CuteBadge, CuteFooter, CuteHeader, CutePage } from './CuteStyle';
import { cuteCardStyle, cuteTone, FONT_LETTER, FONT_TITLE } from './cuteTheme';

/**
 * 파닉스 워크시트 4종(규칙 글자 빈칸·규칙 글자 찾기·다른 하나 찾기·라임 잇기)의 학생용 페이지.
 * 어린 학생이 쓰는 종이라 글씨(약 56px)와 그림(약 30mm)을 크게, 카드는 알록달록 둥글게 그린다.
 * 정답지는 선생님용이라 WorksheetSheets 의 담백한 스타일을 그대로 쓴다.
 */

interface Common {
  color: boolean;
  startIndex: number;
}

function Picture({ src, size }: { src: string; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[5mm] bg-white"
      style={{ width: `${size}mm`, height: `${size}mm`, padding: '1mm' }}
    >
      <img src={src} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

/* ---------------- 규칙 글자 빈칸 ---------------- */

export function PhonicsBlankCute({ rows, bank, color, startIndex }: Common & { rows: PhonicsBlankRow[]; bank: string[] }) {
  const { t } = useTranslation();
  return (
    <CutePage color={color}>
      <CuteHeader color={color} title={t('materials.worksheet.sheet.phonicsBlankTitle')} instruction={t('materials.worksheet.sheet.phonicsBlankInstruction')} />
      {bank.length > 0 && bank.length <= 8 && (
        <div className="mb-[4mm] flex flex-wrap items-center gap-[3mm]">
          <span className="text-[17px] font-bold" style={{ fontFamily: FONT_TITLE }}>
            {t('materials.worksheet.sheet.phonicsBank')}
          </span>
          {bank.map((b, i) => {
            const tone = cuteTone(i + 1, color);
            return (
              <span
                key={b}
                className="rounded-full px-[6mm] py-[1.5mm] text-[30px] font-bold leading-tight"
                style={{ background: tone.bg, border: `0.9mm solid ${tone.main}`, fontFamily: FONT_LETTER }}
              >
                {b}
              </span>
            );
          })}
        </div>
      )}
      <div className="space-y-[4mm]">
        {rows.map((row, i) => {
          const tone = cuteTone(i, color);
          return (
            <div key={i} className="print-card flex items-center gap-[5mm] px-[4mm] py-[3mm]" style={cuteCardStyle(tone)}>
              <CuteBadge n={startIndex + i + 1} tone={tone} />
              {row.imageUrl ? <Picture src={row.imageUrl} size={32} /> : <span style={{ width: '32mm' }} />}
              <div className="flex items-end" style={{ fontFamily: FONT_LETTER, fontWeight: 700, fontSize: '60px', lineHeight: 1 }}>
                {row.parts.map((p, k) =>
                  p.marked ? (
                    <span
                      key={k}
                      className="mx-[2mm] inline-flex items-end justify-center bg-white"
                      style={{
                        minWidth: `${Math.max(24, p.text.length * 19)}mm`,
                        height: '21mm',
                        border: `0.9mm dashed ${tone.main}`,
                        borderRadius: '4mm',
                      }}
                    />
                  ) : (
                    <span key={k}>{p.text}</span>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
      <CuteFooter color={color} />
    </CutePage>
  );
}

/* ---------------- 규칙 글자 찾기 ---------------- */

export function PhonicsCircleCute({ rows, sameTarget, color, startIndex }: Common & { rows: PhonicsCircleRow[]; sameTarget: string | null }) {
  const { t } = useTranslation();
  return (
    <CutePage color={color}>
      <CuteHeader
        color={color}
        title={t('materials.worksheet.sheet.phonicsCircleTitle')}
        instruction={
          sameTarget
            ? t('materials.worksheet.sheet.phonicsCircleSame', { target: sameTarget })
            : t('materials.worksheet.sheet.phonicsCircleInstruction')
        }
      />
      <div className="space-y-[4mm]">
        {rows.map((row, i) => {
          const tone = cuteTone(i, color);
          return (
            <div key={i} className="print-card flex items-center gap-[5mm] px-[4mm] py-[3mm]" style={cuteCardStyle(tone)}>
              <CuteBadge n={startIndex + i + 1} tone={tone} />
              {row.imageUrl ? <Picture src={row.imageUrl} size={32} /> : <span style={{ width: '32mm' }} />}
              <div className="flex flex-wrap gap-[2.5mm]">
                {row.letters.map((l, k) => (
                  <span
                    key={k}
                    className="flex items-center justify-center bg-white"
                    style={{
                      width: '17mm',
                      height: '20mm',
                      border: `0.9mm solid ${tone.main}`,
                      borderRadius: '4mm',
                      fontFamily: FONT_LETTER,
                      fontWeight: 700,
                      fontSize: '48px',
                    }}
                  >
                    {l.ch}
                  </span>
                ))}
              </div>
              {!sameTarget && row.rule && (
                <span className="ml-auto shrink-0 rounded-full px-[3mm] py-[0.5mm] text-[13px]" style={{ background: '#ffffff', border: `0.4mm solid ${tone.main}` }}>
                  {row.rule}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <CuteFooter color={color} />
    </CutePage>
  );
}

/* ---------------- 다른 하나 찾기 ---------------- */

export function PhonicsOddCute({ rows, color, startIndex }: Common & { rows: OddRow[] }) {
  const { t } = useTranslation();
  return (
    <CutePage color={color}>
      <CuteHeader color={color} title={t('materials.worksheet.sheet.phonicsOddTitle')} instruction={t('materials.worksheet.sheet.phonicsOddInstruction')} />
      <div className="space-y-[5mm]">
        {rows.map((row, i) => {
          const tone = cuteTone(i, color);
          return (
            <div key={i} className="print-card flex items-center gap-[3mm] px-[3mm] py-[3mm]" style={cuteCardStyle(tone)}>
              <CuteBadge n={startIndex + i + 1} tone={tone} />
              <div className="grid flex-1 grid-cols-4 gap-[3mm]">
                {row.options.map((o, k) => (
                  <div
                    key={k}
                    className="flex flex-col items-center justify-center bg-white"
                    style={{ height: '50mm', border: `0.9mm solid ${tone.main}`, borderRadius: '6mm' }}
                  >
                    {o.imageUrl && <img src={o.imageUrl} alt="" className="object-contain" style={{ width: '30mm', height: '30mm' }} />}
                    <span className="mt-[1mm] font-bold leading-tight" style={{ fontFamily: FONT_LETTER, fontSize: '30px' }}>
                      {o.word}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <CuteFooter color={color} />
    </CutePage>
  );
}

/* ---------------- 라임 잇기 ---------------- */

export function RhymeCute({ page, color }: { page: MatchPage; color: boolean }) {
  const { t } = useTranslation();
  return (
    <CutePage color={color}>
      <CuteHeader color={color} title={t('materials.worksheet.sheet.phonicsRhymeTitle')} instruction={t('materials.worksheet.sheet.phonicsRhymeInstruction')} />
      <div className="flex justify-between gap-[26mm] px-[3mm]">
        {[page.left, page.right].map((side, col) => (
          <div key={col} className="flex flex-1 flex-col gap-[6mm]">
            {side.map((s, i) => {
              const tone = cuteTone(col === 0 ? i : i + 2, color);
              return (
                <div
                  key={i}
                  className="relative flex items-center gap-[3mm] px-[4mm]"
                  style={{ height: '32mm', background: tone.bg, border: `0.9mm solid ${tone.main}`, borderRadius: '7mm' }}
                >
                  <span
                    className="flex h-[11mm] w-[11mm] shrink-0 items-center justify-center rounded-full text-[19px] font-bold"
                    style={{ background: tone.main, color: '#fff', fontFamily: FONT_TITLE }}
                  >
                    {col === 0 ? i + 1 : String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 text-center font-bold" style={{ fontFamily: FONT_LETTER, fontSize: '40px' }}>
                    {s.text}
                  </span>
                  <span
                    className="absolute top-1/2 h-[5mm] w-[5mm] -translate-y-1/2 rounded-full bg-white"
                    style={{ border: `0.9mm solid ${tone.main}`, [col === 0 ? 'right' : 'left']: '-2.7mm' }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <CuteFooter color={color} />
    </CutePage>
  );
}
