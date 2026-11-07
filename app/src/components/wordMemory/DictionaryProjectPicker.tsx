import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FullCardItem, WordBankEntry } from '../../lib/types';
import { cardKey, WM_MIN_WORDS } from '../../lib/wordMemory/plan';
import WordMemoryAssignModal from './WordMemoryAssignModal';

export interface DictionaryProjectRange {
  key: string;
  label: string;
  entries: readonly WordBankEntry[];
}

export default function DictionaryProjectPicker({ current, whole, defaultClassId }: { current: DictionaryProjectRange; whole: DictionaryProjectRange; defaultClassId?: string }) {
  const { t } = useTranslation();
  const [ranges, setRanges] = useState<DictionaryProjectRange[]>([]);
  const [assigning, setAssigning] = useState(false);

  const { cards, duplicates } = useMemo(() => {
    const unique = new Map<string, FullCardItem>();
    let duplicates = 0;
    for (const { entries } of ranges) {
      for (const entry of entries) {
        if (!entry.word.trim() || !entry.meaning.trim()) continue;
        const key = cardKey(entry.word, entry.meaning);
        if (unique.has(key)) {
          duplicates++;
          continue;
        }
        unique.set(key, {
          id: entry.id,
          word: entry.word,
          meaning: entry.meaning,
          imageUrl: entry.image_url,
          category: entry.category,
          example: entry.example_sentence,
          partOfSpeech: entry.part_of_speech,
        });
      }
    }
    return { cards: [...unique.values()], duplicates };
  }, [ranges]);

  function add(range: DictionaryProjectRange) {
    setRanges((previous) => previous.some(({ key }) => key === range.key) ? previous : [...previous, range]);
  }

  const secondary = 'min-h-11 rounded-full border border-primary/40 bg-surface-container-lowest px-4 py-2 text-sm font-bold text-primary disabled:opacity-45';
  return (
    <details open={defaultClassId ? true : undefined} className="space-y-3 rounded-xl border border-primary/30 bg-primary-fixed/15 p-4">
      <summary className="cursor-pointer font-bold text-primary">{t('dictionary.projectTitle')}</summary>
      <p className="text-sm text-on-surface-variant">{t('dictionary.projectHint')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondary} disabled={!current.entries.length || ranges.some(({ key }) => key === current.key)} onClick={() => add(current)}>
          {t('dictionary.projectAddRange', { count: current.entries.length })}
        </button>
        {current.key !== whole.key && (
          <button type="button" className={secondary} disabled={!whole.entries.length || ranges.some(({ key }) => key === whole.key)} onClick={() => add(whole)}>
            {t('dictionary.projectAddAll')}
          </button>
        )}
      </div>
      {ranges.length > 0 && (
        <>
          <ul className="space-y-1">
            {ranges.map(({ key, label, entries }) => (
              <li key={key} className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-lowest px-3 text-sm">
                <span className="min-w-0 break-words py-2">{label} · {t('dictionary.resultCount', { count: entries.length })}</span>
                <button type="button" className="min-h-11 shrink-0 px-2 font-bold text-primary" aria-label={t('dictionary.projectRemoveLabel', { label })} onClick={() => setRanges((previous) => previous.filter((range) => range.key !== key))}>
                  {t('dictionary.projectRemove')}
                </button>
              </li>
            ))}
          </ul>
          <p role="status" className="text-sm text-on-surface">
            {t('dictionary.projectUnique', { count: cards.length })}{duplicates > 0 && ` · ${t('dictionary.projectDuplicates', { count: duplicates })}`}
          </p>
          {cards.length < WM_MIN_WORDS && <p className="text-sm text-on-surface-variant">{t('wordMemory.tooFew', { min: WM_MIN_WORDS })}</p>}
          <button type="button" className="min-h-11 rounded-full bg-primary px-5 py-2 font-bold text-on-primary disabled:opacity-45" disabled={cards.length < WM_MIN_WORDS} onClick={() => setAssigning(true)}>
            {t('dictionary.projectContinue')}
          </button>
        </>
      )}
      {assigning && (
        <WordMemoryAssignModal
          cards={cards}
          defaultClassId={defaultClassId}
          source={{ type: 'dictionary', name: ranges.length === 1 ? ranges[0].label : t('dictionary.projectTitle') }}
          onClose={() => setAssigning(false)}
        />
      )}
    </details>
  );
}
