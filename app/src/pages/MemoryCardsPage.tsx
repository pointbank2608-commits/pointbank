import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import { colorFor } from '../lib/wheel';
import type { FullCardItem } from '../lib/types';

type CardSize = 'small' | 'medium' | 'large';

const COLUMNS: Record<CardSize, number> = { small: 4, medium: 3, large: 2 };
const WORD_FONT: Record<CardSize, string> = { small: '16px', medium: '20px', large: '26px' };
const MEANING_FONT: Record<CardSize, string> = { small: '11px', medium: '13px', large: '15px' };

interface Card {
  key: string;
  word: string;
  meaning: string;
  imageUrl: string | null;
  colorIndex: number;
}

/** 카드 두 벌(같은 단어 두 장)을 섞어서 메모리 게임/고피쉬 양쪽에 다 쓸 수 있게 만든다. */
function buildDeck(items: FullCardItem[]): Card[] {
  const pairs = items.flatMap((it, i) => [
    { key: `${it.id}-a`, word: it.word, meaning: it.meaning, imageUrl: it.imageUrl, colorIndex: i },
    { key: `${it.id}-b`, word: it.word, meaning: it.meaning, imageUrl: it.imageUrl, colorIndex: i },
  ]);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

export default function MemoryCardsPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const [words, setWords] = useState<FullCardItem[]>([]);
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [shuffleKey, setShuffleKey] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => buildDeck(words), [words, shuffleKey]);
  const columns = COLUMNS[cardSize];

  return (
    <div className="space-y-6">
      <Link
        to="/materials"
        className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('materials.backToMaterials')}
      </Link>

      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.memoryCardsName')}
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

      {words.length > 0 && (
        <div className="print-sheet mx-auto">
          <div className="flex flex-wrap gap-[4mm]">
            {deck.map((card) => {
              const color = colorFor(card.colorIndex);
              return (
                <div
                  key={card.key}
                  className="print-card flex flex-col items-center rounded-[6mm] border-[3px] bg-surface-container-lowest overflow-hidden"
                  style={{
                    width: `calc((100% - ${(columns - 1) * 4}mm) / ${columns})`,
                    borderColor: color,
                    padding: '3mm',
                  }}
                >
                  <div
                    className="w-full flex items-center justify-center rounded-[4mm] overflow-hidden"
                    style={{ aspectRatio: '1 / 1', background: `${color}22` }}
                  >
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span style={{ fontSize: '36px' }} aria-hidden>
                        🔤
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-[2mm] font-title-md font-bold text-center"
                    style={{ color, fontSize: WORD_FONT[cardSize], wordBreak: 'keep-all' }}
                  >
                    {card.word}
                  </div>
                  {card.meaning && (
                    <div
                      className="font-body-sm text-on-surface-variant text-center"
                      style={{ fontSize: MEANING_FONT[cardSize], wordBreak: 'keep-all' }}
                    >
                      {card.meaning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
