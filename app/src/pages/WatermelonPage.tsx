import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import EditOnly from '../components/EditOnly';
import ClassChipRow from '../components/ClassChipRow';
import DictionaryPicker from '../components/DictionaryPicker';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import OpenInOtherGame from '../components/OpenInOtherGame';
import Watermelon from '../components/Watermelon';
import WordListPicker from '../components/WordListPicker';
import { updateGameTemplate } from '../lib/api';
import {
  asSentenceSlot,
  DEFAULT_WATERMELON_PATTERN_ID,
  playablePatternGroups,
  SENTENCE_SLOTS,
  SLOT_COLORS,
  slotLabelKey,
  type SentenceSlot,
  type SlottedLabel,
} from '../lib/sentencePatterns';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  const rows: { label: string; slot: SentenceSlot }[] = [
    { label: 'I', slot: 'subject' },
    { label: 'You', slot: 'subject' },
    { label: 'He', slot: 'subject' },
    { label: 'She', slot: 'subject' },
    { label: 'We', slot: 'subject' },
    { label: 'like', slot: 'verb' },
    { label: 'love', slot: 'verb' },
    { label: 'eat', slot: 'verb' },
    { label: 'see', slot: 'verb' },
    { label: 'have', slot: 'verb' },
    { label: 'apples', slot: 'object' },
    { label: 'cats', slot: 'object' },
    { label: 'books', slot: 'object' },
    { label: 'pizza', slot: 'object' },
    { label: 'soccer', slot: 'object' },
  ];
  return rows.map((row) => ({ id: uid(), label: row.label, slot: row.slot }));
}

export default function WatermelonPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'watermelon',
    defaultItems,
    defaultConfig: () => ({ watermelonPatternId: DEFAULT_WATERMELON_PATTERN_ID }),
  });
  const {
    isStaff,
    classes,
    staffClassId,
    selectClass,
    reorderClasses,
    studentClassName,
    classId,
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
    roster,
  } = g;
  const { notify } = useToast();

  const [editorOpen, setEditorOpen] = useState(true);
  const [roundKey, setRoundKey] = useState(0);
  const demoItems = useMemo(defaultItems, []);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemSlot, setNewItemSlot] = useState<SentenceSlot>('subject');
  const patternGroups = playablePatternGroups();

  const patternId = selected?.config.watermelonPatternId ?? DEFAULT_WATERMELON_PATTERN_ID;
  const playItems = selected?.items ?? demoItems;

  async function persistItems(next: GameItem[]): Promise<boolean> {
    if (!selected) return false;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, items: next } : tpl)));
    try {
      await updateGameTemplate(selected.id, { items: next });
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
      return false;
    }
  }

  async function persistConfig(nextConfig: GameTemplateConfig) {
    if (!selected) return;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label || !selected) return;
    if (await persistItems([...selected.items, { id: uid(), label, slot: newItemSlot }])) {
      notify(t('gameAdmin.itemAddedToast'));
    }
    setNewItemLabel('');
  }

  async function addSlotted(rows: SlottedLabel[]) {
    if (!selected || rows.length === 0) return;
    const next = rows
      .filter((row) => row.label.trim())
      .map((row) => ({ id: uid(), label: row.label.trim(), slot: row.slot }));
    if (next.length === 0) return;
    if (await persistItems([...selected.items, ...next])) {
      notify(t('gameAdmin.itemsAddedToast', { count: next.length }));
    }
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function setItemSlot(itemId: string, slot: SentenceSlot | null) {
    if (!selected) return;
    await persistItems(selected.items.map((i) => (i.id === itemId ? { ...i, slot } : i)));
  }

  async function clearAllItems() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameWatermelon.clearAllConfirm'))) return;
    await persistItems([]);
  }

  async function handlePatternChange(id: string) {
    if (!selected) return;
    await persistConfig({ ...selected.config, watermelonPatternId: id });
    setRoundKey((k) => k + 1);
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
      {t('gameWatermelon.studentClassTitle', { className: studentClassName })}
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
          {t('gameWatermelon.newButton')}
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
        <label htmlFor="wmname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="wmname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameWatermelon.namePlaceholder')}
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

  const patternPicker = (
    <div className="space-y-2">
      <div className="font-label-md text-label-md text-on-surface-variant">{t('gameWatermelon.patternLabel')}</div>
      {patternGroups.map((bundle) => (
        <div key={bundle.group} className="space-y-1.5">
          {patternGroups.length > 1 && (
            <div className="font-caption text-caption text-on-surface-variant">
              {bundle.group === 'level' ? t('gameWatermelon.groupLevel') : t('gameWatermelon.groupMode')}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {bundle.patterns.map((p) => {
              const on = patternId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void handlePatternChange(p.id)}
                  className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-all ${
                    on
                      ? 'bg-secondary text-on-secondary shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container'
                  }`}
                >
                  {t(p.nameKey)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="font-caption text-caption text-on-surface-variant">{t('gameWatermelon.patternHint')}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <EditOnly>
      <Link
        to="/games"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('gameAdmin.backToList')}
      </Link>
      </EditOnly>

      <GameInfoPanel
        description={t('gameWatermelon.infoDescription')}
        steps={t('gameWatermelon.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          <EditOnly>{classPicker}</EditOnly>
          <div>
            <GameThemeFrame
              gameType="watermelon"
              roster={roster}
              onRestart={() => setRoundKey((k) => k + 1)}
              className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
            >
              <Watermelon key={roundKey} items={demoItems} patternId={DEFAULT_WATERMELON_PATTERN_ID} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameWatermelon.emptyStaff') : t('gameWatermelon.emptyStudent')}
            </div>
          </div>
          <EditOnly>{templateRow}</EditOnly>
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
            {selected.name}
          </h2>

          <GameThemeFrame
            gameType="watermelon"
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <Watermelon key={roundKey} items={playItems} patternId={patternId} />
          </GameThemeFrame>

          <div className="space-y-4">
            <EditOnly>{classPicker}</EditOnly>
            <EditOnly>{templateRow}</EditOnly>
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameWatermelon.settingsTitle')}</h4>
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
                    {patternPicker}

                    <div className="flex flex-wrap items-start gap-2 [&>*]:min-w-[180px] [&>*]:flex-none">
                      <WordListPicker
                        variant="slots"
                        wordLists={wordLists}
                        loading={wordListsLoading}
                        onImportSlots={(rows) => void addSlotted(rows)}
                      />
                      <DictionaryPicker variant="slots" onImportSlots={(rows) => void addSlotted(rows)} />
                    </div>
                    <div className="font-caption text-caption text-on-surface-variant">{t('gameWatermelon.editorHint')}</div>

                    <div className="flex flex-wrap gap-1.5">
                      {selected.items.length === 0 ? (
                        <span className="font-caption text-caption text-on-surface-variant">
                          {t('gameAdmin.noParticipants')}
                        </span>
                      ) : (
                        selected.items.map((item) => {
                          const slot = asSentenceSlot(item.slot);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
                            >
                              {slot && (
                                <span
                                  className="inline-block size-2.5 rounded-full"
                                  style={{ background: SLOT_COLORS[slot] }}
                                  aria-hidden
                                />
                              )}
                              {item.label}
                              <select
                                value={slot ?? ''}
                                onChange={(e) => void setItemSlot(item.id, asSentenceSlot(e.target.value))}
                                className="bg-transparent font-caption text-caption text-on-surface-variant outline-none"
                                aria-label={t('gameWatermelon.slotLabel')}
                              >
                                <option value="">{t('gameWatermelon.slotNone')}</option>
                                {SENTENCE_SLOTS.map((s) => (
                                  <option key={s} value={s}>
                                    {t(slotLabelKey(s))}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => void removeItem(item.id)}
                                className="text-on-surface-variant hover:text-error"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {selected.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void clearAllItems()}
                        className="font-label-md text-label-md text-error hover:underline"
                      >
                        {t('gameAdmin.clearAll')}
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={newItemSlot}
                        onChange={(e) => setNewItemSlot(asSentenceSlot(e.target.value) ?? 'subject')}
                        className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-primary"
                      >
                        {SENTENCE_SLOTS.map((s) => (
                          <option key={s} value={s}>
                            {t(slotLabelKey(s))}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder={t('gameWatermelon.newWordPlaceholder')}
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void addItem();
                        }}
                        className="flex-1 min-w-[140px] bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                      <button
                        onClick={() => void addItem()}
                        className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
                      >
                        {t('gameAdmin.addParticipant')}
                      </button>
                    </div>

                    <OpenInOtherGame currentType="watermelon" itemCount={selected.items.length} onOpen={openInOtherGame} />
                    <ImportFromClass candidates={importCandidates} offerRosterSwap={false} onImport={importFromClass} />
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
