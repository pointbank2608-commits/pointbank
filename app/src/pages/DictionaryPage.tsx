import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWordBank } from '../lib/api';
import type { WordBankEntry } from '../lib/types';

const CATEGORIES = [
  '사람/가족',
  '동물',
  '음식',
  '몸',
  '사물',
  '학교/문구',
  '자연/날씨',
  '장소',
  '교통',
  '색깔',
  '숫자/시간',
  '감정',
  '동작',
  '상태',
  '기능어',
  '인사/표현',
] as const;

/** 전통 8품사(명사~감탄사) 먼저, 데이터에만 있는 나머지 품사(관사/수사/조동사 등)는 뒤에 붙는다. */
const PART_OF_SPEECH_ORDER = [
  '명사',
  '대명사',
  '동사',
  '형용사',
  '부사',
  '전치사',
  '접속사',
  '감탄사',
  '관사',
  '수사',
  '조동사',
];

function WordImage({ entry, onOpen }: { entry: WordBankEntry; onOpen: (entry: WordBankEntry) => void }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  if (!entry.image_url || broken) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg bg-surface-container-low text-3xl">
        📖
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="block w-full cursor-zoom-in"
      aria-label={t('dictionary.viewFullImage', { word: entry.word })}
    >
      <img
        src={entry.image_url}
        alt=""
        className="h-32 w-full rounded-lg object-cover transition-transform hover:scale-[1.03]"
        onError={() => setBroken(true)}
      />
    </button>
  );
}

function ImageLightbox({ entry, onClose }: { entry: WordBankEntry; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[520px] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={entry.image_url ?? undefined} alt="" className="max-h-[70vh] w-full object-contain bg-surface-container-low" />
        <div className="p-5">
          <div className="flex items-center gap-2">
            <h3 className="font-title-md text-title-md text-deep-navy">{entry.word}</h3>
            <span className="font-caption text-caption text-on-surface-variant">{entry.part_of_speech}</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface">{entry.meaning}</p>
          {entry.example_sentence && (
            <p className="mt-1 font-caption text-caption text-on-surface-variant">{entry.example_sentence}</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-full bg-primary px-6 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container"
          >
            {t('dictionary.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DictionaryPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<WordBankEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [partOfSpeech, setPartOfSpeech] = useState<string>('all');
  const [lightbox, setLightbox] = useState<WordBankEntry | null>(null);

  useEffect(() => {
    fetchWordBank()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const usedCategories = useMemo(() => {
    if (!entries) return [];
    const set = new Set(entries.map((e) => e.category).filter(Boolean));
    return CATEGORIES.filter((c) => set.has(c));
  }, [entries]);

  const usedPartsOfSpeech = useMemo(() => {
    if (!entries) return [];
    const set = new Set(entries.map((e) => e.part_of_speech).filter(Boolean));
    const ordered = PART_OF_SPEECH_ORDER.filter((p) => set.has(p));
    const extras = [...set].filter((p) => !PART_OF_SPEECH_ORDER.includes(p)).sort();
    return [...ordered, ...extras];
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (partOfSpeech !== 'all' && e.part_of_speech !== partOfSpeech) return false;
      if (!q) return true;
      return e.word.toLowerCase().includes(q) || e.meaning.toLowerCase().includes(q);
    });
  }, [entries, query, category, partOfSpeech]);

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('dictionary.title')}
      </h2>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('dictionary.searchPlaceholder')}
        className="w-full max-w-[420px] rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-body-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />

      {entries && (
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('dictionary.categoryLabel')}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
                  category === 'all'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {t('dictionary.allCategory')}
              </button>
              {usedCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
                    category === cat
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('dictionary.partOfSpeechLabel')}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPartOfSpeech('all')}
                className={`rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
                  partOfSpeech === 'all'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {t('dictionary.allCategory')}
              </button>
              {usedPartsOfSpeech.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPartOfSpeech(pos)}
                  className={`rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
                    partOfSpeech === pos
                      ? 'bg-secondary text-on-secondary shadow-sm'
                      : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div className="font-body-md text-body-md text-error">{error}</div>}

      {!entries && !error && (
        <div className="py-16 text-center font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</div>
      )}

      {entries && (
        <>
          <div className="font-caption text-caption text-on-surface-variant tabular-nums">
            {t('dictionary.resultCount', { count: filtered.length })}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl bg-surface-container-lowest py-16 text-center shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="mb-3 text-5xl">🔍</div>
              <div className="font-body-md text-body-md text-on-surface-variant">{t('dictionary.noResults')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)]"
                >
                  <WordImage entry={entry} onOpen={setLightbox} />
                  <div className="mt-3 flex items-center gap-2">
                    <h3 className="font-title-md text-title-md text-deep-navy">{entry.word}</h3>
                    <span className="font-caption text-caption text-on-surface-variant">{entry.part_of_speech}</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface">{entry.meaning}</p>
                  {entry.example_sentence && (
                    <p className="mt-1 font-caption text-caption text-on-surface-variant">{entry.example_sentence}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {lightbox && <ImageLightbox entry={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
