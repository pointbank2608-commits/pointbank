import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import Hangman from '../components/Hangman';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import GameThemePicker from '../components/GameThemePicker';
import ImportFromClass from '../components/ImportFromClass';
import OpenInOtherGame from '../components/OpenInOtherGame';
import StudentRosterPicker from '../components/StudentRosterPicker';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import { updateGameTemplate } from '../lib/api';
import i18n from '../i18n';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig, UndoHandle } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [1, 2, 3, 4, 5].map((n) => ({ id: uid(), label: i18n.t('gameHangman.defaultItem', { n }) }));
}

const DEFAULT_MAX_ATTEMPTS = 6;

export default function HangmanPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'hangman',
    defaultItems,
    defaultConfig: () => ({ maxAttempts: DEFAULT_MAX_ATTEMPTS }),
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

  const [editorOpen, setEditorOpen] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const demoItems = useMemo(defaultItems, []);
  const gameRef = useRef<UndoHandle>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  const maxAttempts = selected?.config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const [maxAttemptsInput, setMaxAttemptsInput] = useState(String(maxAttempts));

  useEffect(() => {
    setMaxAttemptsInput(String(maxAttempts));
  }, [maxAttempts]);

  async function persistItems(next: GameItem[]) {
    if (!selected) return;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, items: next } : tpl)));
    try {
      await updateGameTemplate(selected.id, { items: next });
    } catch {
      await reload();
    }
  }

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label || !selected) return;
    await persistItems([...selected.items, { id: uid(), label }]);
    setNewItemLabel('');
  }

  async function addItemsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    await persistItems([...selected.items, ...labels.map((label) => ({ id: uid(), label }))]);
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function clearAllItems() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameHangman.clearAllConfirm'))) return;
    await persistItems([]);
  }

  async function commitMaxAttempts() {
    if (!selected) return;
    const n = Math.min(10, Math.max(1, Math.round(Number(maxAttemptsInput)) || DEFAULT_MAX_ATTEMPTS));
    const nextConfig = { ...selected.config, maxAttempts: n };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  async function handleThemeChange(theme: GameTemplateConfig['theme'] | null) {
    if (!selected) return;
    const nextConfig = { ...selected.config, theme: theme ?? undefined };
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
      {t('gameHangman.studentClassTitle', { className: studentClassName })}
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
          className="px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-dashed border-outline-variant transition-colors"
        >
          {t('gameHangman.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div>
        <label htmlFor="hmname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="hmname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameHangman.namePlaceholder')}
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
        description={t('gameHangman.infoDescription')}
        steps={t('gameHangman.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div>
            <GameThemeFrame themeId={null} className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <Hangman items={demoItems} maxAttempts={maxAttempts} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameHangman.emptyStaff') : t('gameHangman.emptyStudent')}
            </div>
          </div>
          {templateRow}
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
            {selected.name}
          </h2>

          <GameThemeFrame
            themeId={selected.config.theme}
            onRestart={() => setRoundKey((k) => k + 1)}
            onUndo={() => gameRef.current?.undo()}
            className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <Hangman key={roundKey} ref={gameRef} items={selected.items} maxAttempts={maxAttempts} />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameHangman.settingsTitle')}</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => void handleRename()}
                      className="font-label-md text-label-md text-primary hover:underline"
                    >
                      {t('gameAdmin.rename')}
                    </button>
                    <button
                      onClick={() => setEditorOpen((v) => !v)}
                      className="font-label-md text-label-md text-primary hover:underline"
                    >
                      {editorOpen ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
                    </button>
                  </div>
                </div>

                {editorOpen && (
                  <div className="space-y-4">
                    <OpenInOtherGame currentType="hangman" itemCount={selected.items.length} onOpen={openInOtherGame} />
                    <ImportFromClass candidates={importCandidates} offerRosterSwap onImport={importFromClass} />
                    <GameThemePicker value={selected.config.theme} onChange={(theme) => void handleThemeChange(theme)} />

                    <div>
                      <div className="font-caption text-caption text-on-surface-variant mb-2">
                        {t('gameHangman.maxAttemptsLabel')}
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={maxAttemptsInput}
                        onChange={(e) => setMaxAttemptsInput(e.target.value)}
                        onBlur={() => void commitMaxAttempts()}
                        className="w-[90px] bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    <div>
                      <StudentRosterPicker
                        roster={roster}
                        existingLabels={selected.items.map((i) => i.label)}
                        scope={rosterScope}
                        onScopeChange={setRosterScope}
                        loading={rosterLoading}
                        onAdd={(labels) => void addItemsBulk(labels)}
                      />
                    <div className="flex flex-wrap items-start gap-3 my-3">
                    <WordListPicker
                      variant="label"
                      wordLists={wordLists}
                      loading={wordListsLoading}
                      onImportLabels={(labels) => void addItemsBulk(labels)}
                    />
                    <DictionaryPicker
                      variant="label"
                      onImportLabels={(labels) => void addItemsBulk(labels)}
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
                                onClick={() => void removeItem(item.id)}
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
                          onClick={() => void clearAllItems()}
                          className="mt-2 font-label-md text-label-md text-error hover:underline"
                        >
                          {t('gameAdmin.clearAll')}
                        </button>
                      )}
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder={t('gameAdmin.newParticipantPlaceholder')}
                          value={newItemLabel}
                          onChange={(e) => setNewItemLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addItem();
                          }}
                          className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <button
                          onClick={() => void addItem()}
                          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
                        >
                          {t('gameAdmin.addParticipant')}
                        </button>
                      </div>
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
