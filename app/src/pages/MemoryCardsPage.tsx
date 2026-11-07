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

import MemoryCardsPrintSheets, { type CardSize, buildDeck } from '../components/worksheets/MemoryCardsPrintSheets';

export default function MemoryCardsPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const location = useLocation();
  const [words, setWords] = useState<FullCardItem[]>(() => wordsFromLocationState(location.state));
  const locked = usePresenting() && words.length > 0;
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [shuffleKey, setShuffleKey] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => buildDeck(words), [words, shuffleKey]);

  return (
    <div className="space-y-6">
      {locked ? (
        <PresentPrintBar canPrint onReshuffle={() => setShuffleKey((k) => k + 1)} />
      ) : (
      <>
      <BackButton path="/materials" to={t('materials.backToMaterials')} />

      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.memoryCardsName')}
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
              {t('materials.memoryCards.cardSizeLabel')}
            </div>
            <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setCardSize(size)}
                  className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                    cardSize === size ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t(`materials.memoryCards.${size}`)}
                </button>
              ))}
            </div>
          </div>

          {words.length === 0 ? (
            <div className="font-body-md text-body-md text-on-surface-variant">
              {t('materials.memoryCards.needAtLeastOne')}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShuffleKey((k) => k + 1)}
                className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 font-label-md text-label-md transition-colors"
              >
                {t('materials.bingo.regenerateButton')}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
              >
                {t('materials.printButton')}
              </button>
            </div>
          )}

          {words.length > 0 && (
            <div className="font-caption text-caption text-on-surface-variant">
              {t('materials.memoryCards.previewHint')}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {words.length > 0 && <MemoryCardsPrintSheets deck={deck} cardSize={cardSize} />}
    </div>
  );
}
