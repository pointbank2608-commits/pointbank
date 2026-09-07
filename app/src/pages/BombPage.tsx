import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import OpenInOtherGame from '../components/OpenInOtherGame';
import StudentRosterPicker from '../components/StudentRosterPicker';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import TimeBomb from '../components/TimeBomb';
import { updateGameTemplate } from '../lib/api';
import i18n from '../i18n';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, MusicSelection } from '../lib/types';

/** 폭탄 째깍거리는 소리는 커스터마이즈 UI 없이 이 파일로 고정한다(돌림판 회전음과 같은 이유).
 * 게임이 진행되는 내내(터질 때까지) 반복 재생된다. */
const BOMB_TICK_SOUND: MusicSelection = {
  kind: 'upload',
  path: '',
  name: '폭탄 째깍 소리',
  url: '/sounds/bomb-tick.m4a?v=2',
};

/** 폭발음도 같은 이유로 고정. 원본에서 1~4초 구간만 잘라 담아둔다(앞 1초는 무음이라 뺌). */
const BOMB_EXPLODE_SOUND: MusicSelection = {
  kind: 'upload',
  path: '',
  name: '폭탄 폭발음',
  url: '/sounds/bomb-explode.m4a?v=2',
};

function uid(): string {
  return crypto.randomUUID();
}

function defaultParticipants(): GameItem[] {
  return [1, 2, 3].map((n) => ({ id: uid(), label: i18n.t('gameBomb.defaultParticipant', { n }) }));
}

const DEFAULT_RANGE = { min: 15, max: 60 };

export default function BombPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'bomb',
    defaultItems: defaultParticipants,
    defaultConfig: () => ({ bombRange: DEFAULT_RANGE }),
  });
  const {
    isStaff,
    classes,
    staffClassId,
    selectClass,
    reorderClasses,
    studentClassName,
    classId,
    roster,
    rosterScope,
    setRosterScope,
    rosterLoading,
    wordLists,
    wordListsLoading,
    templates,
    setTemplates,
    selected,
    selectedId,
    setSelectedId,
    loading,
    showCreateForm,
    setShowCreateForm,
    submitting,
    newName,
    setNewName,
    newScope,
    setNewScope,
    handleCreate,
    handleRename,
    handleDeleteTemplate,
    scopeLabel,
    openInOtherGame,
    importCandidates,
    importFromClass,
    reload,
  } = g;
  const { notify } = useToast();

  const [editorOpen, setEditorOpen] = useState(true);
  const [roundKey, setRoundKey] = useState(0);
  const demoParticipants = useMemo(defaultParticipants, []);
  const [newParticipant, setNewParticipant] = useState('');
  const [newWord, setNewWord] = useState('');
  const range = selected?.config.bombRange ?? DEFAULT_RANGE;
  const words = selected?.config.words ?? [];

  // 이 반에 시한폭탄이 하나도 없으면, "+ 새 목록" 클릭 없이 바로 기본 목록을 하나
  // 만들어준다 — 돌림판과 같은 이유(이름·항목 편집을 처음부터 화면에서 바로 쓸 수 있게).
  const autoCreatingRef = useRef(false);
  useEffect(() => {
    if (!isStaff || loading || !classId || templates.length > 0 || autoCreatingRef.current) return;
    const guardKey = `bomb-autocreate-${classId}`;
    try {
      if (sessionStorage.getItem(guardKey)) return;
      sessionStorage.setItem(guardKey, '1');
    } catch {
      // sessionStorage 접근이 막혀 있어도 자동 생성 자체는 계속 진행한다.
    }
    autoCreatingRef.current = true;
    void handleCreate(t('gameBomb.defaultTemplateName')).finally(() => {
      autoCreatingRef.current = false;
    });
  }, [isStaff, loading, classId, templates.length, handleCreate, t]);

  async function persistItems(nextItems: GameItem[]): Promise<boolean> {
    if (!selected) return false;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, items: nextItems } : tpl)));
    try {
      await updateGameTemplate(selected.id, { items: nextItems });
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
      return false;
    }
  }

  async function addParticipant() {
    const label = newParticipant.trim();
    if (!label || !selected) return;
    if (await persistItems([...selected.items, { id: uid(), label }])) notify(t('gameAdmin.itemAddedToast'));
    setNewParticipant('');
  }

  async function addParticipantsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    if (await persistItems([...selected.items, ...labels.map((label) => ({ id: uid(), label }))])) {
      notify(t('gameAdmin.itemsAddedToast', { count: labels.length }));
    }
  }

  async function removeParticipant(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  /** 폭탄 화면에서 참가자 이름을 바로 바꿀 때 쓴다. */
  async function renameItemLabel(itemId: string, label: string) {
    if (!selected) return;
    await persistItems(selected.items.map((i) => (i.id === itemId ? { ...i, label } : i)));
  }

  async function addQuickItem() {
    if (!selected) return;
    const n = selected.items.length + 1;
    if (await persistItems([...selected.items, { id: uid(), label: i18n.t('gameBomb.defaultParticipant', { n }) }])) {
      notify(t('gameAdmin.itemAddedToast'));
    }
  }

  async function removeLastItem() {
    if (!selected || selected.items.length <= 1) return;
    await persistItems(selected.items.slice(0, -1));
  }

  async function clearAllParticipants() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameBomb.clearAllConfirm'))) return;
    await persistItems([]);
  }

  async function persistWords(nextWords: GameItem[]) {
    if (!selected) return;
    const nextConfig = { ...selected.config, words: nextWords };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  /** 폭탄 화면에서 단어·문장을 바로 바꿀 때 쓴다. */
  async function renameWord(wordId: string, label: string) {
    await persistWords(words.map((w) => (w.id === wordId ? { ...w, label } : w)));
  }

  async function addWord() {
    const label = newWord.trim();
    if (!label || !selected) return;
    await persistWords([...words, { id: uid(), label }]);
    setNewWord('');
  }

  async function addWordsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    await persistWords([...words, ...labels.map((label) => ({ id: uid(), label }))]);
  }

  async function removeWord(wordId: string) {
    await persistWords(words.filter((w) => w.id !== wordId));
  }

  async function addQuickWord() {
    if (!selected) return;
    const n = words.length + 1;
    await persistWords([...words, { id: uid(), label: t('gameBomb.defaultWord', { n }) }]);
  }

  async function removeLastWord() {
    if (!selected || words.length === 0) return;
    await persistWords(words.slice(0, -1));
  }

  async function clearAllWords() {
    if (!selected || words.length === 0) return;
    if (!confirm(t('gameBomb.clearAllWordsConfirm'))) return;
    await persistWords([]);
  }

  async function commitRange(nextRange: { min: number; max: number }) {
    if (!selected) return;
    const min = Math.max(1, Math.round(nextRange.min) || 1);
    const max = Math.max(min, Math.round(nextRange.max) || min);
    const nextConfig = { ...selected.config, bombRange: { min, max } };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  if (isStaff && classes.length === 0) {
    return (
      <div className="text-center py-16 font-body-md text-on-surface-variant">
        {t('gameAdmin.noClasses')}
      </div>
    );
  }
  if (!isStaff && !classId) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  const classPicker = isStaff ? (
    <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
  ) : (
    <h2 className="font-title-md text-title-md text-on-surface">
      {t('gameBomb.studentClassTitle', { className: studentClassName })}
    </h2>
  );

  const templateRow = (
    <div className="flex flex-wrap gap-2">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className={`flex items-center rounded-full overflow-hidden ${
            tpl.id === selectedId
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40'
          }`}
        >
          <button
            onClick={() => setSelectedId(tpl.id)}
            className="pl-4 pr-2 py-2 font-label-md text-label-md flex items-center gap-1.5"
          >
            {tpl.name}
            <span className="font-caption text-caption opacity-70">{scopeLabel(tpl)}</span>
          </button>
          {isStaff && (
            <button
              type="button"
              title={t('gameAdmin.delete')}
              onClick={() => void handleDeleteTemplate(tpl.id)}
              className="pr-3 pl-1 py-2 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {isStaff && (
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="px-6 py-3 rounded-full font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-colors"
        >
          {t('gameBomb.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-tertiary-container/40 px-3 py-2.5 font-caption text-caption text-on-surface">
        <span aria-hidden="true">💬</span>
        <span>{t('gameAdmin.createHelp')}</span>
      </div>
      <div>
        <label htmlFor="bname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="bname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameBomb.namePlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate();
          }}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>
      <div>
        <label className="font-label-md text-label-md text-on-surface-variant block mb-1.5">{t('gameAdmin.visibilityLabel')}</label>
        <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setNewScope('class')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              newScope === 'class' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            {t('gameAdmin.scopeInClassOnly')}
          </button>
          <button
            type="button"
            onClick={() => setNewScope('academy')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              newScope === 'academy' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            {t('gameAdmin.scopeAcademyWide')}
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void handleCreate()}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
        >
          {submitting ? t('gameAdmin.creating') : t('gameAdmin.create')}
        </button>
        <button
          onClick={() => setShowCreateForm(false)}
          className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          {t('gameAdmin.cancel')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link
        to="/games"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('gameAdmin.backToList')}
      </Link>

      <GameInfoPanel
        description={t('gameBomb.infoDescription')}
        steps={t('gameBomb.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div>
            <GameThemeFrame roster={roster} className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <TimeBomb participants={demoParticipants} words={[]} minSec={range.min} maxSec={range.max} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameBomb.emptyStaff') : t('gameBomb.emptyStudent')}
            </div>
          </div>
          {templateRow}
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          {!isStaff && (
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
              {selected.name}
            </h2>
          )}

          <GameThemeFrame
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <TimeBomb key={roundKey}
              participants={selected.items}
              words={words}
              minSec={range.min}
              maxSec={range.max}
              music={BOMB_TICK_SOUND}
              resultSound={BOMB_EXPLODE_SOUND}
              editable={isStaff}
              onEditItem={(id, label) => void renameItemLabel(id, label)}
              onAddItem={() => void addQuickItem()}
              onRemoveItem={() => void removeLastItem()}
              onEditWord={(id, label) => void renameWord(id, label)}
              onAddWord={() => void addQuickWord()}
              onRemoveWord={() => void removeLastWord()}
              onRangeChange={(min, max) => void commitRange({ min, max })}
              templateName={selected.name}
              onRenameTemplate={(name) => void handleRename(name)}
            />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameBomb.settingsTitle')}</h4>
                  <button
                    onClick={() => setEditorOpen((v) => !v)}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    {editorOpen ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
                  </button>
                </div>

                {editorOpen && (
                  <div className="space-y-1 divide-y divide-surface-container">
                    <div className="pt-3">
                    <div className="my-3 max-w-[260px]">
                      <StudentRosterPicker
                        roster={roster}
                        existingLabels={selected.items.map((i) => i.label)}
                        scope={rosterScope}
                        onScopeChange={setRosterScope}
                        loading={rosterLoading}
                        onAdd={(labels) => void addParticipantsBulk(labels)}
                      />
                    </div>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {selected.items.length === 0 ? (
                          <span className="font-caption text-caption text-on-surface-variant">
                            {t('gameAdmin.noParticipants')}
                          </span>
                        ) : (
                          selected.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
                            >
                              {item.label}
                              <button
                                onClick={() => void removeParticipant(item.id)}
                                className="text-on-surface-variant hover:text-error"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      {selected.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void clearAllParticipants()}
                          className="mt-2 font-label-md text-label-md text-error hover:underline"
                        >
                          {t('gameAdmin.clearAll')}
                        </button>
                      )}
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder={t('gameAdmin.newParticipantPlaceholder')}
                          value={newParticipant}
                          onChange={(e) => setNewParticipant(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addParticipant();
                          }}
                          className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <button
                          onClick={() => void addParticipant()}
                          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
                        >
                          {t('gameAdmin.addParticipant')}
                        </button>
                      </div>
                    </div>

                    <div className="pt-3">
                      <div className="font-caption text-caption text-on-surface-variant mb-2">
                        {t('gameBomb.wordsPanelLabel')}
                      </div>
                      <div className="flex flex-wrap items-start gap-2 mb-3 [&>*]:min-w-[180px] [&>*]:flex-none">
                        <WordListPicker
                          variant="label"
                          wordLists={wordLists}
                          loading={wordListsLoading}
                          onImportLabels={(labels) => void addWordsBulk(labels)}
                        />
                        <DictionaryPicker
                          variant="label"
                          onImportLabels={(labels) => void addWordsBulk(labels)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {words.length === 0 ? (
                          <span className="font-caption text-caption text-on-surface-variant">
                            {t('gameAdmin.noParticipants')}
                          </span>
                        ) : (
                          words.map((w) => (
                            <div
                              key={w.id}
                              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
                            >
                              {w.label}
                              <button
                                onClick={() => void removeWord(w.id)}
                                className="text-on-surface-variant hover:text-error"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      {words.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void clearAllWords()}
                          className="mt-2 font-label-md text-label-md text-error hover:underline"
                        >
                          {t('gameAdmin.clearAll')}
                        </button>
                      )}
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder={t('gameBomb.newWordPlaceholder')}
                          value={newWord}
                          onChange={(e) => setNewWord(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addWord();
                          }}
                          className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <button
                          onClick={() => void addWord()}
                          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
                        >
                          {t('gameBomb.addWordButton')}
                        </button>
                      </div>
                    </div>

                    <div className="pt-3">
                      <OpenInOtherGame currentType="bomb" itemCount={selected.items.length} onOpen={openInOtherGame} />
                      <ImportFromClass candidates={importCandidates} offerRosterSwap onImport={importFromClass} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
