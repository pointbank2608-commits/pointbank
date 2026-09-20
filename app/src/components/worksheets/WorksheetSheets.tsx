import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { decorUrl } from '../../lib/lineart';
import { BOARD_COLS, BOARD_ROWS } from '../../lib/worksheetGenerators';
import type {
  AskRow,
  AskTemplate,
  BlankRow,
  BoardCell,
  ChoiceRow,
  ColoringOptions,
  ColoringPage,
  CutPastePage,
  SentenceRow,
  TrueFalseRow,
  MatchPage,
  MatchSide,
  MiniBook,
  UnscrambleRow,
  WordSearchPage,
  WorksheetData,
} from '../../lib/worksheetGenerators';
import type { FullCardItem } from '../../lib/types';

/**
 * 인쇄용 워크시트 6종(선 잇기·낱말 찾기·글자 순서 바꾸기·빈칸 채우기·분류하기·오려 붙이기)의 화면.
 * 페이지 하나 = <Page> 하나이고, 인쇄할 때 페이지마다 새 장으로 넘어간다(.print-board).
 * 문제 데이터는 lib/worksheetGenerators.ts 가 만들어서 넘겨준다.
 */

interface Props {
  data: WorksheetData;
  includeAnswers: boolean;
}

function Page({ children }: { children: ReactNode }) {
  return (
    <section className="print-board mb-6 rounded-lg border border-outline-variant/40 bg-white p-[8mm] text-black shadow-sm print:mb-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {children}
    </section>
  );
}

function Header({ title, instruction }: { title: string; instruction?: string }) {
  const { t } = useTranslation();
  return (
    <header className="mb-[5mm]">
      <div className="flex items-end justify-between gap-[6mm]">
        <h3 className="rounded-full border-2 border-deep-navy px-[6mm] py-[1.5mm] text-[20px] font-bold text-deep-navy">{title}</h3>
        <div className="flex gap-[6mm] text-[13px] text-black">
          <span className="flex items-end gap-1">
            {t('materials.worksheet.sheet.name')}: <span className="inline-block w-[36mm] border-b border-black" />
          </span>
          <span className="flex items-end gap-1">
            {t('materials.worksheet.sheet.date')}: <span className="inline-block w-[26mm] border-b border-black" />
          </span>
        </div>
      </div>
      {instruction && (
        <p className="mt-[4mm] rounded-md border border-outline-variant bg-surface-container-low px-[4mm] py-[2mm] text-[14px] text-black">
          {instruction}
        </p>
      )}
    </header>
  );
}

function Picture({ src, className = 'h-[20mm] w-[20mm]' }: { src: string; className?: string }) {
  return <img src={src} alt="" className={`${className} shrink-0 object-contain`} />;
}

/* ---------------- 색칠하기 ---------------- */

function DecorImg({ id, className }: { id: string | undefined; className: string }) {
  if (!id) return <span className={className} />;
  return <img src={decorUrl(id)} alt="" className={`${className} object-contain`} />;
}

function ColoringSheet({ page, options }: { page: ColoringPage; options: ColoringOptions }) {
  const { t } = useTranslation();
  return (
    <Page>
      <div className="flex h-[262mm] flex-col rounded-[6mm] border-[1.2mm] border-black p-[5mm]">
        <div className="flex h-[26mm] shrink-0 items-center gap-[4mm]">
          <DecorImg id={page.decor[0]} className="h-[22mm] w-[26mm] shrink-0" />
          <div className="flex-1 rounded-[6mm] border-[0.8mm] border-black px-[4mm] py-[2mm] text-center text-[30px] font-extrabold leading-tight text-black">
            {options.title}
          </div>
          <DecorImg id={page.decor[1]} className="h-[22mm] w-[26mm] shrink-0" />
        </div>
        <div className="flex shrink-0 justify-end gap-[6mm] py-[2mm] text-[13px] text-black">
          <span className="flex items-end gap-1">
            {t('materials.worksheet.sheet.name')}: <span className="inline-block w-[40mm] border-b border-black" />
          </span>
          <span className="flex items-end gap-1">
            {t('materials.worksheet.sheet.date')}: <span className="inline-block w-[28mm] border-b border-black" />
          </span>
        </div>
        <div
          className="grid min-h-0 flex-1 gap-x-[4mm] gap-y-[2mm]"
          style={{ gridTemplateColumns: `repeat(${page.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${page.rows}, minmax(0, 1fr))` }}
        >
          {page.items.map((item) => (
            <div key={item.src} className="flex min-h-0 flex-col items-center justify-end">
              <img src={item.src} alt="" className="min-h-0 w-full flex-1 object-contain" />
              {options.labelMode === 'word' && <div className="mt-[1mm] text-[24px] font-extrabold leading-none text-black">{item.word}</div>}
              {options.labelMode === 'write' && <div className="mt-[3mm] w-[70%] border-b-2 border-black" />}
              {options.labelMode !== 'none' && <div className="h-[2mm]" />}
            </div>
          ))}
        </div>
        <div className="flex h-[16mm] shrink-0 items-end justify-around">
          <DecorImg id={page.decor[2]} className="h-[14mm] w-[30mm]" />
          <DecorImg id={page.decor[3]} className="h-[14mm] w-[30mm]" />
          <DecorImg id={page.decor[4]} className="h-[14mm] w-[30mm]" />
        </div>
      </div>
    </Page>
  );
}

/* ---------------- 선 잇기 ---------------- */

function MatchCell({ side, label, dot, small = false }: { side: MatchSide; label: string; dot: 'left' | 'right'; small?: boolean }) {
  return (
    <div
      className="relative flex h-[26mm] items-center gap-[3mm] rounded-lg border-2 border-black px-[3mm]"
    >
      <span className="w-[6mm] shrink-0 text-center text-[14px] font-bold">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {side.image ? <Picture src={side.image} className="h-[20mm] w-[20mm]" /> : <span className={`text-center font-bold ${small ? 'text-[14px] leading-tight' : 'text-[17px]'}`}>{side.text}</span>}
      </div>
      <span
        className={`absolute top-1/2 h-[3.5mm] w-[3.5mm] -translate-y-1/2 rounded-full border-2 border-black bg-white ${
          dot === 'left' ? '-right-[2mm]' : '-left-[2mm]'
        }`}
      />
    </div>
  );
}

function MatchSheet({ page, pictureMode }: { page: MatchPage; pictureMode: boolean }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header
        title={t('materials.worksheet.sheet.matchTitle')}
        instruction={t(pictureMode ? 'materials.worksheet.sheet.matchPictureWord' : 'materials.worksheet.sheet.matchWordMeaning')}
      />
      <div className="flex justify-between gap-[30mm] px-[4mm]">
        <div className="flex flex-1 flex-col gap-[5mm]">
          {page.left.map((side, i) => (
            <MatchCell key={i} side={side} label={String(i + 1)} dot="left" />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-[5mm]">
          {page.right.map((side, i) => (
            <MatchCell key={i} side={side} label={String.fromCharCode(65 + i)} dot="right" />
          ))}
        </div>
      </div>
    </Page>
  );
}

function MatchAnswer({ pages }: { pages: MatchPage[] }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.answerKey')} />
      <div className="space-y-[5mm] text-[15px]">
        {pages.map((p, pi) => (
          <div key={pi} className="flex flex-wrap gap-x-[8mm] gap-y-[2mm]">
            {p.answer.map((a, i) => (
              <span key={i}>
                {i + 1} – {String.fromCharCode(65 + a)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ---------------- 낱말 찾기 ---------------- */

function WordSearchGrid({ page, highlight }: { page: WordSearchPage; highlight: boolean }) {
  const marked = new Set(highlight ? page.words.flatMap((w) => w.cells.map(([r, c]) => `${r},${c}`)) : []);
  const cell = 150 / page.size; // 그리드 전체 폭 ≈ 150mm
  return (
    <div className="mx-auto w-fit border-2 border-black">
      {page.grid.map((row, r) => (
        <div key={r} className="flex">
          {row.map((ch, c) => (
            <div
              key={c}
              className={`flex items-center justify-center border border-outline-variant text-[15px] font-bold ${
                marked.has(`${r},${c}`) ? 'bg-warm-yellow' : ''
              }`}
              style={{ width: `${cell}mm`, height: `${cell}mm` }}
            >
              {ch}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function WordSearchSheet({ page, answer }: { page: WordSearchPage; answer: boolean }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header
        title={answer ? t('materials.worksheet.sheet.answerKey') : t('materials.worksheet.sheet.wordSearchTitle')}
        instruction={answer ? undefined : t('materials.worksheet.sheet.wordSearchInstruction')}
      />
      <WordSearchGrid page={page} highlight={answer} />
      <div className="mt-[6mm] grid grid-cols-3 gap-x-[6mm] gap-y-[2mm] px-[4mm] text-[15px]">
        {page.words.map((w) => (
          <span key={w.text} className="flex items-center gap-2">
            <span className="inline-block h-[4mm] w-[4mm] rounded-sm border border-black" />
            {w.display}
          </span>
        ))}
      </div>
      {page.skipped.length > 0 && !answer && (
        <p className="no-print mt-3 text-[12px] text-on-surface-variant">
          {t('materials.worksheet.skippedWords', { words: page.skipped.join(', ') })}
        </p>
      )}
    </Page>
  );
}

/* ---------------- 글자 순서 바꾸기 ---------------- */

function UnscrambleSheet({ rows, startIndex }: { rows: UnscrambleRow[]; startIndex: number }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.unscrambleTitle')} instruction={t('materials.worksheet.sheet.unscrambleInstruction')} />
      <div className="space-y-[4mm]">
        {rows.map((row, i) => (
          <div key={i} className="print-card flex items-center gap-[4mm] border-b border-outline-variant pb-[3mm]">
            <span className="w-[8mm] shrink-0 text-[16px] font-bold">{startIndex + i + 1}.</span>
            {row.imageUrl ? <Picture src={row.imageUrl} className="h-[18mm] w-[18mm]" /> : <span className="w-[18mm] shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-[2mm]">
                {[...row.scrambled].map((ch, k) => (
                  <span key={k} className="flex h-[9mm] w-[9mm] items-center justify-center rounded border-2 border-black text-[17px] font-bold">
                    {ch}
                  </span>
                ))}
              </div>
              <div className="mt-[4mm] border-b border-black" />
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function UnscrambleAnswer({ pages }: { pages: UnscrambleRow[][] }) {
  const { t } = useTranslation();
  const all = pages.flat();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.answerKey')} />
      <div className="columns-2 gap-[10mm] text-[15px]">
        {all.map((row, i) => (
          <div key={i} className="print-card py-[1mm]">
            {i + 1}. {row.word}
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ---------------- 빈칸 채우기 ---------------- */

function FillBlankSheet({ rows, startIndex }: { rows: BlankRow[]; startIndex: number }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.fillBlankTitle')} instruction={t('materials.worksheet.sheet.fillBlankInstruction')} />
      <div className="space-y-[4mm]">
        {rows.map((row, i) => (
          <div key={i} className="print-card flex items-center gap-[4mm] border-b border-outline-variant pb-[3mm]">
            <span className="w-[8mm] shrink-0 text-[16px] font-bold">{startIndex + i + 1}.</span>
            {row.imageUrl ? <Picture src={row.imageUrl} className="h-[18mm] w-[18mm]" /> : <span className="w-[18mm] shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-end gap-[2mm]">
                {row.slots.map((slot, k) =>
                  slot.ch === ' ' ? (
                    <span key={k} className="w-[5mm]" />
                  ) : (
                    <span
                      key={k}
                      className={`flex h-[10mm] w-[9mm] items-end justify-center pb-[0.5mm] text-[20px] font-bold ${
                        slot.blank ? 'border-b-2 border-black' : ''
                      }`}
                    >
                      {slot.blank ? '' : slot.ch}
                    </span>
                  ),
                )}
              </div>
              {row.meaning && <div className="mt-[1mm] text-[12px] text-on-surface-variant">{row.meaning}</div>}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function FillBlankAnswer({ pages }: { pages: BlankRow[][] }) {
  const { t } = useTranslation();
  const all = pages.flat();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.answerKey')} />
      <div className="columns-2 gap-[10mm] text-[15px]">
        {all.map((row, i) => (
          <div key={i} className="print-card py-[1mm]">
            {i + 1}. {row.word}
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ---------------- 분류하기 ---------------- */

function GroupingSheet({ groups, pool, answer }: { groups: { name: string; words: FullCardItem[] }[]; pool: FullCardItem[]; answer: boolean }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header
        title={answer ? t('materials.worksheet.sheet.answerKey') : t('materials.worksheet.sheet.groupingTitle')}
        instruction={answer ? undefined : t('materials.worksheet.sheet.groupingInstruction')}
      />
      <div className="grid gap-[5mm]" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
        {groups.map((g) => (
          <div key={g.name} className="rounded-lg border-2 border-black">
            <div className="border-b-2 border-black bg-surface-container-low px-[3mm] py-[2mm] text-center text-[17px] font-bold">{g.name}</div>
            <div className="min-h-[95mm] space-y-[3mm] p-[3mm]">
              {answer ? (
                g.words.map((w) => (
                  <div key={w.id} className="text-[15px]">
                    {w.word}
                  </div>
                ))
              ) : (
                Array.from({ length: g.words.length }, (_, i) => <div key={i} className="mt-[10mm] border-b border-outline-variant" />)
              )}
            </div>
          </div>
        ))}
      </div>
      {!answer && (
        <div className="mt-[8mm]">
          <div className="mb-[2mm] text-[14px] font-bold">{t('materials.worksheet.sheet.wordBank')}</div>
          <div className="flex flex-wrap gap-[4mm] rounded-lg border-2 border-dashed border-black p-[4mm]">
            {pool.map((w) => (
              <div key={w.id} className="flex flex-col items-center gap-[1mm]">
                {w.imageUrl && <Picture src={w.imageUrl} className="h-[16mm] w-[16mm]" />}
                <span className="text-[15px] font-bold">{w.word}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}

/* ---------------- 오려 붙이기 ---------------- */

function CutPasteSheets({ page, answer }: { page: CutPastePage; answer: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <Page>
        <Header title={t('materials.worksheet.sheet.cutPasteTitle')} instruction={t('materials.worksheet.sheet.pasteInstruction')} />
        <div className="grid grid-cols-2 gap-[6mm]">
          {page.targets.map((w) => (
            <div key={w.id} className="print-card">
              <div className="flex h-[52mm] items-center justify-center rounded-lg border-2 border-dashed border-black">
                {answer && w.imageUrl && <Picture src={w.imageUrl} className="h-[44mm] w-[44mm]" />}
              </div>
              <div className="mt-[2mm] text-center text-[18px] font-bold">{w.word}</div>
            </div>
          ))}
        </div>
      </Page>
      {!answer && (
        <Page>
          <Header title={t('materials.worksheet.sheet.cutPasteTitle')} instruction={t('materials.worksheet.sheet.cutInstruction')} />
          <div className="grid grid-cols-2 gap-[6mm]">
            {page.pieces.map((w) => (
              <div key={w.id} className="print-card flex h-[58mm] items-center justify-center rounded-lg border-2 border-dashed border-outline">
                {w.imageUrl && <Picture src={w.imageUrl} className="h-[50mm] w-[50mm]" />}
              </div>
            ))}
          </div>
        </Page>
      )}
    </>
  );
}


/* ---------------- 문장 순서 바꾸기 ---------------- */

function SentenceSheet({ rows, startIndex }: { rows: SentenceRow[]; startIndex: number }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.sentenceTitle')} instruction={t('materials.worksheet.sheet.sentenceInstruction')} />
      <div className="space-y-[6mm]">
        {rows.map((row, i) => (
          <div key={i} className="print-card">
            <div className="flex items-start gap-[3mm]">
              <span className="w-[8mm] shrink-0 pt-[1mm] text-[16px] font-bold">{startIndex + i + 1}.</span>
              <div className="flex flex-wrap gap-[2.5mm]">
                {row.tokens.map((tok, k) => (
                  <span key={k} className="rounded border-2 border-black px-[3mm] py-[1mm] text-[17px] font-bold">
                    {tok}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-[11mm] mt-[6mm] border-b border-black" />
          </div>
        ))}
      </div>
    </Page>
  );
}

function SentenceAnswer({ pages }: { pages: SentenceRow[][] }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.answerKey')} />
      <div className="space-y-[2mm] text-[15px]">
        {pages.flat().map((row, i) => (
          <div key={i} className="print-card">
            {i + 1}. {row.answer}
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ---------------- 객관식 ---------------- */

function ChoiceSheet({ rows, startIndex }: { rows: ChoiceRow[]; startIndex: number }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.choiceTitle')} instruction={t('materials.worksheet.sheet.choiceInstruction')} />
      <div className="space-y-[5mm]">
        {rows.map((row, i) => (
          <div key={i} className="print-card flex items-center gap-[4mm] border-b border-outline-variant pb-[4mm]">
            <span className="w-[8mm] shrink-0 text-[16px] font-bold">{startIndex + i + 1}.</span>
            {row.imageUrl ? (
              <Picture src={row.imageUrl} className="h-[26mm] w-[26mm]" />
            ) : (
              <span className="min-w-[26mm] shrink-0 text-center text-[20px] font-extrabold">{row.prompt}</span>
            )}
            <div className="min-w-0 flex-1">
              {row.sentence && <div className="mb-[3mm] text-[18px] font-bold leading-snug">{row.sentence}</div>}
              <div className="flex flex-wrap gap-x-[8mm] gap-y-[2mm] text-[17px]">
                {row.choices.map((c, k) => (
                  <span key={k} className="flex items-center gap-[2mm]">
                    <span className="font-bold">{String.fromCharCode(65 + k)}.</span> {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function ChoiceAnswer({ pages }: { pages: ChoiceRow[][] }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.answerKey')} />
      <div className="flex flex-wrap gap-x-[8mm] gap-y-[2mm] text-[15px]">
        {pages.flat().map((row, i) => (
          <span key={i}>
            {i + 1} – {String.fromCharCode(65 + row.correct)}
          </span>
        ))}
      </div>
    </Page>
  );
}

/* ---------------- 참·거짓 ---------------- */

function TrueFalseSheet({ rows, startIndex }: { rows: TrueFalseRow[]; startIndex: number }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.tfTitle')} instruction={t('materials.worksheet.sheet.tfInstruction')} />
      <div className="grid grid-cols-2 gap-x-[6mm] gap-y-[5mm]">
        {rows.map((row, i) => (
          <div key={i} className="print-card relative rounded-lg border-2 border-black p-[3mm]">
            <span className="absolute left-[3mm] top-[2mm] text-[15px] font-bold">{startIndex + i + 1}.</span>
            <div className="flex min-h-[32mm] items-center justify-center">
              {row.imageUrl ? (
                <Picture src={row.imageUrl} className="h-[32mm] w-[32mm]" />
              ) : (
                <span className="text-[22px] font-extrabold">{row.prompt}</span>
              )}
            </div>
            <div className="mt-[2mm] text-center text-[19px] font-extrabold">{row.shown}</div>
            <div className="mt-[3mm] flex justify-center gap-[10mm]">
              {['T', 'F'].map((c) => (
                <span key={c} className="flex h-[10mm] w-[10mm] items-center justify-center rounded-full border-2 border-black text-[18px] font-bold">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function TrueFalseAnswer({ pages }: { pages: TrueFalseRow[][] }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.answerKey')} />
      <div className="flex flex-wrap gap-x-[8mm] gap-y-[2mm] text-[15px]">
        {pages.flat().map((row, i) => (
          <span key={i}>
            {i + 1} – {row.answer ? 'T' : 'F'}
          </span>
        ))}
      </div>
    </Page>
  );
}


/* ---------------- 3차: 문장 읽고 잇기 ---------------- */

function ReadMatchSheet({ page }: { page: MatchPage }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.readMatchTitle')} instruction={t('materials.worksheet.sheet.readMatchInstruction')} />
      <div className="flex justify-between gap-[30mm] px-[4mm]">
        <div className="flex flex-1 flex-col gap-[5mm]">
          {page.left.map((side, i) => (
            <MatchCell key={i} side={side} label={String(i + 1)} dot="left" small />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-[5mm]">
          {page.right.map((side, i) => (
            <MatchCell key={i} side={side} label={String.fromCharCode(65 + i)} dot="right" />
          ))}
        </div>
      </div>
    </Page>
  );
}

/* ---------------- 3차: 짝 인터뷰 ---------------- */

function AskSheet({ rows, template }: { rows: AskRow[]; template: AskTemplate }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={t('materials.worksheet.sheet.askTitle')} instruction={t(`materials.worksheet.sheet.ask_${template}`)} />
      <table className="w-full border-collapse text-black">
        <thead>
          <tr>
            <th className="w-[62mm] border-2 border-black bg-surface-container-low" />
            {[0, 1, 2].map((c) => (
              <th key={c} className="h-[12mm] border-2 border-black bg-surface-container-low px-[2mm] text-left align-bottom text-[12px] font-normal">
                {t('materials.worksheet.sheet.friendName')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="print-card">
              <td className="h-[24mm] border-2 border-black px-[3mm] py-[1mm]">
                <div className="flex items-center gap-[3mm]">
                  {row.imageUrl ? <Picture src={row.imageUrl} className="h-[20mm] w-[20mm]" /> : null}
                  <span className="text-[19px] font-extrabold">{row.word}</span>
                </div>
              </td>
              {[0, 1, 2].map((c) => (
                <td key={c} className="border-2 border-black">
                  <div className="flex justify-center gap-[6mm]">
                    {['O', 'X'].map((mark) => (
                      <span key={mark} className="flex h-[10mm] w-[10mm] items-center justify-center rounded-full border-2 border-black text-[15px] font-bold">
                        {mark}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

/* ---------------- 3차: 보드게임 ---------------- */

/** 뱀 모양 칸 배치: 1번 줄은 왼→오, 2번 줄은 오→왼 … 그리드 위치로 바꿔 준다. */
function boardPosition(n: number): { row: number; col: number } {
  const idx = n - 1;
  const row = Math.floor(idx / BOARD_COLS);
  const c = idx % BOARD_COLS;
  return { row, col: row % 2 === 0 ? c : BOARD_COLS - 1 - c };
}

function BoardCellView({ cell }: { cell: BoardCell }) {
  const { t } = useTranslation();
  const special: Record<string, string> = {
    start: 'START',
    finish: 'FINISH',
    again: t('materials.worksheet.sheet.boardAgain'),
    back: t('materials.worksheet.sheet.boardBack'),
    skip: t('materials.worksheet.sheet.boardSkip'),
  };
  const isSpecial = cell.kind !== 'word';
  return (
    <div
      className={`relative flex h-full flex-col items-center justify-center rounded-lg border-2 border-black px-[1mm] ${
        cell.kind === 'start' || cell.kind === 'finish' ? 'bg-surface-container-high' : ''
      }`}
    >
      <span className="absolute left-[1.5mm] top-[0.5mm] text-[11px] font-bold">{cell.n}</span>
      {cell.kind === 'word' ? (
        <>
          {cell.imageUrl && <Picture src={cell.imageUrl} className="h-[19mm] w-[19mm]" />}
          <span className="mt-[0.5mm] text-center text-[14px] font-extrabold leading-tight">{cell.word}</span>
        </>
      ) : (
        isSpecial && <span className="px-[1mm] text-center text-[15px] font-extrabold leading-tight">{special[cell.kind]}</span>
      )}
    </div>
  );
}

function BoardSheet({ cells, title }: { cells: BoardCell[]; title: string }) {
  const { t } = useTranslation();
  return (
    <Page>
      <Header title={title} instruction={t('materials.worksheet.sheet.boardRules')} />
      <div
        className="grid h-[212mm] gap-[2mm]"
        style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${BOARD_ROWS}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const { row, col } = boardPosition(cell.n);
          return (
            <div key={cell.n} style={{ gridRow: row + 1, gridColumn: col + 1 }}>
              <BoardCellView cell={cell} />
            </div>
          );
        })}
      </div>
    </Page>
  );
}

/* ---------------- 3차: 미니북 ---------------- */

function BookPanel({ page, book, upsideDown }: { page: number; book: MiniBook; upsideDown: boolean }) {
  const { t } = useTranslation();
  const content = (() => {
    if (page === 1) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-[3mm] p-[4mm] text-center">
          <div className="text-[22px] font-extrabold leading-tight">{book.title}</div>
          {book.coverImage && <Picture src={book.coverImage} className="h-[40mm] w-[40mm]" />}
          <div className="mt-[2mm] flex w-full items-end gap-1 text-[12px]">
            {t('materials.worksheet.sheet.name')}: <span className="inline-block flex-1 border-b border-black" />
          </div>
        </div>
      );
    }
    if (page === 8) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-[4mm] p-[4mm] text-center">
          <div className="text-[24px] font-extrabold">{t('materials.worksheet.sheet.theEnd')}</div>
          <div className="text-[12px]">{t('materials.worksheet.sheet.drawFavorite')}</div>
          <div className="h-[36mm] w-full rounded-lg border-2 border-dashed border-black" />
        </div>
      );
    }
    const entry = book.pages[page - 2];
    if (!entry) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-[3mm] p-[4mm]">
          <div className="h-[48mm] w-full rounded-lg border-2 border-dashed border-black" />
          <div className="w-full border-b border-black pt-[8mm]" />
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[2mm] p-[4mm] text-center">
        {entry.imageUrl ? <Picture src={entry.imageUrl} className="h-[46mm] w-[46mm]" /> : <div className="h-[10mm]" />}
        <div className="text-[26px] font-extrabold leading-tight">{entry.word}</div>
        {entry.meaning && <div className="text-[13px] text-black/80">{entry.meaning}</div>}
        {entry.example && <div className="mt-[1mm] text-[12px] leading-snug">{entry.example}</div>}
      </div>
    );
  })();
  return (
    <div className="relative h-full border border-dashed border-black">
      <div className={`h-full ${upsideDown ? 'rotate-180' : ''}`}>{content}</div>
    </div>
  );
}

// 가로 A4 한 장을 접어 만드는 8쪽 책: 위 줄은 180° 돌려서, 아래 줄은 그대로 놓는다.
const BOOK_LAYOUT: { page: number; upsideDown: boolean }[] = [
  { page: 5, upsideDown: true },
  { page: 4, upsideDown: true },
  { page: 3, upsideDown: true },
  { page: 2, upsideDown: true },
  { page: 6, upsideDown: false },
  { page: 7, upsideDown: false },
  { page: 8, upsideDown: false },
  { page: 1, upsideDown: false },
];

function MiniBookSheet({ book }: { book: MiniBook }) {
  return (
    <section className="print-board print-landscape landscape-preview mb-6 rounded-lg border border-outline-variant/40 bg-white p-[6mm] text-black shadow-sm print:mb-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="relative mx-auto grid h-[190mm] w-[277mm] grid-cols-4 grid-rows-2">
        {BOOK_LAYOUT.map((slot) => (
          <BookPanel key={slot.page} page={slot.page} book={book} upsideDown={slot.upsideDown} />
        ))}
        {/* 가운데 자르는 선(가운데 두 칸 사이) */}
        <div className="pointer-events-none absolute left-[25%] right-[25%] top-1/2 border-t-2 border-dashed border-black" />
      </div>
    </section>
  );
}

/* ---------------- 진입점 ---------------- */



export default function WorksheetSheets({ data, includeAnswers }: Props) {
  switch (data.kind) {
    case 'miniBook':
      return (
        <>
          {data.books.map((b, i) => (
            <MiniBookSheet key={i} book={b} />
          ))}
        </>
      );
    case 'askAnswer':
      return (
        <>
          {data.pages.map((rows, i) => (
            <AskSheet key={i} rows={rows} template={data.template} />
          ))}
        </>
      );
    case 'boardGame':
      return data.cells ? <BoardSheet cells={data.cells} title={data.title} /> : null;
    case 'readMatch':
      return (
        <>
          {data.pages.map((p, i) => (
            <ReadMatchSheet key={i} page={p} />
          ))}
          {includeAnswers && <MatchAnswer pages={data.pages} />}
        </>
      );
    case 'coloring':
      return (
        <>
          {data.pages.map((p, i) => (
            <ColoringSheet key={i} page={p} options={data.options} />
          ))}
        </>
      );
    case 'match': {
      const pictureMode = data.pages.some((p) => p.left.some((s) => s.image));
      return (
        <>
          {data.pages.map((p, i) => (
            <MatchSheet key={i} page={p} pictureMode={pictureMode} />
          ))}
          {includeAnswers && <MatchAnswer pages={data.pages} />}
        </>
      );
    }
    case 'wordSearch':
      return (
        <>
          {data.pages.map((p, i) => (
            <WordSearchSheet key={i} page={p} answer={false} />
          ))}
          {includeAnswers && data.pages.map((p, i) => <WordSearchSheet key={`a${i}`} page={p} answer />)}
        </>
      );
    case 'unscramble':
      return (
        <>
          {data.pages.map((rows, i) => (
            <UnscrambleSheet key={i} rows={rows} startIndex={i * 8} />
          ))}
          {includeAnswers && <UnscrambleAnswer pages={data.pages} />}
        </>
      );
    case 'fillBlank':
      return (
        <>
          {data.pages.map((rows, i) => (
            <FillBlankSheet key={i} rows={rows} startIndex={i * 8} />
          ))}
          {includeAnswers && <FillBlankAnswer pages={data.pages} />}
        </>
      );
    case 'grouping':
      return data.sheet ? (
        <>
          <GroupingSheet groups={data.sheet.groups} pool={data.sheet.pool} answer={false} />
          {includeAnswers && <GroupingSheet groups={data.sheet.groups} pool={data.sheet.pool} answer />}
        </>
      ) : null;
    case 'sentence':
      return (
        <>
          {data.pages.map((rows, i) => (
            <SentenceSheet key={i} rows={rows} startIndex={i * 7} />
          ))}
          {includeAnswers && <SentenceAnswer pages={data.pages} />}
        </>
      );
    case 'multipleChoice':
      return (
        <>
          {data.pages.map((rows, i) => (
            <ChoiceSheet key={i} rows={rows} startIndex={i * 6} />
          ))}
          {includeAnswers && <ChoiceAnswer pages={data.pages} />}
        </>
      );
    case 'trueFalse':
      return (
        <>
          {data.pages.map((rows, i) => (
            <TrueFalseSheet key={i} rows={rows} startIndex={i * 8} />
          ))}
          {includeAnswers && <TrueFalseAnswer pages={data.pages} />}
        </>
      );
    case 'cutPaste':
      return (
        <>
          {data.pages.map((p, i) => (
            <CutPasteSheets key={i} page={p} answer={false} />
          ))}
          {includeAnswers && data.pages.map((p, i) => <CutPasteSheets key={`a${i}`} page={p} answer />)}
        </>
      );
  }
}
