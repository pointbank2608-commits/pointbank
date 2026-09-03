import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import GameThemePicker from '../components/GameThemePicker';
import GroupSort from '../components/GroupSort';
import ImportFromClass from '../components/ImportFromClass';
import WordListPicker from '../components/WordListPicker';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig, GroupSortGroup } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [];
}

function newGroup(): GroupSortGroup {
  return { id: uid(), name: '', items: [] };
}

function newItem() {
  return { id: uid(), text: '' };
}

export default function GroupSortPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'groupsort',
    defaultItems,
    defaultConfig: () => ({ groups: [] }),
  });
  const {
    isStaff,
    classes,
    staffClassId,
    selectClass,
    reorderClasses,
    studentClassName,
    classId,
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
    importCandidates,
    importFromClass,
    reload,
    wordLists,
    wordListsLoading,
  } = g;

  const [editorOpen, setEditorOpen] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const [draftGroups, setDraftGroups] = useState<GroupSortGroup[]>(selected?.config.groups ?? []);

  useEffect(() => {
    setDraftGroups(selected?.config.groups ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const playableGroups = draftGroups
    .map((grp) => ({ ...grp, items: grp.items.filter((it) => it.text.trim()) }))
    .filter((grp) => grp.name.trim() && grp.items.length > 0);

  async function persistGroups(next: GroupSortGroup[]) {
    if (!selected) return;
    const nextConfig: GameTemplateConfig = { ...selected.config, groups: next };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  function addGroup() {
    const next = [...draftGroups, newGroup()];
    setDraftGroups(next);
    void persistGroups(next);
  }

  /** 단어장에서 불러온 그룹을 합친다 — 이름이 같은 그룹이 이미 있으면 항목만 이어붙인다. */
  function addGroupsBulk(groups: GroupSortGroup[]) {
    let next = draftGroups;
    for (const grp of groups) {
      const idx = next.findIndex((dg) => dg.name === grp.name);
      if (idx >= 0) {
        const existing = next[idx];
        const existingTexts = new Set(existing.items.map((it) => it.text));
        const merged = { ...existing, items: [...existing.items, ...grp.items.filter((it) => !existingTexts.has(it.text))] };
        next = next.map((dg, i) => (i === idx ? merged : dg));
      } else {
        next = [...next, grp];
      }
    }
    setDraftGroups(next);
    void persistGroups(next);
  }

  function removeGroup(gid: string) {
    const next = draftGroups.filter((grp) => grp.id !== gid);
    setDraftGroups(next);
    void persistGroups(next);
  }

  function addItemToGroup(gid: string) {
    const next = draftGroups.map((grp) => (grp.id === gid ? { ...grp, items: [...grp.items, newItem()] } : grp));
    setDraftGroups(next);
    void persistGroups(next);
  }

  function removeItemFromGroup(gid: string, itemId: string) {
    const next = draftGroups.map((grp) =>
      grp.id === gid ? { ...grp, items: grp.items.filter((it) => it.id !== itemId) } : grp,
    );
    setDraftGroups(next);
    void persistGroups(next);
  }

  function updateGroupNameLocal(gid: string, text: string) {
    setDraftGroups((prev) => prev.map((grp) => (grp.id === gid ? { ...grp, name: text } : grp)));
  }

  function updateItemTextLocal(gid: string, itemId: string, text: string) {
    setDraftGroups((prev) =>
      prev.map((grp) =>
        grp.id === gid
          ? { ...grp, items: grp.items.map((it) => (it.id === itemId ? { ...it, text } : it)) }
          : grp,
      ),
    );
  }

  function commitOnBlur() {
    void persistGroups(draftGroups);
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

  async function handleThemeChange(theme: GameTemplateConfig['theme'] | null) {
    if (!selected) return;
    await persistConfig({ ...selected.config, groups: draftGroups, theme: theme ?? undefined });
  }

  async function handleStyleChange(style: 'crates' | 'baskets') {
    if (!selected) return;
    await persistConfig({ ...selected.config, groups: draftGroups, groupSortStyle: style });
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
      {t('gameGroupSort.studentClassTitle', { className: studentClassName })}
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
          {t('gameGroupSort.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div>
        <label htmlFor="gsname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="gsname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameGroupSort.namePlaceholder')}
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
        description={t('gameGroupSort.infoDescription')}
        steps={t('gameGroupSort.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div className="text-center py-16 bg-[#fffdf8] rounded-[28px] shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
            <div className="mx-auto mb-3 flex justify-center gap-2">
              <span className="gs-clay gs-clay-0 pointer-events-none min-w-[64px]">A</span>
              <span className="gs-clay gs-clay-2 pointer-events-none min-w-[64px]">가</span>
            </div>
            <div className="font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameGroupSort.emptyStaff') : t('gameGroupSort.emptyStudent')}
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
            className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <GroupSort key={roundKey}
              groups={playableGroups}
              boardStyle={selected.config.groupSortStyle === 'baskets' ? 'baskets' : 'crates'}
            />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameGroupSort.settingsTitle')}</h4>
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

                <div className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-label-md text-label-md text-on-surface-variant shrink-0">
                    {t('gameGroupSort.styleLabel')}
                  </span>
                  {(['crates', 'baskets'] as const).map((style) => {
                    const on = (selected.config.groupSortStyle ?? 'crates') === style;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => void handleStyleChange(style)}
                        className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-all ${
                          on
                            ? 'bg-secondary text-on-secondary shadow-sm'
                            : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container'
                        }`}
                      >
                        {style === 'crates' ? t('gameGroupSort.styleCrates') : t('gameGroupSort.styleBaskets')}
                      </button>
                    );
                  })}
                </div>

                {editorOpen && (
                  <div className="space-y-4">
                    <GameThemePicker value={selected.config.theme} onChange={(theme) => void handleThemeChange(theme)} />
                    <ImportFromClass candidates={importCandidates} offerRosterSwap={false} onImport={importFromClass} />
                    <WordListPicker
                      variant="groupsort"
                      wordLists={wordLists}
                      loading={wordListsLoading}
                      onImportGroups={(groups) => addGroupsBulk(groups)}
                    />

                    {draftGroups.map((grp, gi) => (
                      <div key={grp.id} className="bg-surface-container-low rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-label-md text-label-md text-on-surface-variant">
                            {t('gameGroupSort.groupLabel', { n: gi + 1 })}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeGroup(grp.id)}
                            className="font-caption text-caption text-error hover:underline"
                          >
                            {t('gameGroupSort.removeGroupButton')}
                          </button>
                        </div>
                        <input
                          value={grp.name}
                          onChange={(e) => updateGroupNameLocal(grp.id, e.target.value)}
                          onBlur={commitOnBlur}
                          placeholder={t('gameGroupSort.groupNamePlaceholder')}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <div className="space-y-1.5">
                          {grp.items.map((it) => (
                            <div key={it.id} className="flex items-center gap-2">
                              <input
                                value={it.text}
                                onChange={(e) => updateItemTextLocal(grp.id, it.id, e.target.value)}
                                onBlur={commitOnBlur}
                                placeholder={t('gameGroupSort.itemPlaceholder')}
                                className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => removeItemFromGroup(grp.id, it.id)}
                                className="text-on-surface-variant hover:text-error shrink-0"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => addItemToGroup(grp.id)}
                          className="font-label-md text-label-md text-primary hover:underline"
                        >
                          {t('gameGroupSort.addItemButton')}
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addGroup}
                      className="w-full px-4 py-2.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-dashed border-outline-variant transition-colors"
                    >
                      {t('gameGroupSort.addGroupButton')}
                    </button>
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
