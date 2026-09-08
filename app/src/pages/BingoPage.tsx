import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import { colorFor } from '../lib/wheel';
import type { FullCardItem } from '../lib/types';

const GRID_SIZES = [3, 4, 5] as const;
type GridSize = (typeof GRID_SIZES)[number];

const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
const CELL_FONT: Record<GridSize, string> = { 3: '20px', 4: '16px', 5: '13px' };

function shuffled<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** 홀수 크기(3×3, 5×5)는 정중앙을 클래식 빙고처럼 FREE 칸으로 비워 둔다(word=null). */
function centerIndex(gridSize: GridSize): number {
  return gridSize % 2 === 1 ? Math.floor((gridSize * gridSize) / 2) : -1;
}

function neededWordCount(gridSize: GridSize): number {
  const cells = gridSize * gridSize;
  return centerIndex(gridSize) >= 0 ? cells - 1 : cells;
}

function buildBoards(words: string[], gridSize: GridSize, count: number): (string | null)[][] {
  const cells = gridSize * gridSize;
  const free = centerIndex(gridSize);
  const needed = neededWordCount(gridSize);
  return Array.from({ length: count }, () => {
    const picks = shuffled(words).slice(0, needed);
    const board: (string | null)[] = [];
    let p = 0;
    for (let i = 0; i < cells; i++) board.push(i === free ? null : picks[p++]);
    return board;
  });
}

export default function BingoPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const [words, setWords] = useState<FullCardItem[]>([]);
  const [gridSize, setGridSize] = useState<GridSize>(4);
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
      <Link
        to="/materials"
        className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('materials.backToMaterials')}
      </Link>

      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.bingoName')}
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

      {hasEnoughWords &&
        boards.map((board, boardIndex) => (
          <div key={boardIndex} className="print-sheet print-board mx-auto flex flex-col items-center gap-4 py-6">
            <div className="no-print font-caption text-caption text-on-surface-variant">
              {boardIndex + 1} / {boards.length}
            </div>
            <div className="w-full max-w-[170mm] rounded-[6mm] border-[4px] border-deep-navy overflow-hidden bg-surface-container-lowest shadow-[0_4px_20px_rgba(30,75,122,0.15)]">
              {gridSize === 5 ? (
                <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {BINGO_LETTERS.map((letter, i) => (
                    <div
                      key={letter}
                      className="flex items-center justify-center py-[3mm] font-headline-lg font-black text-white"
                      style={{ background: colorFor(i), fontSize: '9mm' }}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-[3mm] py-[3mm] bg-deep-navy">
                  {BINGO_LETTERS.map((letter, i) => (
                    <span
                      key={letter}
                      className="font-headline-lg font-black"
                      style={{ color: colorFor(i), fontSize: '9mm' }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid gap-[2.5mm] p-[3mm]" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
                {board.map((word, cellIndex) => {
                  const col = cellIndex % gridSize;
                  const cellColor = colorFor(col);
                  if (word === null) {
                    return (
                      <div
                        key={cellIndex}
                        className="print-card flex flex-col items-center justify-center gap-[1mm] rounded-[3mm] border-2 border-warm-yellow bg-warm-yellow/30 text-center font-title-md font-bold text-deep-navy"
                        style={{ aspectRatio: '1 / 1', fontSize: CELL_FONT[gridSize] }}
                      >
                        <span aria-hidden style={{ fontSize: '1.4em' }}>
                          ⭐
                        </span>
                        FREE
                      </div>
                    );
                  }
                  return (
                    <div
                      key={cellIndex}
                      className="print-card flex items-center justify-center rounded-[3mm] border-2 text-center font-title-md font-bold text-deep-navy"
                      style={{
                        aspectRatio: '1 / 1',
                        fontSize: CELL_FONT[gridSize],
                        padding: '2mm',
                        wordBreak: 'keep-all',
                        borderColor: cellColor,
                        background: `${cellColor}1a`,
                      }}
                    >
                      {word}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
