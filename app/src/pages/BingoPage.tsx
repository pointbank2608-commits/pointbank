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

import BingoPrintSheets, { GRID_SIZES, type GridSize, neededWordCount, buildBoards } from '../components/worksheets/BingoPrintSheets';

export default function BingoPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const location = useLocation();
  const [words, setWords] = useState<FullCardItem[]>(() => wordsFromLocationState(location.state));
  // 단어를 넘겨받았는데 4×4(16개)에 모자라면 3×3으로 시작 — 발표 중엔 칸 크기를 못 바꾸니까.
  const [gridSize, setGridSize] = useState<GridSize>(() => (words.length > 0 && words.length < neededWordCount(4) ? 3 : 4));
  const locked = usePresenting() && words.length > 0;
  const [boardCountInput, setBoardCountInput] = useState('20');
  const [shuffleKey, setShuffleKey] = useState(0);

  const wordLabels = useMemo(() => words.map((w) => w.word), [words]);
  const needed = neededWordCount(gridSize);
  const boardCount = Math.max(1, Math.min(100, Number(boardCountInput) || 1));
  const hasEnoughWords = wordLabels.length >= needed;

  const boards = useMemo(
    () => (hasEnoughWords ? buildBoards(wordLabels, gridSize, boardCount) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wordLabels, gridSize, boardCount, hasEnoughWords, shuffleKey],
  );

  return (
    <div className="space-y-6">
      {locked ? (
        <PresentPrintBar
          canPrint={hasEnoughWords}
          emptyHint={t('materials.bingo.needMoreWords', { count: needed, current: wordLabels.length })}
          onReshuffle={() => setShuffleKey((k) => k + 1)}
        />
      ) : (
      <>
      <BackButton path="/materials" to={t('materials.backToMaterials')} />

      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.bingoName')}
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

          <div className="flex flex-wrap gap-6">
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">
                {t('materials.bingo.gridSizeLabel')}
              </div>
              <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
                {GRID_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setGridSize(size)}
                    className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                      gridSize === size ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                    }`}
                  >
                    {size}×{size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="boardCount"
                className="block font-caption text-caption text-on-surface-variant mb-2"
              >
                {t('materials.bingo.boardCountLabel')}
              </label>
              <input
                id="boardCount"
                type="number"
                min={1}
                max={100}
                value={boardCountInput}
                onChange={(e) => setBoardCountInput(e.target.value)}
                className="w-[90px] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {!hasEnoughWords ? (
            <div className="font-body-md text-body-md text-on-surface-variant">
              {t('materials.bingo.needMoreWords', { count: needed, current: wordLabels.length })}
            </div>
          ) : (
            <>
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
              <div className="font-caption text-caption text-on-surface-variant">{t('materials.bingo.previewHint')}</div>
            </>
          )}
        </div>
      </div>
      </>
      )}

      {hasEnoughWords && <BingoPrintSheets boards={boards} gridSize={gridSize} />}
    </div>
  );
}
