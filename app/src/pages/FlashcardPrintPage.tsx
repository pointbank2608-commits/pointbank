import BackButton from '../components/BackButton';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import PresentPrintBar from '../components/PresentPrintBar';
import { usePresenting } from '../context/LessonRunnerContext';
import { wordsFromLocationState } from '../lib/materialsHandoff';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import type { FullCardItem } from '../lib/types';

import FlashcardPrintSheets, { LAYOUTS, type Layout, type ColorMode, chunk } from '../components/worksheets/FlashcardPrintSheets';

export default function FlashcardPrintPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const [words, setWords] = useState<FullCardItem[]>(() => wordsFromLocationState(location.state));
  const locked = usePresenting() && words.length > 0;
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
      {locked ? (
        <PresentPrintBar canPrint>
          <span className="font-caption text-caption text-on-surface-variant tabular-nums">
            {t('materials.flashcards.summary', { cards: words.length, pages: pages.length })}
          </span>
        </PresentPrintBar>
      ) : (
      <>
      <BackButton path="/materials" to={t('materials.backToMaterials')} />

      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.flashcardsName')}
      </h2>

      <div className="no-print space-y-4">
        <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />

        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card space-y-4">
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
      </>
      )}

      {words.length > 0 && <FlashcardPrintSheets pages={pages} layout={layout} showImage={showImage} showWord={showWord} showMeaning={showMeaning} colorMode={colorMode} />}
    </div>
  );
}
