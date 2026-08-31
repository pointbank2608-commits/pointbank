import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import FindMissing from '../components/FindMissing';
import GameThemePicker from '../components/GameThemePicker';
import OpenInOtherGame from '../components/OpenInOtherGame';
import StudentRosterPicker from '../components/StudentRosterPicker';
import { updateGameTemplate } from '../lib/api';
import i18n from '../i18n';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({ id: uid(), label: i18n.t('gameFindMissing.defaultItem', { n }) }));
}

const DEFAULT_REVEAL_COUNT = 1;

export default function FindMissingPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'findmissing',
    defaultItems,
    defaultConfig: () => ({ revealCount: DEFAULT_REVEAL_COUNT }),
  });
  const {
    isStaff,
    classes,
    staffClassId,
    selectClass,
    studentClassName,
    classId,
    roster,
    rosterScope,
    setRosterScope,
    rosterLoading,
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
    reload,
  } = g;

  const [editorOpen, setEditorOpen] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const revealCount = selected?.config.revealCount ?? DEFAULT_REVEAL_COUNT;

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
    if (!confirm(t('gameFindMissing.clearAllConfirm'))) return;
    await persistItems([]);
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
    <div className="flex flex-wrap gap-2">
      {classes.map((c) => (
        <button
          key={c.id}
          onClick={() => selectClass(c.id)}
          className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
            c.id === staffClassId
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  ) : (
    <h2 className="font-title-md text-title-md text-on-surface">
      {t('gameFindMissing.studentClassTitle', { className: studentClassName })}
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
          {t('gameFindMissing.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div>
        <label htmlFor="fmname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="fmname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameFindMissing.namePlaceholder')}
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

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div className="text-center py-16 bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <div className="text-5xl mb-3">🔍</div>
            <div className="font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameFindMissing.emptyStaff') : t('gameFindMissing.emptyStudent')}
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

          <div
            data-game-theme={selected.config.theme}
            className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]"
          >
            <FindMissing items={selected.items} revealCount={revealCount} />
          </div>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameFindMissing.settingsTitle')}</h4>
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
                  <div>
                    <OpenInOtherGame currentType="findmissing" itemCount={selected.items.length} onOpen={openInOtherGame} />
                    <GameThemePicker value={selected.config.theme} onChange={(theme) => void handleThemeChange(theme)} />
                    <StudentRosterPicker
                      roster={roster}
                      existingLabels={selected.items.map((i) => i.label)}
                      scope={rosterScope}
                      onScopeChange={setRosterScope}
                      loading={rosterLoading}
                      onAdd={(labels) => void addItemsBulk(labels)}
                    />

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
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
