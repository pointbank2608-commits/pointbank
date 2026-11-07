import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { buildWorksheet, DEFAULT_COLORING_OPTIONS, isWorksheetEmpty, NEW_WORKSHEET_KINDS, type NewWorksheetKind } from '../lib/worksheetGenerators';
import { buildPhonicsWorkbook, workbookPrintable } from '../data/phonicsWorkbook';
import { resolveWorkbookSelection, workbookOfMaterial } from '../data/cvcWorkbook';
import type { FullCardItem, MaterialSlide, PhonicsBankEntry } from '../lib/types';
import { CvcUnitPages } from './worksheets/CvcWorkbookSheets';
import BasicWorksheetSheets, { worksheetQuiz } from './worksheets/BasicWorksheetSheets';
import BingoPrintSheets, { buildBoards, neededWordCount } from './worksheets/BingoPrintSheets';
import FlashcardPrintSheets, { chunk, LAYOUTS } from './worksheets/FlashcardPrintSheets';
import MemoryCardsPrintSheets, { buildDeck } from './worksheets/MemoryCardsPrintSheets';
import WorksheetSheets from './worksheets/WorksheetSheets';

export const wordPrintMaterials = ['flashcards', 'memorycards', 'bingo'];
export const dedicatedPrintMaterials = [
  'airport', 'doctor', 'icecream', 'restaurant', 'lightning', 'mysterybox',
  'elementary800-original', 'elementary800-workbook', 'grammarworkbook',
];
const DedicatedLessonPrintSheets = lazy(() => import('./worksheets/DedicatedLessonPrintSheets'));
const NO_PHONICS_ENTRIES: PhonicsBankEntry[] = [];

export function workbookStep(id: string) {
  switch (id) {
    case 'phonicsstage1': return 1;
    case 'phonicsstage4workbook': return 4;
    case 'phonicsstage5workbook': return 5;
    default: return null;
  }
}

/** Scale real print markup. Explicit pages are kept intact; legacy lists break between cards. */
function PaperViewport({ children, large }: { children: ReactNode; large: boolean }) {
  const { t } = useTranslation();
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [offsets, setOffsets] = useState([0]);
  const paperWidth = 704;
  const pageHeight = 1024;
  useLayoutEffect(() => {
    const outer = viewport.current;
    const inner = paper.current;
    if (!outer || !inner) return;
    const measure = () => {
      setWidth(outer.clientWidth);
      const bounds = inner.getBoundingClientRect();
      const zoom = bounds.width / paperWidth;
      if (!zoom) return;
      const top = bounds.top;
      const explicit = [...inner.querySelectorAll<HTMLElement>('.print-board, .e800-sheet')];
      const cards = [...inner.querySelectorAll<HTMLElement>('.print-card')];
      const breaks = [0];
      if (explicit.length) {
        for (const sheet of explicit.slice(1)) breaks.push(Math.round((sheet.getBoundingClientRect().top - top) / zoom));
      } else {
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          const start = Math.round((rect.top - top) / zoom);
          if (start > breaks.at(-1)! && (rect.bottom - top) / zoom > breaks.at(-1)! + pageHeight) breaks.push(start);
        }
      }
      setOffsets(breaks);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    measure();
    return () => observer.disconnect();
  }, [children, width]);
  const active = Math.min(page, offsets.length - 1);
  const scale = Math.min(1, width / paperWidth, large ? 1 : 0.28);
  const visibleHeight = large ? pageHeight * scale : 118;
  const nextOffset = offsets[active + 1];
  const cropHeight = nextOffset === undefined ? visibleHeight : Math.min(visibleHeight, (nextOffset - offsets[active]) * scale);
  return <div className="lesson-paper-preview">
    {large && offsets.length > 1 && <div className="mb-2 flex items-center justify-center gap-4">
      <button type="button" disabled={active === 0} onClick={() => setPage(active - 1)}>{t('lessonUx.previousPage')}</button>
      <span aria-live="polite">{active + 1} / {offsets.length}</span>
      <button type="button" disabled={active + 1 === offsets.length} onClick={() => setPage(active + 1)}>{t('lessonUx.nextPage')}</button>
    </div>}
    <div ref={viewport} className="lesson-paper-viewport" style={{ height: visibleHeight }}>
      <div className="relative mx-auto overflow-hidden" style={{ width: paperWidth * scale, height: cropHeight }}>
        <div className="absolute left-0 top-0" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: paperWidth }}>
          <div ref={paper} style={{ position: 'relative', top: -offsets[active] }}>{children}</div>
        </div>
      </div>
    </div>
  </div>;
}

export default function LessonPrintPreview({ slide, cards, entries = NO_PHONICS_ENTRIES, large = false }: {
  slide: MaterialSlide;
  cards: FullCardItem[];
  entries?: PhonicsBankEntry[];
  large?: boolean;
}) {
  const { t } = useTranslation();
  const book = workbookOfMaterial(slide.materialId);
  const step = workbookStep(slide.materialId);
  const words = slide.words?.length ? slide.words : cards;
  const tab = slide.worksheetTab ?? 'list';
  const pages = useMemo(() => {
    const options = slide.worksheetOptions ?? {};
    if (slide.materialId === 'elementary800-original') {
      return <div className="print-board bg-white">
        <img className="mx-auto block w-full" src="/workbooks/elementary800/verbs-first-activity.webp" alt={t('elementary800.preview')} />
      </div>;
    }
    if (dedicatedPrintMaterials.includes(slide.materialId)) {
      return <Suspense fallback={<p className="p-3 text-sm">{t('common.loading')}</p>}>
        <DedicatedLessonPrintSheets materialId={slide.materialId} />
      </Suspense>;
    }
    if (book) {
      const selection = resolveWorkbookSelection(book.id, slide);
      return (selection.requested ? selection.units : book.units.slice(0, 1))
        .map(unit => <CvcUnitPages key={unit.id} unit={unit} />);
    }
    if (step) {
      const units = buildPhonicsWorkbook(entries, step).filter(workbookPrintable);
      const selected = slide.phonicsUnitIds?.length ? units.filter(unit => slide.phonicsUnitIds?.includes(unit.id)) : units.slice(0, 1);
      return selected.map(unit => <CvcUnitPages key={unit.id} unit={unit} />);
    }
    if (slide.materialId === 'flashcards' && words.length) {
      const layout = LAYOUTS[2];
      return <FlashcardPrintSheets pages={chunk(words, layout.perPage)} layout={layout} />;
    }
    if (slide.materialId === 'memorycards' && words.length) return <MemoryCardsPrintSheets deck={buildDeck(words)} />;
    if (slide.materialId === 'bingo') {
      const gridSize = words.length < neededWordCount(4) ? 3 : 4;
      if (words.length < neededWordCount(gridSize)) return null;
      return <BingoPrintSheets boards={buildBoards(words.map(word => word.word), gridSize, 20)} gridSize={gridSize} />;
    }
    if (slide.materialId !== 'worksheet' && slide.materialId !== 'library') return null;
    if ((NEW_WORKSHEET_KINDS as readonly string[]).includes(tab)) {
      const coloring = {
        ...DEFAULT_COLORING_OPTIONS,
        title: options.coloringTitle ?? DEFAULT_COLORING_OPTIONS.title,
        labelMode: options.coloringLabelMode ?? DEFAULT_COLORING_OPTIONS.labelMode,
        perPage: options.coloringPerPage ?? DEFAULT_COLORING_OPTIONS.perPage,
        decorTheme: options.coloringDecorTheme ?? DEFAULT_COLORING_OPTIONS.decorTheme,
      };
      const data = buildWorksheet(tab as NewWorksheetKind, words, 1, { coloring, sheetTitle: coloring.title, askTemplate: options.askTemplate ?? 'like' });
      if (!data || isWorksheetEmpty(data)) return null;
      return <WorksheetSheets data={data} includeAnswers={options.includeAnswers ?? true} matchMeaning={options.matchMeaning ?? false} />;
    }
    if (!words.length) return null;
    return <BasicWorksheetSheets tab={tab} words={words} options={options} quiz={tab === 'quiz' ? worksheetQuiz(words) : []} />;
  }, [book, step, entries, slide, tab, words, t]);
  if (!pages || (Array.isArray(pages) && !pages.length)) return <p className="p-3 text-sm">{t('lessonUx.previewUnavailable')}</p>;
  return <>
    {large && slide.materialId === 'elementary800-original' && <a className="block p-3 text-center font-bold text-primary underline" href="/workbooks/elementary800/verbs-level1-4.pdf#page=2" target="_blank" rel="noopener">{t('elementary800.open')} ↗</a>}
    <PaperViewport large={large}>{pages}</PaperViewport>
  </>;
}
