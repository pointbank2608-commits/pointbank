import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { fetchWordBank } from '../lib/api';
import type { MaterialsHandoffState } from '../lib/materialsHandoff';
import {
  decorThemeFor,
  pickRecommended,
  toCard,
  TOPIC_TITLES,
  topicEntries,
  worksheetSupport,
  type WorksheetTypeSupport,
} from '../lib/topicWorksheets';
import type { WordBankEntry } from '../lib/types';
import { isIdiomEntry, WORD_BANK_CATEGORIES, WORD_LEVELS } from '../lib/wordBankCategories';

/** 주제에 단어가 이만큼은 있어야 세트가 된다. */
const MIN_TOPIC_WORDS = 4;
const GRID_PAGE = 60;
const COUNT_OPTIONS = [6, 8, 10, 12];

interface TypeCard {
  tab: string;
  icon: string;
  nameKey: string;
  descKey: string;
  /** 있으면 그 유형에 실제로 쓰이는 단어 수를 보여주고, 0이면 막는다. */
  support?: keyof WorksheetTypeSupport;
}

const TYPE_CARDS: TypeCard[] = [
  { tab: 'coloring', icon: 'palette', nameKey: 'tabColoring', descKey: 'coloring', support: 'coloring' },
  { tab: 'match', icon: 'link', nameKey: 'tabMatch', descKey: 'match', support: 'match' },
  { tab: 'wordSearch', icon: 'search', nameKey: 'tabWordSearch', descKey: 'wordSearch', support: 'wordSearch' },
  { tab: 'unscramble', icon: 'shuffle', nameKey: 'tabUnscramble', descKey: 'unscramble', support: 'unscramble' },
  { tab: 'fillBlank', icon: 'edit_note', nameKey: 'tabFillBlank', descKey: 'fillBlank', support: 'fillBlank' },
  { tab: 'cutPaste', icon: 'content_cut', nameKey: 'tabCutPaste', descKey: 'cutPaste', support: 'cutPaste' },
  { tab: 'multipleChoice', icon: 'checklist', nameKey: 'tabMultipleChoice', descKey: 'multipleChoice', support: 'multipleChoice' },
  { tab: 'trueFalse', icon: 'rule', nameKey: 'tabTrueFalse', descKey: 'trueFalse', support: 'trueFalse' },
  { tab: 'sentence', icon: 'sort', nameKey: 'tabSentence', descKey: 'sentence', support: 'sentence' },
  { tab: 'miniBook', icon: 'menu_book', nameKey: 'tabMiniBook', descKey: 'miniBook', support: 'miniBook' },
  { tab: 'askAnswer', icon: 'forum', nameKey: 'tabAskAnswer', descKey: 'askAnswer', support: 'askAnswer' },
  { tab: 'boardGame', icon: 'casino', nameKey: 'tabBoardGame', descKey: 'boardGame', support: 'boardGame' },
  { tab: 'readMatch', icon: 'auto_stories', nameKey: 'tabReadMatch', descKey: 'readMatch', support: 'readMatch' },
  { tab: 'tracing', icon: 'draw', nameKey: 'tabTracing', descKey: 'tracing' },
  { tab: 'quiz', icon: 'quiz', nameKey: 'tabQuiz', descKey: 'quiz' },
  { tab: 'card', icon: 'description', nameKey: 'tabCard', descKey: 'card' },
  { tab: 'list', icon: 'list_alt', nameKey: 'tabList', descKey: 'list' },
];

function chip(active: boolean): string {
  return `rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
    active ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant hover:bg-surface-container-low'
  }`;
}

function Thumb({ entry, className }: { entry: WordBankEntry; className: string }) {
  const [broken, setBroken] = useState(false);
  if (!entry.image_url || broken) {
    return <div className={`${className} flex items-center justify-center bg-surface-container-low text-xl`}>📖</div>;
  }
  return <img src={entry.image_url} alt="" onError={() => setBroken(true)} className={`${className} bg-surface-container-low object-contain`} />;
}

export default function WorksheetLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<WordBankEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [level, setLevel] = useState<number | 'all'>('all');
  const [count, setCount] = useState(8);
  const [seed, setSeed] = useState(1);
  const [chosen, setChosen] = useState<string[]>([]);
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);

  useEffect(() => {
    fetchWordBank()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const wordEntries = useMemo(() => (entries ?? []).filter((e) => !isIdiomEntry(e)), [entries]);

  const topics = useMemo(
    () =>
      WORD_BANK_CATEGORIES.map((name) => {
        const list = topicEntries(wordEntries, name, 'all');
        return { name, total: list.length, preview: pickRecommended(list, 3, 1) };
      }).filter((tp) => tp.total >= MIN_TOPIC_WORDS),
    [wordEntries],
  );

  const candidates = useMemo(() => (category ? topicEntries(wordEntries, category, level) : []), [wordEntries, category, level]);
  const usedLevels = useMemo(
    () => WORD_LEVELS.filter((l) => category && topicEntries(wordEntries, category, l.level).length > 0),
    [wordEntries, category],
  );

  const byId = useMemo(() => new Map(candidates.map((e) => [e.id, e])), [candidates]);
  const chosenEntries = useMemo(() => chosen.map((id) => byId.get(id)).filter((e): e is WordBankEntry => !!e), [chosen, byId]);
  const words = useMemo(() => chosenEntries.map(toCard), [chosenEntries]);
  const support = useMemo(() => worksheetSupport(words), [words]);

  function recommend(cat: string, lvl: number | 'all', cnt: number, sd: number) {
    setChosen(pickRecommended(topicEntries(wordEntries, cat, lvl), cnt, sd).map((e) => e.id));
    setGridLimit(GRID_PAGE);
  }

  function openTopic(name: string) {
    setCategory(name);
    setLevel('all');
    setSeed(1);
    recommend(name, 'all', count, 1);
  }

  function changeLevel(lvl: number | 'all') {
    setLevel(lvl);
    if (category) recommend(category, lvl, count, seed);
  }

  function changeCount(cnt: number) {
    setCount(cnt);
    if (category) recommend(category, level, cnt, seed);
  }

  function reroll() {
    const next = seed + 1;
    setSeed(next);
    if (category) recommend(category, level, count, next);
  }

  function toggle(id: string) {
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function openWorksheet(tab: string) {
    if (!category) return;
    const state: MaterialsHandoffState = {
      materialsWords: words,
      materialsTab: tab,
      materialsColoringTitle: TOPIC_TITLES[category] ?? category,
      materialsDecorTheme: decorThemeFor(category, chosenEntries[0]?.subcategory),
    };
    navigate('/materials/worksheet', { state });
  }

  return (
    <div className="space-y-6">
      <Link
        to="/materials"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('materials.backToMaterials')}
      </Link>

      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy mb-1.5">
          {t('materials.libraryName')}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('materials.library.subtitle')}</p>
      </div>

      {error && <div className="rounded-lg bg-error-container p-3 font-body-md text-on-error-container">{error}</div>}
      {!entries && !error && <div className="font-body-md text-on-surface-variant">{t('materials.library.loading')}</div>}

      {entries && !category && (
        <section>
          <h3 className="mb-3 font-title-md text-title-md text-on-surface">{t('materials.library.pickTopic')}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {topics.map((tp) => (
              <button
                key={tp.name}
                type="button"
                onClick={() => openTopic(tp.name)}
                className="rounded-xl bg-surface-container-lowest p-4 text-left shadow-[0_4px_20px_rgba(39,101,168,0.08)] transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="mb-3 flex gap-1.5">
                  {tp.preview.map((e) => (
                    <Thumb key={e.id} entry={e} className="h-14 w-14 flex-1 rounded-lg" />
                  ))}
                </div>
                <div className="font-title-md text-title-md text-deep-navy">{tp.name}</div>
                <div className="font-caption text-caption text-on-surface-variant">
                  {TOPIC_TITLES[tp.name] ?? ''} · {t('materials.library.wordCount', { count: tp.total })}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {entries && category && (
        <>
          <section className="space-y-4 rounded-xl bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className="mb-1 font-label-md text-label-md text-primary hover:underline"
                >
                  {t('materials.library.backToTopics')}
                </button>
                <h3 className="font-headline-sm text-2xl font-bold text-deep-navy">
                  {category} <span className="font-caption text-caption text-on-surface-variant">{TOPIC_TITLES[category]}</span>
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                  {t('materials.library.countLabel')}
                  <select
                    value={count}
                    onChange={(e) => changeCount(Number(e.target.value))}
                    className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
                  >
                    {COUNT_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {t('materials.library.countOption', { count: n })}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={reroll}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-primary px-4 py-1.5 font-label-md text-label-md text-primary transition-colors hover:bg-primary/10"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    shuffle
                  </span>
                  {t('materials.library.reroll')}
                </button>
              </div>
            </div>

            {usedLevels.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-caption text-caption text-on-surface-variant">{t('materials.library.levelLabel')}</span>
                <button type="button" onClick={() => changeLevel('all')} className={chip(level === 'all')}>
                  {t('materials.library.levelAll')}
                </button>
                {usedLevels.map((l) => (
                  <button key={l.level} type="button" onClick={() => changeLevel(l.level)} title={l.hint} className={chip(level === l.level)}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="font-label-md text-label-md text-on-surface">{t('materials.library.selectedCount', { count: chosen.length })}</span>
                {chosen.length > 0 && (
                  <button type="button" onClick={() => setChosen([])} className="font-label-md text-label-md text-on-surface-variant hover:text-error">
                    {t('materials.library.clearAll')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chosenEntries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    title={t('materials.library.removeWord', { word: e.word })}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 font-label-md text-label-md text-on-primary-container hover:bg-primary-fixed"
                  >
                    {e.word}
                    <span className="material-symbols-outlined text-[16px]" aria-hidden>
                      close
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-title-md text-title-md text-on-surface">{t('materials.library.typesTitle')}</h3>
            {words.length === 0 ? (
              <div className="font-body-md text-on-surface-variant">{t('materials.library.noWords')}</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TYPE_CARDS.map((card) => {
                  const n = card.support ? support[card.support] : words.length;
                  const disabled = n === 0;
                  return (
                    <button
                      key={card.tab}
                      type="button"
                      disabled={disabled}
                      onClick={() => openWorksheet(card.tab)}
                      className="flex items-start gap-3 rounded-xl border-2 border-outline-variant bg-surface-container-lowest p-4 text-left transition-all hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-outline-variant disabled:hover:shadow-none"
                    >
                      <span className="material-symbols-outlined mt-0.5 text-3xl text-primary" aria-hidden>
                        {card.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-title-md text-title-md text-on-surface">{t(`materials.worksheet.${card.nameKey}`)}</span>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant">
                          {t(`materials.library.desc.${card.descKey}`)}
                        </span>
                        <span className={`mt-1 block font-caption text-caption ${disabled ? 'text-error' : 'text-primary'}`}>
                          {disabled ? t('materials.library.typeNone') : t('materials.library.typeReady', { count: n })}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-title-md text-title-md text-on-surface">{t('materials.library.pickWordsTitle')}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {candidates.slice(0, gridLimit).map((e) => {
                const on = chosen.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    aria-pressed={on}
                    className={`relative rounded-lg border-2 p-1.5 text-center transition-colors ${
                      on ? 'border-primary bg-primary-container/40' : 'border-outline-variant bg-surface-container-lowest hover:border-primary/50'
                    }`}
                  >
                    <Thumb entry={e} className="aspect-square w-full rounded-md" />
                    <div className="mt-1 truncate font-label-md text-label-md text-on-surface">{e.word}</div>
                    {on && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary">
                        <span className="material-symbols-outlined text-[14px]" aria-hidden>
                          check
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {candidates.length > gridLimit && (
              <button
                type="button"
                onClick={() => setGridLimit((n) => n + GRID_PAGE)}
                className="mt-4 rounded-full border-2 border-primary px-5 py-2 font-label-md text-label-md text-primary hover:bg-primary/10"
              >
                {t('materials.library.more', { count: candidates.length - gridLimit })}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
