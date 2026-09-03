import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWordBank } from '../lib/api';
import { buildGroupSortGroups, buildQuizQuestions, buildTrueFalseStatements, type QuizDirection } from '../lib/quizFromWordList';
import type { GroupSortGroup, ImageQuizItem, MatchPair, QuizQuestion, TrueFalseStatement, WordBankEntry } from '../lib/types';

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

/**
 * 단어장을 미리 안 만들어도, 800단어 사전(word_bank)에서 바로 검색해서 게임에 단어를 담는
 * 패널. WordListPicker(단어장 불러오기) 옆에 나란히 둔다. 사전 항목을 체크박스로 여러 개
 * 고른 뒤 "추가"를 누르면 variant 에 맞는 모양으로 변환해서 넘긴다 — quiz/truefalse/groupsort
 * 는 quizFromWordList.ts 의 같은 자동 생성 로직을 재사용한다(오답·그룹 모두 선택한 단어들
 * 안에서만 만들어짐).
 */
export default function DictionaryPicker(props: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<WordBankEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, WordBankEntry>>({});
  const [field, setField] = useState<'word' | 'meaning'>('word');
  const [direction, setDirection] = useState<QuizDirection>('wordToMeaning');
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

  const pool = useMemo(() => {
    if (!entries) return [];
    return props.variant === 'image' ? entries.filter((e) => e.image_url) : entries;
  }, [entries, props.variant]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool.slice(0, RESULT_LIMIT);
    return pool.filter((e) => e.word.toLowerCase().includes(q) || e.meaning.toLowerCase().includes(q)).slice(0, RESULT_LIMIT);
  }, [pool, query]);

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

  function toggleSelect(entry: WordBankEntry) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[entry.id]) delete next[entry.id];
      else next[entry.id] = entry;
      return next;
    });
  }

  function handleAdd() {
    if (!canAdd) return;
    const items = selectedList.map((e) => ({
      id: e.id,
      word: e.word,
      meaning: e.meaning,
      image_url: e.image_url,
      category: e.category,
    }));

    if (props.variant === 'label') {
      props.onImportLabels(items.map((i) => (field === 'word' ? i.word : i.meaning)));
    } else if (props.variant === 'pairs') {
      props.onImportPairs(items.map((i) => ({ id: uid(), left: i.word, right: i.meaning })));
    } else if (props.variant === 'image') {
      props.onImportImage(
        items.filter((i) => i.image_url).map((i) => ({ id: uid(), imageUrl: i.image_url as string, answer: i.word })),
      );
    } else if (props.variant === 'quiz') {
      props.onImportQuestions(buildQuizQuestions({ items }, direction));
    } else if (props.variant === 'truefalse') {
      props.onImportStatements(buildTrueFalseStatements({ items }, direction));
    } else {
      props.onImportGroups(buildGroupSortGroups({ items }));
    }
    setSelected({});
  }

  return (
    <div className="flex-1 min-w-[220px]">
      <button
        type="button"
        onClick={() => void handleToggleOpen()}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-md text-label-md transition-colors ${
          open
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-base">auto_stories</span>
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

          {props.variant === 'label' && (
            <div className="flex bg-surface-container-lowest rounded-lg p-1 mt-3 w-fit">
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

          {loading ? (
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
