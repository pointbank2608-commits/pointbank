import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CardSelectToggle from '../components/CardSelectToggle';
import FlashcardStudy from '../components/FlashcardStudy';
import WordSelectionBar from '../components/WordSelectionBar';
import { fetchWordBank } from '../lib/api';
import { speak } from '../lib/speech';
import type { FullCardItem, WordBankEntry } from '../lib/types';
import {
  entryInCategory,
  isIdiomEntry,
  PART_OF_SPEECH_ORDER,
  WORD_BANK_CATEGORIES,
  WORD_LEVELS,
} from '../lib/wordBankCategories';

/** 한 번에 그리는 카드 수 — 사전이 1,500단어를 넘어가면 전부 그리는 게 느려서 나눠 보여준다. */
const PAGE_SIZE = 120;

function chipClass(active: boolean, tone: 'primary' | 'secondary' | 'tertiary' = 'primary'): string {
  const activeTone =
    tone === 'primary'
      ? 'bg-primary text-on-primary'
      : tone === 'secondary'
        ? 'bg-secondary text-on-secondary'
        : 'bg-tertiary text-on-tertiary';
  return `rounded-full px-4 py-2 font-label-md text-label-md transition-all ${
    active
      ? `${activeTone} shadow-sm`
      : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
  }`;
}

/** 발음 듣기 버튼. 문장 뒤에 카드/모달 클릭 등 다른 onClick 안에 얹힐 수 있어 항상 전파를 막는다. */
function SpeakButton({
  text,
  label,
  className = '',
  size = 'md',
}: {
  text: string;
  label: string;
  className?: string;
  size?: 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'h-9 w-9 text-[26px]' : 'h-7 w-7 text-[20px]';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary ${sizeClass} ${className}`}
    >
      <span className="material-symbols-outlined text-[1em]">volume_up</span>
    </button>
  );
}

const CATEGORIES = WORD_BANK_CATEGORIES;

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
        className="max-h-[90vh] w-full max-w-[520px] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg sm:max-w-[600px]"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={entry.image_url ?? undefined} alt="" className="max-h-[70vh] w-full object-contain bg-surface-container-low" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-title-md text-3xl font-bold text-deep-navy sm:text-4xl">{entry.word}</h3>
            <SpeakButton text={entry.word} label={t('dictionary.playWord', { word: entry.word })} size="lg" />
            <span className="font-caption text-base text-on-surface-variant">{entry.part_of_speech}</span>
          </div>
          <p className="font-body-md mt-1 text-xl text-on-surface sm:text-2xl">{entry.meaning}</p>
          {entry.example_sentence && (
            <div className="mt-2 flex items-start gap-1.5">
              <p className="font-body-md text-lg text-on-surface-variant sm:text-xl">{entry.example_sentence}</p>
              <SpeakButton text={entry.example_sentence} label={t('dictionary.playExample')} className="mt-0.5" />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-5 rounded-full bg-primary px-6 py-2.5 font-label-md text-lg text-on-primary transition-colors hover:bg-primary-container"
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
  const [tab, setTab] = useState<'word' | 'idiom'>('word');
  const [category, setCategory] = useState<string>('all');
  const [subcategory, setSubcategory] = useState<string>('all');
  const [level, setLevel] = useState<number | 'all'>('all');
  const [partOfSpeech, setPartOfSpeech] = useState<string>('all');
  const [limit, setLimit] = useState<{ key: string; count: number }>({ key: '', count: PAGE_SIZE });
  const [lightbox, setLightbox] = useState<WordBankEntry | null>(null);
  const [studying, setStudying] = useState(false);
  // 카테고리·검색을 바꿔도 선택이 남도록 필터 결과가 아니라 페이지 상태로 들고 있다(id → 카드 데이터, 담은 순서 유지).
  const [selected, setSelected] = useState<Record<string, FullCardItem>>({});

  useEffect(() => {
    fetchWordBank()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  // 단어 탭 / 숙어·표현 탭 — 이후 모든 칩·결과는 현재 탭 안의 항목만 대상으로 한다.
  const tabEntries = useMemo(() => (entries ?? []).filter((e) => (tab === 'idiom') === isIdiomEntry(e)), [entries, tab]);
  const hasIdioms = useMemo(() => (entries ?? []).some(isIdiomEntry), [entries]);

  const usedCategories = useMemo(() => {
    const known = CATEGORIES.filter((c) => tabEntries.some((e) => entryInCategory(e, c)));
    // 상수 목록에 아직 없는 카테고리가 데이터에 들어와도 칩에서 빠지지 않게 뒤에 붙인다.
    const knownSet = new Set<string>(CATEGORIES);
    const extras = new Set<string>();
    for (const e of tabEntries) {
      for (const c of [e.category, ...(e.extra_categories ?? [])]) {
        if (c && !knownSet.has(c)) extras.add(c);
      }
    }
    return [...known, ...[...extras].sort()];
  }, [tabEntries]);

  const usedLevels = useMemo(
    () => WORD_LEVELS.filter((l) => tabEntries.some((e) => e.level === l.level)),
    [tabEntries],
  );

  const usedSubcategories = useMemo(() => {
    if (category === 'all') return [];
    const set = new Set<string>();
    for (const e of tabEntries) if (e.subcategory && entryInCategory(e, category)) set.add(e.subcategory);
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [tabEntries, category]);

  const usedPartsOfSpeech = useMemo(() => {
    const set = new Set(tabEntries.map((e) => e.part_of_speech).filter(Boolean));
    const ordered = PART_OF_SPEECH_ORDER.filter((p) => set.has(p));
    const extras = [...set].filter((p) => !PART_OF_SPEECH_ORDER.includes(p)).sort();
    return [...ordered, ...extras];
  }, [tabEntries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabEntries
      .filter((e) => {
        if (category !== 'all' && !entryInCategory(e, category)) return false;
        if (subcategory !== 'all' && e.subcategory !== subcategory) return false;
        if (level !== 'all' && e.level !== level) return false;
        if (partOfSpeech !== 'all' && e.part_of_speech !== partOfSpeech) return false;
        if (!q) return true;
        return e.word.toLowerCase().includes(q) || e.meaning.toLowerCase().includes(q);
      })
      // 새 단어가 뒤에 붙어도 가나다순처럼 알파벳순으로 섞여 보이도록 화면에서 정렬한다.
      .sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase(), 'en') || a.sense_number - b.sense_number);
  }, [tabEntries, query, category, subcategory, level, partOfSpeech]);

  // 필터가 바뀌면 "더 보기"로 늘려둔 개수는 처음(PAGE_SIZE)으로 돌아간다.
  const filterKey = `${tab}|${category}|${subcategory}|${level}|${partOfSpeech}|${query}`;
  const visibleCount = limit.key === filterKey ? limit.count : PAGE_SIZE;
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  function changeTab(next: 'word' | 'idiom') {
    setTab(next);
    setCategory('all');
    setSubcategory('all');
    setLevel('all');
    setPartOfSpeech('all');
  }

  function changeCategory(next: string) {
    setCategory(next);
    setSubcategory('all');
  }

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected[e.id]);

  function toEntryCard(e: WordBankEntry): FullCardItem {
    return { id: e.id, word: e.word, meaning: e.meaning, imageUrl: e.image_url, category: e.category, example: e.example_sentence };
  }

  function toggleSelect(entry: WordBankEntry) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[entry.id]) delete next[entry.id];
      else next[entry.id] = toEntryCard(entry);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      const next = { ...prev };
      if (allFilteredSelected) {
        for (const e of filtered) delete next[e.id];
      } else {
        for (const e of filtered) if (!next[e.id]) next[e.id] = toEntryCard(e);
      }
      return next;
    });
  }

  return (
    <div className={`space-y-6 ${selectedList.length > 0 ? 'pb-24' : ''}`}>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('dictionary.title')}
      </h2>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('dictionary.searchPlaceholder')}
        className="w-full max-w-[420px] rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-body-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />

      {entries && hasIdioms && (
        <div className="flex w-fit rounded-lg bg-surface-container-low p-1" role="tablist">
          {(['word', 'idiom'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => changeTab(key)}
              className={`rounded-md px-5 py-2 font-label-md text-label-md transition-all ${
                tab === key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t(key === 'word' ? 'dictionary.tabWord' : 'dictionary.tabIdiom')}
            </button>
          ))}
        </div>
      )}

      {entries && (
        <div className="space-y-3">
          {usedLevels.length > 0 && (
            <div>
              <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('dictionary.levelLabel')}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setLevel('all')} className={chipClass(level === 'all', 'tertiary')}>
                  {t('dictionary.allCategory')}
                </button>
                {usedLevels.map((l) => (
                  <button
                    key={l.level}
                    type="button"
                    onClick={() => setLevel(l.level)}
                    title={l.hint}
                    className={chipClass(level === l.level, 'tertiary')}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('dictionary.categoryLabel')}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => changeCategory('all')} className={chipClass(category === 'all')}>
                {t('dictionary.allCategory')}
              </button>
              {usedCategories.map((cat) => (
                <button key={cat} type="button" onClick={() => changeCategory(cat)} className={chipClass(category === cat)}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {usedSubcategories.length > 0 && (
            <div>
              <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('dictionary.subcategoryLabel')}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSubcategory('all')} className={chipClass(subcategory === 'all')}>
                  {t('dictionary.allCategory')}
                </button>
                {usedSubcategories.map((sub) => (
                  <button key={sub} type="button" onClick={() => setSubcategory(sub)} className={chipClass(subcategory === sub)}>
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('dictionary.partOfSpeechLabel')}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPartOfSpeech('all')} className={chipClass(partOfSpeech === 'all', 'secondary')}>
                {t('dictionary.allCategory')}
              </button>
              {usedPartsOfSpeech.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPartOfSpeech(pos)}
                  className={chipClass(partOfSpeech === pos, 'secondary')}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-caption text-caption text-on-surface-variant tabular-nums">
              {t('dictionary.resultCount', { count: filtered.length })}
            </div>
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="flex items-center gap-1.5 rounded-full border-2 border-primary/40 bg-surface-container-lowest px-4 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-base">
                    {allFilteredSelected ? 'check_box_outline_blank' : 'select_all'}
                  </span>
                  {allFilteredSelected ? t('selectionBar.deselectAll') : t('selectionBar.selectAll')}
                </button>
                <button
                  type="button"
                  onClick={() => setStudying(true)}
                  className="flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-2 font-label-md text-label-md text-on-secondary-container transition-colors hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-base">style</span>
                  {t('dictionary.studyButton')}
                </button>
              </div>
            )}
          </div>
          {filtered.length > 0 && selectedList.length === 0 && (
            <p className="font-caption text-caption text-on-surface-variant">{t('selectionBar.hint')}</p>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-xl bg-surface-container-lowest py-16 text-center shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="mb-3 text-5xl">🔍</div>
              <div className="font-body-md text-body-md text-on-surface-variant">{t('dictionary.noResults')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((entry) => (
                <div
                  key={entry.id}
                  className={`relative rounded-xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)] ${
                    selected[entry.id] ? 'ring-2 ring-secondary' : ''
                  }`}
                >
                  <CardSelectToggle
                    selected={Boolean(selected[entry.id])}
                    word={entry.word}
                    onToggle={() => toggleSelect(entry)}
                  />
                  <WordImage entry={entry} onOpen={setLightbox} />
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <h3 className="font-title-md text-2xl font-bold text-deep-navy sm:text-[26px]">{entry.word}</h3>
                    <SpeakButton text={entry.word} label={t('dictionary.playWord', { word: entry.word })} />
                    <span className="font-caption text-sm text-on-surface-variant">{entry.part_of_speech}</span>
                    {entry.level != null && (
                      <span className="rounded-full bg-tertiary-container px-2 py-0.5 font-caption text-xs text-on-tertiary-container">
                        Lv.{entry.level}
                      </span>
                    )}
                  </div>
                  <p className="font-body-md mt-0.5 text-lg text-on-surface sm:text-xl">{entry.meaning}</p>
                  {entry.example_sentence && (
                    <div className="mt-1 flex items-start gap-1.5">
                      <p className="font-body-md text-base text-on-surface-variant sm:text-lg">{entry.example_sentence}</p>
                      <SpeakButton text={entry.example_sentence} label={t('dictionary.playExample')} className="mt-0.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {filtered.length > visible.length && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setLimit({ key: filterKey, count: visibleCount + PAGE_SIZE })}
                className="rounded-full border-2 border-primary/40 bg-surface-container-lowest px-8 py-3 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-low"
              >
                {t('dictionary.loadMore', { count: filtered.length - visible.length })}
              </button>
            </div>
          )}
        </>
      )}

      {lightbox && <ImageLightbox entry={lightbox} onClose={() => setLightbox(null)} />}

      <WordSelectionBar words={selectedList} onClear={() => setSelected({})} />

      {studying && (
        <FlashcardStudy
          title={t('dictionary.title')}
          cards={filtered.map((e) => ({
            id: e.id,
            word: e.word,
            back: e.meaning,
            example: e.example_sentence,
            image_url: e.image_url,
          }))}
          onClose={() => setStudying(false)}
        />
      )}
    </div>
  );
}
