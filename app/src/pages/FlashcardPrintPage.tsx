import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import { wordsFromLocationState } from '../lib/materialsHandoff';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import type { FullCardItem } from '../lib/types';

/** 한 페이지(A4)에 들어가는 카드 배치. 카드 수가 페이지당 장수보다 적으면 남는 칸은 비워 둔다(칸 크기 일정). */
const LAYOUTS = [
  { perPage: 2, cols: 1, rows: 2, wordPt: 54, meaningPt: 24 },
  { perPage: 4, cols: 2, rows: 2, wordPt: 40, meaningPt: 18 },
  { perPage: 6, cols: 2, rows: 3, wordPt: 32, meaningPt: 15 },
  { perPage: 8, cols: 2, rows: 4, wordPt: 26, meaningPt: 13 },
  { perPage: 12, cols: 3, rows: 4, wordPt: 20, meaningPt: 11 },
] as const;

type Layout = (typeof LAYOUTS)[number];
type ColorMode = 'color' | 'mono';

function chunk<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages;
}

function FlashCard({
  item,
  layout,
  showImage,
  showWord,
  showMeaning,
}: {
  item: FullCardItem;
  layout: Layout;
  showImage: boolean;
  showWord: boolean;
  showMeaning: boolean;
}) {
  const hasImage = showImage && Boolean(item.imageUrl);
  return (
    <div className="flex min-h-0 flex-col items-center rounded-[3mm] border border-dashed border-[#8a8a8a] p-[3mm]">
      {hasImage && (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <img src={item.imageUrl as string} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
      {(showWord || showMeaning) && (
        <div className={`flex flex-col items-center justify-center text-center ${hasImage ? 'pt-[2mm]' : 'flex-1'}`}>
          {showWord && (
            <div
              className="font-title-md font-bold leading-tight text-deep-navy"
              style={{ fontSize: `${layout.wordPt}pt`, overflowWrap: 'anywhere' }}
            >
              {item.word}
            </div>
          )}
          {showMeaning && item.meaning && (
            <div
              className="font-body-md leading-tight text-on-surface-variant"
              style={{ fontSize: `${layout.meaningPt}pt`, wordBreak: 'keep-all' }}
            >
              {item.meaning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FlashcardPrintPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const [words, setWords] = useState<FullCardItem[]>(() => wordsFromLocationState(location.state));
  const [perPage, setPerPage] = useState<Layout['perPage']>(6);
  const [showImage, setShowImage] = useState(true);
  const [showWord, setShowWord] = useState(true);
  const [showMeaning, setShowMeaning] = useState(true);
  const [colorMode, setColorMode] = useState<ColorMode>('color');

  const layout = LAYOUTS.find((l) => l.perPage === perPage) ?? LAYOUTS[2];
  const pages = useMemo(() => chunk(words, layout.perPage), [words, layout.perPage]);

  // 셋 다 끄면 빈 카드가 나오므로 마지막 하나는 못 끄게 한다.
  function toggleContent(kind: 'image' | 'word' | 'meaning') {
    const current = { image: showImage, word: showWord, meaning: showMeaning };
    if (current[kind] && Object.values(current).filter(Boolean).length === 1) return;
    if (kind === 'image') setShowImage(!showImage);
    else if (kind === 'word') setShowWord(!showWord);
    else setShowMeaning(!showMeaning);
  }

  const contentToggles = [
    { kind: 'image' as const, on: showImage, label: t('materials.flashcards.showImage') },
    { kind: 'word' as const, on: showWord, label: t('materials.flashcards.showWord') },
    { kind: 'meaning' as const, on: showMeaning, label: t('materials.flashcards.showMeaning') },
  ];

  return (
    <div className="space-y-6">
      <Link
        to="/materials"
        className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('materials.backToMaterials')}
      </Link>

      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.flashcardsName')}
      </h2>

      <div className="no-print space-y-4">
        <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />

        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <div>
            <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.wordsLabel')}</div>
            <MaterialsWordPicker
              words={words}
              onChange={setWords}
              wordLists={wordLists}
              wordListsLoading={wordListsLoading}
            />
          </div>

          <div>
            <div className="font-caption text-caption text-on-surface-variant mb-2">
              {t('materials.flashcards.perPageLabel')}
            </div>
            <div className="flex flex-wrap bg-surface-container-low rounded-lg p-1 w-fit">
              {LAYOUTS.map((l) => (
                <button
                  key={l.perPage}
                  type="button"
                  onClick={() => setPerPage(l.perPage)}
                  className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                    perPage === l.perPage
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {t('materials.flashcards.perPageOption', { count: l.perPage })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="font-caption text-caption text-on-surface-variant mb-2">
              {t('materials.flashcards.contentLabel')}
            </div>
            <div className="flex flex-wrap gap-2">
              {contentToggles.map((c) => (
                <button
                  key={c.kind}
                  type="button"
                  role="checkbox"
                  aria-checked={c.on}
                  onClick={() => toggleContent(c.kind)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
                    c.on
                      ? 'bg-secondary text-on-secondary shadow-sm'
                      : 'border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{c.on ? 'check_circle' : 'circle'}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="font-caption text-caption text-on-surface-variant mb-2">
              {t('materials.flashcards.colorLabel')}
            </div>
            <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
              {(['color', 'mono'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setColorMode(mode)}
                  className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                    colorMode === mode
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {t(`materials.flashcards.${mode}`)}
                </button>
              ))}
            </div>
          </div>

          {words.length === 0 ? (
            <div className="font-body-md text-body-md text-on-surface-variant">
              {t('materials.flashcards.needAtLeastOne')}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
              >
                {t('materials.printButton')}
              </button>
              <span className="font-caption text-caption text-on-surface-variant tabular-nums">
                {t('materials.flashcards.summary', { cards: words.length, pages: pages.length })}
              </span>
            </div>
          )}

          {words.length > 0 && (
            <div className="font-caption text-caption text-on-surface-variant">
              {t('materials.flashcards.printTip')}
            </div>
          )}
        </div>
      </div>

      {words.length > 0 && (
        <div className="print-sheet mx-auto" style={colorMode === 'mono' ? { filter: 'grayscale(1)' } : undefined}>
          {pages.map((pageWords, pageIndex) => (
            <div
              key={pageIndex}
              className="print-board mb-6 grid gap-[3mm] border border-outline-variant/40 bg-white p-3 print:mb-0 print:border-0 print:p-0"
              style={{
                // A4 인쇄 가능 영역(여백 12mm 제외 186×273mm)보다 낮게 잡는다 — 빈 페이지가 끼는 걸
                // 막는 것도 있지만, 무엇보다 페이지 맨 아래에 항상 찍히는 클래스뱅크 브랜드 푸터
                // (PrintBrandFooter.tsx, position:fixed)와 겹치지 않을 여백을 남겨야 한다. 카드가
                // 12장(3×4)까지 꽉 차면 270mm였을 땐 마지막 줄 카드 안에 푸터 글자가 겹쳐 찍히는
                // 실제 인쇄 사고가 났다(2026-09-23 사용자 제보, 헤드리스 크롬으로 재현·확인함) —
                // 262mm는 파닉스 학생용 페이지에서도 쓰는 값이라 안전 여백이 이미 검증돼 있다.
                aspectRatio: '186 / 262',
                gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
              }}
            >
              {pageWords.map((item) => (
                <FlashCard
                  key={item.id}
                  item={item}
                  layout={layout}
                  showImage={showImage}
                  showWord={showWord}
                  showMeaning={showMeaning}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
