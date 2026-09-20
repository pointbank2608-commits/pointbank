import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { decorUrl } from '../../lib/lineart';
import type {
  BlankRow,
  ColoringOptions,
  ColoringPage,
  CutPastePage,
  MatchPage,
  MatchSide,
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

function MatchCell({ side, label, dot }: { side: MatchSide; label: string; dot: 'left' | 'right' }) {
  return (
    <div
      className="relative flex h-[26mm] items-center gap-[3mm] rounded-lg border-2 border-black px-[3mm]"
    >
      <span className="w-[6mm] shrink-0 text-center text-[14px] font-bold">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {side.image ? <Picture src={side.image} className="h-[20mm] w-[20mm]" /> : <span className="text-center text-[17px] font-bold">{side.text}</span>}
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

/* ---------------- 진입점 ---------------- */

export default function WorksheetSheets({ data, includeAnswers }: Props) {
  switch (data.kind) {
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
