import { useTranslation } from 'react-i18next';
import type { ReaderCard } from '../../lib/cvcReaders';
import { parsePattern } from '../../lib/phonicsPattern';
import type { FullCardItem } from '../../lib/types';
import type {
  MatchPage,
  OddRow,
  PhonicsBlankRow,
  PhonicsCircleRow,
} from '../../lib/worksheetGenerators';
import { CuteBadge, CuteFooter, CuteHeader, CutePage } from './CuteStyle';
import TracingRow from './TracingRow';
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
              <div className="flex items-end" style={{ fontFamily: FONT_LETTER, fontWeight: 700, fontSize: row.word.length > 6 ? '46px' : '60px', lineHeight: 1 }}>
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

/** 글자 칸 폭(mm) — 긴 단어도 한 줄에 들어가게 글자 수에 맞춰 줄인다(최대 16mm, 최소 6.5mm). */
function tileMm(letterCount: number): number {
  return Math.max(6.5, Math.min(16, 100 / Math.max(1, letterCount) - 2));
}

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
              <div className="flex flex-wrap gap-[2mm]">
                {row.letters.map((l, k) => (
                  <span
                    key={k}
                    className="flex items-center justify-center bg-white"
                    style={{
                      width: `${tileMm(row.letters.length)}mm`,
                      height: '20mm',
                      border: `0.9mm solid ${tone.main}`,
                      borderRadius: '4mm',
                      fontFamily: FONT_LETTER,
                      fontWeight: 700,
                      fontSize: `${Math.round(tileMm(row.letters.length) * 3)}px`,
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

/* ---------------- 단어 리스트 · 사선지 (파닉스 전용) ---------------- */

/** 소리 규칙 글자를 강조해서 보여준다(컬러: 노란 바탕, 흑백: 굵은 밑줄). 표기가 없으면 그냥 단어. */
function PatternLetters({ item, color }: { item: FullCardItem; color: boolean }) {
  const parts = item.patternMarked ? parsePattern(item.patternMarked) : [{ text: item.word, marked: false }];
  return (
    <>
      {parts.map((p, k) =>
        p.marked ? (
          <span
            key={k}
            style={{
              background: color ? '#ffe066' : 'transparent',
              borderBottom: color ? 'none' : '1.4mm solid #1b1b1b',
              borderRadius: '2.5mm',
              padding: '0 1.5mm',
            }}
          >
            {p.text}
          </span>
        ) : (
          <span key={k}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function PhonicsListCute({
  rows,
  color,
  startIndex,
  showImage,
  showMeaning,
}: Common & { rows: FullCardItem[]; showImage: boolean; showMeaning: boolean }) {
  const { t } = useTranslation();
  return (
    <CutePage color={color}>
      <CuteHeader color={color} title={t('materials.worksheet.sheet.phonicsListTitle')} instruction={t('materials.worksheet.sheet.phonicsListInstruction')} />
      <div className="space-y-[4mm]">
        {rows.map((row, i) => {
          const tone = cuteTone(i, color);
          return (
            <div key={row.id} className="print-card flex items-center gap-[5mm] px-[4mm] py-[3mm]" style={cuteCardStyle(tone)}>
              <CuteBadge n={startIndex + i + 1} tone={tone} />
              {showImage && (row.imageUrl ? <Picture src={row.imageUrl} size={28} /> : <span style={{ width: '28mm' }} />)}
              <span style={{ fontFamily: FONT_LETTER, fontWeight: 700, fontSize: '54px', lineHeight: 1.1 }}>
                <PatternLetters item={row} color={color} />
              </span>
              {showMeaning && row.meaning && (
                <span className="ml-auto text-[24px] font-bold" style={{ fontFamily: FONT_TITLE }}>
                  {row.meaning}
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

export function PhonicsTracingCute({
  rows,
  color,
  startIndex,
  showImage,
  showMeaning,
}: Common & { rows: FullCardItem[]; showImage: boolean; showMeaning: boolean }) {
  const { t } = useTranslation();
  return (
    <CutePage color={color}>
      <CuteHeader color={color} title={t('materials.worksheet.sheet.phonicsTraceTitle')} instruction={t('materials.worksheet.sheet.phonicsTraceInstruction')} />
      <div className="space-y-[4mm]">
        {rows.map((row, i) => {
          const tone = cuteTone(i, color);
          return (
            <div key={row.id} className="print-card px-[4mm] py-[3mm]" style={cuteCardStyle(tone)}>
              <div className="mb-[2mm] flex items-center gap-[4mm]">
                <CuteBadge n={startIndex + i + 1} tone={tone} />
                <span style={{ fontFamily: FONT_LETTER, fontWeight: 700, fontSize: '44px', lineHeight: 1.1 }}>
                  <PatternLetters item={row} color={color} />
                </span>
                {showMeaning && row.meaning && (
                  <span className="text-[22px] font-bold" style={{ fontFamily: FONT_TITLE }}>
                    {row.meaning}
                  </span>
                )}
              </div>
              <div className="flex items-stretch gap-[5mm]">
                {showImage && (row.imageUrl ? <Picture src={row.imageUrl} size={44} /> : <span style={{ width: '44mm' }} />)}
                <div className="min-w-0 flex-1 rounded-[4mm] bg-white px-[3mm] py-[2mm]">
                  {[0, 1, 2].map((r) => (
                    <TracingRow key={r} word={row.word} trace={r === 0} last={r === 2} gapMm={4} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <CuteFooter color={color} />
    </CutePage>
  );
}

/* ---------------- I Can Read (CVC 읽기 카드) ---------------- */

export type ReaderImageMode = 'draw' | 'clay' | 'none';

/** 목표 단어 위에, 왼쪽엔 한 낱말씩 쌓인 줄, 오른쪽엔 그림 칸, 맨 아래엔 점선으로 따라 쓰는 문장 한 줄. */
export function ReaderCute({
  cards,
  color,
  startIndex,
  imageMode,
  imageOf,
}: Common & { cards: ReaderCard[]; imageMode: ReaderImageMode; imageOf: (word: string | null) => string | null }) {
  const { t } = useTranslation();
  return (
    <CutePage color={color}>
      <CuteHeader
        color={color}
        title={t('materials.worksheet.sheet.readerTitle')}
        instruction={t(imageMode === 'draw' ? 'materials.worksheet.sheet.readerInstructionDraw' : 'materials.worksheet.sheet.readerInstruction')}
      />
      <div className="space-y-[4mm]">
        {cards.map((card, i) => {
          const tone = cuteTone(i, color);
          const many = card.lines.length > 7;
          // 문장이 길수록 글씨를 조금 줄여 한 장에 카드 2개가 들어가게 한다.
          const linePx = many ? 22 : 26;
          const lineMm = many ? 6.2 : 7.4;
          const traceEm = Math.max(5.5, Math.min(10, 150 / (0.56 * Math.max(8, card.sentence.length))));
          const img = imageMode === 'clay' ? imageOf(card.word) : null;
          return (
            <div key={card.key} className="print-card px-[4mm] py-[3mm]" style={cuteCardStyle(tone)}>
              <div className="mb-[1.5mm] flex items-center gap-[3mm]">
                <CuteBadge n={startIndex + i + 1} tone={tone} />
                {card.word && (
                  <span className="flex-1 pr-[11mm] text-center font-bold" style={{ fontFamily: FONT_LETTER, fontSize: '34px', lineHeight: 1.1 }}>
                    {card.word}
                  </span>
                )}
              </div>
              <div className="flex items-stretch gap-[5mm]">
                <div className="min-w-0 flex-1">
                  {card.lines.map((line, k) => (
                    <div key={k} style={{ fontFamily: FONT_LETTER, fontSize: `${linePx}px`, lineHeight: `${lineMm}mm`, fontWeight: 700 }}>
                      {line}
                    </div>
                  ))}
                </div>
                {imageMode !== 'none' && (
                  <div
                    className="flex shrink-0 items-center justify-center self-center bg-white"
                    style={{ width: '38mm', height: '38mm', border: `1mm ${imageMode === 'draw' ? 'dashed' : 'solid'} ${tone.main}`, borderRadius: '7mm' }}
                  >
                    {img && <img src={img} alt="" className="h-full w-full object-contain p-[1.5mm]" />}
                  </div>
                )}
              </div>
              <div className="mt-[2mm] rounded-[4mm] bg-white px-[3mm] py-[1mm]">
                <TracingRow word={card.sentence} trace last emMm={traceEm} rowMm={12} />
              </div>
            </div>
          );
        })}
      </div>
      <CuteFooter color={color} />
    </CutePage>
  );
}
