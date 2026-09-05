import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { fetchPhonicsBank, fetchWordBank } from '../lib/api';
import { buildGroupSortGroups, buildQuizQuestions, buildTrueFalseStatements, type QuizDirection } from '../lib/quizFromWordList';
import type { GroupSortGroup, ImageQuizItem, MatchPair, PhonicsBankEntry, QuizQuestion, TrueFalseStatement, WordBankEntry } from '../lib/types';
import { PART_OF_SPEECH_ORDER, PHONICS_STEPS, WORD_BANK_CATEGORIES } from '../lib/wordBankCategories';

function uid(): string {
  return crypto.randomUUID();
}

type Props =
  | { variant: 'label'; onImportLabels: (labels: string[]) => void }
  | { variant: 'pairs'; onImportPairs: (pairs: MatchPair[]) => void }
  | { variant: 'image'; onImportImage: (items: ImageQuizItem[]) => void }
  | { variant: 'quiz'; onImportQuestions: (questions: QuizQuestion[]) => void }
  | { variant: 'truefalse'; onImportStatements: (statements: TrueFalseStatement[]) => void }
  | { variant: 'groupsort'; onImportGroups: (groups: GroupSortGroup[]) => void };

const RESULT_LIMIT = 60;

/** 사전(word_bank)·파닉스(phonics_bank) 항목을 이 패널 안에서 다루는 공통 모양. 출처가
 * 달라도(사전 category 든 파닉스 rule 이든) 검색·필터·선택·추가 로직은 이거 하나로 통일한다. */
interface PickerEntry {
  id: string;
  word: string;
  meaning: string;
  image_url: string | null;
  category: string | null;
  partOfSpeech: string | null;
}

function fromWordBank(e: WordBankEntry): PickerEntry {
  return { id: e.id, word: e.word, meaning: e.meaning, image_url: e.image_url, category: e.category, partOfSpeech: e.part_of_speech };
}

function fromPhonics(e: PhonicsBankEntry): PickerEntry {
  return { id: e.id, word: e.word, meaning: e.meaning ?? '', image_url: e.image_url, category: e.rule, partOfSpeech: null };
}

type CategoryFilter = { type: 'category'; value: string } | { type: 'pos'; value: string } | { type: 'phonics'; step: number };

/**
 * 단어장을 미리 안 만들어도, 800단어 사전(word_bank)·파닉스(phonics_bank)에서 바로
 * 검색/카테고리로 찾아서 게임에 단어를 담는 패널. WordListPicker(단어장 불러오기) 옆에
 * 나란히 둔다. 검색은 사전만 대상(파닉스는 검색 UI가 따로 없어 카테고리로만 진입),
 * "카테고리" 토글을 열면 사전 16개 카테고리 + 품사 + 파닉스 5단계를 스크롤 목록으로 보여주고
 * 하나를 고르면 그 카테고리 항목만 걸러 보여준다(파닉스는 그 순간 phonics_bank 로 전환).
 * 체크박스로 여러 개 고른 뒤 "추가"를 누르면 variant 에 맞는 모양으로 변환해서 넘긴다 —
 * quiz/truefalse/groupsort 는 quizFromWordList.ts 의 같은 자동 생성 로직을 재사용한다.
 */
export default function DictionaryPicker(props: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<WordBankEntry[] | null>(null);
  const [phonicsEntries, setPhonicsEntries] = useState<PhonicsBankEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, PickerEntry>>({});
  const [field, setField] = useState<'word' | 'meaning'>('word');
  const [direction, setDirection] = useState<QuizDirection>('wordToMeaning');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter | null>(null);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const showDirectionToggle = props.variant === 'quiz' || props.variant === 'truefalse';

  async function handleToggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && entries === null && !loading) {
      setLoading(true);
      try {
        setEntries(await fetchWordBank());
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
  }

  async function ensurePhonicsLoaded() {
    if (phonicsEntries !== null) return;
    try {
      setPhonicsEntries(await fetchPhonicsBank());
    } catch {
      setPhonicsEntries([]);
    }
  }

  function pickCategory(filter: CategoryFilter) {
    setCategoryFilter(filter);
    setShowCategoryPanel(false);
    if (filter.type === 'phonics') void ensurePhonicsLoaded();
  }

  const pool: PickerEntry[] = useMemo(() => {
    if (categoryFilter?.type === 'phonics') {
      if (!phonicsEntries) return [];
      let stepEntries = phonicsEntries.filter((e) => e.step === categoryFilter.step).map(fromPhonics);
      if (props.variant === 'image') stepEntries = stepEntries.filter((e) => e.image_url);
      return stepEntries;
    }
    if (!entries) return [];
    let base = entries.map(fromWordBank);
    if (props.variant === 'image') base = base.filter((e) => e.image_url);
    if (categoryFilter?.type === 'category') base = base.filter((e) => e.category === categoryFilter.value);
    if (categoryFilter?.type === 'pos') base = base.filter((e) => e.partOfSpeech === categoryFilter.value);
    return base;
  }, [entries, phonicsEntries, categoryFilter, props.variant]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool.slice(0, RESULT_LIMIT);
    return pool.filter((e) => e.word.toLowerCase().includes(q) || e.meaning.toLowerCase().includes(q)).slice(0, RESULT_LIMIT);
  }, [pool, query]);

  const usedPartsOfSpeech = useMemo(() => {
    if (!entries) return [];
    const set = new Set(entries.map((e) => e.part_of_speech).filter(Boolean));
    const ordered = PART_OF_SPEECH_ORDER.filter((p) => set.has(p));
    const extras = [...set].filter((p) => !PART_OF_SPEECH_ORDER.includes(p)).sort();
    return [...ordered, ...extras];
  }, [entries]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedCategoryCount = useMemo(
    () => new Set(selectedList.filter((e) => e.category).map((e) => e.category)).size,
    [selectedList],
  );

  const canAdd =
    selectedList.length === 0
      ? false
      : props.variant === 'quiz' || props.variant === 'truefalse'
        ? selectedList.length >= 2
        : props.variant === 'groupsort'
          ? selectedCategoryCount >= 2
          : true;

  function toggleSelect(entry: PickerEntry) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[entry.id]) delete next[entry.id];
      else next[entry.id] = entry;
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected[e.id]);

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      const next = { ...prev };
      if (allFilteredSelected) {
        for (const e of filtered) delete next[e.id];
      } else {
        for (const e of filtered) next[e.id] = e;
      }
      return next;
    });
  }

  function handleAdd() {
    if (!canAdd) return;

    if (props.variant === 'label') {
      props.onImportLabels(selectedList.map((i) => (field === 'word' ? i.word : i.meaning)));
    } else if (props.variant === 'pairs') {
      props.onImportPairs(selectedList.map((i) => ({ id: uid(), left: i.word, right: i.meaning })));
    } else if (props.variant === 'image') {
      props.onImportImage(
        selectedList.filter((i) => i.image_url).map((i) => ({ id: uid(), imageUrl: i.image_url as string, answer: i.word })),
      );
    } else if (props.variant === 'quiz') {
      props.onImportQuestions(buildQuizQuestions({ items: selectedList }, direction));
    } else if (props.variant === 'truefalse') {
      props.onImportStatements(buildTrueFalseStatements({ items: selectedList }, direction));
    } else {
      props.onImportGroups(buildGroupSortGroups({ items: selectedList }));
    }
    notify(t('dictionaryPicker.addedToast', { count: selectedList.length }));
    setSelected({});
  }

  const categoryLabel =
    categoryFilter?.type === 'phonics'
      ? t('wordLists.phonicsStepChip', { step: categoryFilter.step })
      : categoryFilter?.value ?? null;

  return (
    <div className="flex-1 min-w-[220px]">
      <button
        type="button"
        onClick={() => void handleToggleOpen()}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-label-md text-label-md shadow-sm transition-colors ${
          open
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-primary text-on-primary hover:bg-primary-container'
        }`}
      >
        <span className="material-symbols-outlined text-xl">auto_stories</span>
        {open ? t('dictionaryPicker.close') : t('dictionaryPicker.open')}
      </button>

      {open && (
        <div className="mt-3 p-4 bg-surface-container-low rounded-lg">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dictionaryPicker.searchPlaceholder')}
            className="w-full max-w-[360px] rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {props.variant === 'label' && (
              <div className="flex bg-surface-container-lowest rounded-lg p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setField('word')}
                  className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                    field === 'word' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('wordListPicker.fieldWord')}
                </button>
                <button
                  type="button"
                  onClick={() => setField('meaning')}
                  className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                    field === 'meaning' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('wordListPicker.fieldMeaning')}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowCategoryPanel((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
                showCategoryPanel || categoryFilter
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">category</span>
              {categoryLabel ?? t('dictionaryPicker.categoryButton')}
              <span className="material-symbols-outlined text-base">{showCategoryPanel ? 'expand_less' : 'expand_more'}</span>
            </button>
            {categoryFilter && (
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-md font-caption text-caption text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                {t('dictionaryPicker.clearCategory')}
              </button>
            )}
          </div>

          {showCategoryPanel && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-surface-container-lowest p-2">
              <div className="flex flex-wrap gap-1.5">
                {WORD_BANK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => pickCategory({ type: 'category', value: cat })}
                    className="px-3 py-1 rounded-full bg-surface-container-low hover:bg-secondary-container hover:text-on-secondary-container text-on-surface font-label-md text-label-md transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {usedPartsOfSpeech.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {usedPartsOfSpeech.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => pickCategory({ type: 'pos', value: pos })}
                      className="px-3 py-1 rounded-full bg-surface-container-low hover:bg-secondary-container hover:text-on-secondary-container text-on-surface font-label-md text-label-md transition-colors"
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PHONICS_STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => pickCategory({ type: 'phonics', step })}
                    className="px-3 py-1 rounded-full bg-tertiary-container/40 hover:bg-secondary-container hover:text-on-secondary-container text-on-surface font-label-md text-label-md transition-colors"
                  >
                    {t('wordLists.phonicsStepChip', { step })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showDirectionToggle && (
            <div className="flex bg-surface-container-lowest rounded-lg p-1 mt-3 w-fit">
              <button
                type="button"
                onClick={() => setDirection('wordToMeaning')}
                className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                  direction === 'wordToMeaning' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {t('wordListPicker.quizWordToMeaning')}
              </button>
              <button
                type="button"
                onClick={() => setDirection('meaningToWord')}
                className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                  direction === 'meaningToWord' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {t('wordListPicker.quizMeaningToWord')}
              </button>
            </div>
          )}

          <div className="mt-3 font-caption text-caption text-on-surface-variant">
            {props.variant === 'quiz' || props.variant === 'truefalse'
              ? t('dictionaryPicker.minTwoHint')
              : props.variant === 'groupsort'
                ? t('dictionaryPicker.groupsortHint')
                : props.variant === 'image'
                  ? t('dictionaryPicker.imageOnlyHint')
                  : null}
          </div>

          {filtered.length > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <span className="font-caption text-caption text-on-surface-variant">
                {t('dictionaryPicker.resultCount', { count: filtered.length })}
              </span>
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="font-label-md text-label-md text-primary hover:underline"
              >
                {allFilteredSelected ? t('dictionaryPicker.deselectAll') : t('dictionaryPicker.selectAll')}
              </button>
            </div>
          )}

          {loading || (categoryFilter?.type === 'phonics' && phonicsEntries === null) ? (
            <div className="font-caption text-caption text-on-surface-variant py-2">{t('wordListPicker.loading')}</div>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-surface-container-lowest p-1.5">
              {filtered.length === 0 ? (
                <div className="font-caption text-caption text-on-surface-variant p-2">{t('dictionary.noResults')}</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filtered.map((entry) => {
                    const isSelected = Boolean(selected[entry.id]);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => toggleSelect(entry)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-surface-container'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                            isSelected ? 'border-secondary bg-secondary' : 'border-outline-variant bg-surface-container-lowest'
                          }`}
                        >
                          {isSelected && <span className="material-symbols-outlined text-[16px] text-on-secondary">check</span>}
                        </span>
                        {entry.image_url && (
                          <img src={entry.image_url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                        )}
                        <span className="font-label-md text-label-md text-on-surface">{entry.word}</span>
                        <span className="font-caption text-caption text-on-surface-variant truncate">{entry.meaning}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!canAdd}
            onClick={handleAdd}
            className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md transition-colors hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base">add</span>
            {t('dictionaryPicker.addButton', { count: selectedList.length })}
          </button>
        </div>
      )}
    </div>
  );
}
