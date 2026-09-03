import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ClassChipRow from '../components/ClassChipRow';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createWordList,
  deleteWordList,
  fetchPhonicsBank,
  fetchWordBank,
  fetchWordLists,
  renameWordList,
  updateWordListItems,
} from '../lib/api';
import { useClasses } from '../lib/useClasses';
import type { PhonicsBankEntry, WordBankEntry, WordList, WordListItem } from '../lib/types';
import { PHONICS_STEPS, WORD_BANK_CATEGORIES } from '../lib/wordBankCategories';

function uid(): string {
  return crypto.randomUUID();
}

/** 사전(word_bank) 항목이든 파닉스(phonics_bank) 항목이든 단어장에 담을 땐 같은 모양으로.
 * 파닉스는 category 가 없으니 소리 규칙(rule, 예: "ai")을 대신 넣어준다 — 그룹정렬 자동
 * 그룹화에도 그대로 쓸 수 있어 덤으로 유용하다. */
function toWordListDraft(entry: WordBankEntry | PhonicsBankEntry): Omit<WordListItem, 'id'> {
  if ('rule' in entry) {
    return { word: entry.word, meaning: entry.meaning ?? '', image_url: entry.image_url, category: entry.rule };
  }
  return { word: entry.word, meaning: entry.meaning, image_url: entry.image_url, category: entry.category };
}

type CategoryTarget = { key: string; label: string; entries: (WordBankEntry | PhonicsBankEntry)[] };

/** 카테고리(사전 카테고리 또는 파닉스 단계)를 고르면 뜨는 모달. 카카오톡 사진 첨부처럼 각
 * 항목 이미지 위에 체크 동그라미를 얹어 여러 개를 골라 "추가하기"로 한 번에 담거나,
 * "전체 넣기"로 그 카테고리 전부를 바로 담을 수 있다. */
function CategoryPickerModal({
  target,
  existingKeys,
  onAddMany,
  onClose,
}: {
  target: CategoryTarget;
  existingKeys: Set<string>;
  onAddMany: (entries: (WordBankEntry | PhonicsBankEntry)[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function keyOf(entry: WordBankEntry | PhonicsBankEntry): string {
    const draft = toWordListDraft(entry);
    return `${draft.word}::${draft.meaning}`;
  }

  function toggle(entry: WordBankEntry | PhonicsBankEntry) {
    if (existingKeys.has(keyOf(entry))) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  }

  function handleAddAll() {
    onAddMany(target.entries.filter((e) => !existingKeys.has(keyOf(e))));
    onClose();
  }

  function handleAddChecked() {
    const picked = target.entries.filter((e) => checked.has(e.id));
    if (picked.length === 0) return;
    onAddMany(picked);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-container px-5 py-4">
          <div>
            <h3 className="font-title-md text-title-md text-deep-navy">{target.label}</h3>
            <p className="font-caption text-caption text-on-surface-variant">
              {t('wordLists.categoryModalCount', { count: target.entries.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
            aria-label={t('common.cancel')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-surface-container px-5 py-3">
          <span className="font-caption text-caption text-on-surface-variant">
            {t('wordLists.categoryModalSelected', { count: checked.size })}
          </span>
          <button
            type="button"
            onClick={handleAddAll}
            className="flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-1.5 font-label-md text-label-md text-on-secondary-container transition-colors hover:opacity-90"
          >
            <span className="material-symbols-outlined text-base">playlist_add</span>
            {t('wordLists.addAllButton')}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 overflow-y-auto p-5 sm:grid-cols-4">
          {target.entries.map((entry) => {
            const already = existingKeys.has(keyOf(entry));
            const isChecked = checked.has(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                disabled={already}
                onClick={() => toggle(entry)}
                className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors ${
                  already ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-container'
                }`}
              >
                <span className="relative block h-16 w-16">
                  {entry.image_url ? (
                    <img src={entry.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-low text-2xl">
                      🔤
                    </span>
                  )}
                  <span
                    className={`absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container-lowest ${
                      isChecked ? 'bg-secondary' : already ? 'bg-on-surface-variant/50' : 'bg-inverse-surface/50'
                    }`}
                  >
                    {(isChecked || already) && (
                      <span className="material-symbols-outlined text-[16px] text-on-secondary">check</span>
                    )}
                  </span>
                </span>
                <span className="font-caption text-caption text-on-surface truncate w-full">{entry.word}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-surface-container px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={checked.size === 0}
            onClick={handleAddChecked}
            className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('wordLists.categoryModalAddChecked', { count: checked.size })}
          </button>
        </div>
      </div>
    </div>
  );
}

function WordListEditor({ list, onChange }: { list: WordList; onChange: (items: WordListItem[]) => void }) {
  const { t } = useTranslation();
  const { run } = useToast();
  const [tab, setTab] = useState<'manual' | 'dictionary' | 'category'>('manual');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [query, setQuery] = useState('');
  const [dictionary, setDictionary] = useState<WordBankEntry[] | null>(null);
  const [phonics, setPhonics] = useState<PhonicsBankEntry[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryTarget | null>(null);

  useEffect(() => {
    if (tab === 'dictionary' && dictionary === null) {
      fetchWordBank().then(setDictionary).catch(() => setDictionary([]));
    }
    if (tab === 'category') {
      if (dictionary === null) fetchWordBank().then(setDictionary).catch(() => setDictionary([]));
      if (phonics === null) fetchPhonicsBank().then(setPhonics).catch(() => setPhonics([]));
    }
  }, [tab, dictionary, phonics]);

  async function persist(next: WordListItem[]) {
    onChange(next);
    await run(() => updateWordListItems(list.id, next), t('wordLists.savedToast'));
  }

  function addManual() {
    if (!word.trim() || !meaning.trim()) return;
    void persist([...list.items, { id: uid(), word: word.trim(), meaning: meaning.trim(), image_url: null, category: null }]);
    setWord('');
    setMeaning('');
  }

  function addFromDictionary(entry: WordBankEntry) {
    if (list.items.some((i) => i.word === entry.word && i.meaning === entry.meaning)) return;
    void persist([
      ...list.items,
      { id: uid(), word: entry.word, meaning: entry.meaning, image_url: entry.image_url, category: entry.category },
    ]);
  }

  function addManyFromEntries(entries: (WordBankEntry | PhonicsBankEntry)[]) {
    const existing = new Set(list.items.map((i) => `${i.word}::${i.meaning}`));
    const fresh = entries
      .map(toWordListDraft)
      .filter((d) => !existing.has(`${d.word}::${d.meaning}`));
    if (fresh.length === 0) return;
    void persist([...list.items, ...fresh.map((d) => ({ id: uid(), ...d }))]);
  }

  function removeItem(id: string) {
    void persist(list.items.filter((i) => i.id !== id));
  }

  const filteredDictionary = useMemo(() => {
    if (!dictionary) return [];
    const q = query.trim().toLowerCase();
    if (!q) return dictionary.slice(0, 30);
    return dictionary.filter((e) => e.word.toLowerCase().includes(q) || e.meaning.toLowerCase().includes(q)).slice(0, 30);
  }, [dictionary, query]);

  const existingKeys = useMemo(() => new Set(list.items.map((i) => `${i.word}::${i.meaning}`)), [list.items]);

  return (
    <div className="mt-3 border-t border-surface-container pt-3">
      {list.items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {list.items.map((i) => (
            <span
              key={i.id}
              className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-surface-container-low font-caption text-caption text-on-surface"
            >
              {i.image_url && <img src={i.image_url} alt="" className="w-4 h-4 rounded-full object-cover" />}
              {i.word} <span className="text-on-surface-variant">· {i.meaning}</span>
              <button
                type="button"
                onClick={() => removeItem(i.id)}
                className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-error hover:text-on-error text-on-surface-variant"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex bg-surface-container-lowest rounded-lg p-1 mb-3 w-fit">
        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
            tab === 'manual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {t('wordLists.tabManual')}
        </button>
        <button
          type="button"
          onClick={() => setTab('dictionary')}
          className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
            tab === 'dictionary' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {t('wordLists.tabDictionary')}
        </button>
        <button
          type="button"
          onClick={() => setTab('category')}
          className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
            tab === 'category' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {t('wordLists.tabCategory')}
        </button>
      </div>

      {tab === 'manual' ? (
        <div className="flex flex-wrap gap-2">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={t('wordLists.wordPlaceholder')}
            className="w-32 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder={t('wordLists.meaningPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addManual();
            }}
            className="w-32 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <button
            type="button"
            onClick={addManual}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
          >
            {t('wordLists.addButton')}
          </button>
        </div>
      ) : tab === 'dictionary' ? (
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dictionary.searchPlaceholder')}
            className="w-full max-w-[320px] bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none mb-2"
          />
          {dictionary === null ? (
            <div className="font-caption text-caption text-on-surface-variant py-2">{t('common.loading')}</div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto">
              {filteredDictionary.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => addFromDictionary(entry)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest hover:bg-secondary-container hover:text-on-secondary-container text-on-surface border border-outline-variant/40 font-label-md text-label-md transition-colors"
                >
                  {entry.image_url && <img src={entry.image_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                  {entry.word} <span className="text-on-surface-variant text-xs">{entry.meaning}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {dictionary === null || phonics === null ? (
            <div className="font-caption text-caption text-on-surface-variant py-2">{t('common.loading')}</div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {WORD_BANK_CATEGORIES.map((cat) => {
                  const entries = dictionary.filter((e) => e.category === cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      disabled={entries.length === 0}
                      onClick={() => setActiveCategory({ key: cat, label: cat, entries })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest hover:bg-secondary-container hover:text-on-secondary-container text-on-surface border border-outline-variant/40 font-label-md text-label-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {cat}
                      <span className="font-caption text-caption text-on-surface-variant">({entries.length})</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PHONICS_STEPS.map((step) => {
                  const entries = phonics.filter((e) => e.step === step);
                  const label = t('wordLists.phonicsStepChip', { step });
                  return (
                    <button
                      key={step}
                      type="button"
                      disabled={entries.length === 0}
                      onClick={() => setActiveCategory({ key: `phonics-${step}`, label, entries })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-tertiary-container/40 hover:bg-secondary-container hover:text-on-secondary-container text-on-surface border border-outline-variant/40 font-label-md text-label-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {label}
                      <span className="font-caption text-caption text-on-surface-variant">({entries.length})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeCategory && (
        <CategoryPickerModal
          target={activeCategory}
          existingKeys={existingKeys}
          onAddMany={addManyFromEntries}
          onClose={() => setActiveCategory(null)}
        />
      )}
    </div>
  );
}

export default function WordListsPage() {
  const { academy, profile } = useAuth();
  const { notify, run } = useToast();
  const { t } = useTranslation();
  const { classes, selectedId, select, reorder } = useClasses(academy?.id);

  const [lists, setLists] = useState<WordList[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'class' | 'academy'>('class');

  async function load() {
    if (!academy?.id || !selectedId) {
      setLists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setLists(await fetchWordLists(academy.id, selectedId));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academy?.id, selectedId]);

  async function handleCreate() {
    if (!academy?.id || !profile || !selectedId || !newName.trim()) return;
    const ok = await run(async () => {
      const created = await createWordList({
        academyId: academy.id,
        classId: newScope === 'class' ? selectedId : null,
        name: newName.trim(),
        items: [],
        teacherId: profile.id,
      });
      setLists((prev) => [...prev, created]);
      setOpenId(created.id);
    }, t('wordLists.createdToast'));
    if (ok) {
      setNewName('');
      setNewScope('class');
      setShowCreateForm(false);
    }
  }

  async function handleRename(list: WordList) {
    const next = prompt(t('wordLists.renamePrompt'), list.name);
    if (!next?.trim() || next.trim() === list.name) return;
    const ok = await run(() => renameWordList(list.id, next.trim()), t('wordLists.renamedToast'));
    if (ok) setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, name: next.trim() } : l)));
  }

  async function handleDelete(list: WordList) {
    if (!confirm(t('wordLists.deleteConfirm', { name: list.name }))) return;
    const ok = await run(() => deleteWordList(list.id), t('wordLists.deletedToast'));
    if (ok) setLists((prev) => prev.filter((l) => l.id !== list.id));
  }

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('wordLists.title')}
      </h2>
      <p className="font-caption text-caption text-on-surface-variant">{t('wordLists.hint')}</p>

      <ClassChipRow classes={classes} selectedId={selectedId} onSelect={select} onReorder={reorder} />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div
              key={list.id}
              className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)]"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setOpenId((prev) => (prev === list.id ? null : list.id))}
                  className="flex items-center gap-2 font-title-md text-title-md text-deep-navy"
                >
                  <span className="material-symbols-outlined">{openId === list.id ? 'expand_less' : 'expand_more'}</span>
                  {list.name}
                  <span className="font-caption text-caption text-on-surface-variant">
                    ({list.items.length}) {list.class_id === null && `· ${t('wordLists.academyWide')}`}
                  </span>
                </button>
                <span className="flex gap-3">
                  <button
                    onClick={() => void handleRename(list)}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    {t('wordLists.rename')}
                  </button>
                  <button
                    onClick={() => void handleDelete(list)}
                    className="font-label-md text-label-md text-error hover:underline"
                  >
                    {t('wordLists.delete')}
                  </button>
                </span>
              </div>
              {openId === list.id && (
                <WordListEditor
                  list={list}
                  onChange={(items) => setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, items } : l)))}
                />
              )}
            </div>
          ))}

          {lists.length === 0 && (
            <div className="text-center py-10 font-body-md text-on-surface-variant">{t('wordLists.empty')}</div>
          )}
        </div>
      )}

      {selectedId && (
        <div>
          {showCreateForm ? (
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-wrap items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('wordLists.namePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate();
                }}
                className="flex-1 min-w-[160px] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
              <div className="flex bg-surface-container-low rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setNewScope('class')}
                  className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                    newScope === 'class' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('gameAdmin.scopeClass')}
                </button>
                <button
                  type="button"
                  onClick={() => setNewScope('academy')}
                  className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                    newScope === 'academy' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('gameAdmin.scopeAcademy')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleCreate()}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
              >
                {t('wordLists.createButton')}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-lg text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-low transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 rounded-full font-label-md text-label-md text-primary border border-dashed border-primary/50 hover:bg-surface-container-low transition-colors"
            >
              + {t('wordLists.createButton')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
