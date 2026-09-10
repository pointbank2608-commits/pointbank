import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import SaveOrGiveIt, { type SaveOrGivePlayer } from '../components/SaveOrGiveIt';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import OpenInOtherGame from '../components/OpenInOtherGame';
import StudentRosterPicker from '../components/StudentRosterPicker';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import { updateGameTemplate } from '../lib/api';
import { colorFor } from '../lib/wheel';
import i18n from '../i18n';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, SaveOrGiveReward } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [1, 2, 3, 4, 5].map((n) => ({ id: uid(), label: i18n.t('gameSaveOrGive.defaultItem', { n }) }));
}

const DEFAULT_REWARD_POOL: SaveOrGiveReward[] = [
  { kind: 'points', value: 100 },
  { kind: 'points', value: -50 },
  { kind: 'swap' },
  { kind: 'points', value: 0 },
];

const MIN_TEAM_COUNT = 2;
const MAX_TEAM_COUNT = 8;

function teamPlayers(count: number, t: (key: string, opts?: Record<string, unknown>) => string): SaveOrGivePlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i}`,
    label: t('gameSaveOrGive.teamName', { n: i + 1 }),
    color: colorFor(i),
  }));
}

function individualPlayers(participants: GameItem[]): SaveOrGivePlayer[] {
  return participants.map((p, i) => ({ id: p.id, label: p.label, color: colorFor(i) }));
}

export default function SaveOrGivePage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'saveorgive',
    defaultItems,
    defaultConfig: () => ({ rewardPool: DEFAULT_REWARD_POOL }),
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
  const demoItems = useMemo(defaultItems, []);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newParticipantLabel, setNewParticipantLabel] = useState('');
  const rewardPool = selected?.config.rewardPool ?? DEFAULT_REWARD_POOL;
  const mode = selected?.config.saveOrGiveMode ?? 'team';
  const teamCount = selected?.config.saveOrGiveTeamCount ?? 2;
  const participants = selected?.config.saveOrGiveParticipants ?? [];
  const demoPlayers = useMemo(() => teamPlayers(2, t), [t]);
  const players = mode === 'individual' ? individualPlayers(participants) : teamPlayers(teamCount, t);

  async function persistConfig(patch: Partial<NonNullable<typeof selected>['config']>) {
    if (!selected) return;
    const nextConfig = { ...selected.config, ...patch };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
    }
    setRoundKey((k) => k + 1);
  }

  async function setMode(next: 'individual' | 'team') {
    if (next === mode) return;
    await persistConfig({ saveOrGiveMode: next });
  }

  async function setTeamCount(next: number) {
    const clamped = Math.max(MIN_TEAM_COUNT, Math.min(MAX_TEAM_COUNT, next));
    if (clamped === teamCount) return;
    await persistConfig({ saveOrGiveTeamCount: clamped });
  }

  async function addParticipant() {
    const label = newParticipantLabel.trim();
    if (!label) return;
    await persistConfig({ saveOrGiveParticipants: [...participants, { id: uid(), label }] });
    setNewParticipantLabel('');
  }

  async function addParticipantsBulk(labels: string[]) {
    if (labels.length === 0) return;
    await persistConfig({ saveOrGiveParticipants: [...participants, ...labels.map((label) => ({ id: uid(), label }))] });
  }

  async function removeParticipant(id: string) {
    await persistConfig({ saveOrGiveParticipants: participants.filter((p) => p.id !== id) });
  }

  async function clearAllParticipants() {
    if (participants.length === 0) return;
    if (!confirm(t('gameSaveOrGive.clearAllConfirm'))) return;
    await persistConfig({ saveOrGiveParticipants: [] });
  }

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

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label || !selected) return;
    if (await persistItems([...selected.items, { id: uid(), label }])) notify(t('gameAdmin.itemAddedToast'));
    setNewItemLabel('');
  }

  async function addItemsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    if (await persistItems([...selected.items, ...labels.map((label) => ({ id: uid(), label }))])) {
      notify(t('gameAdmin.itemsAddedToast', { count: labels.length }));
    }
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function clearAllItems() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameSaveOrGive.clearAllConfirm'))) return;
    await persistItems([]);
  }

  /** 게임 화면에서 항목을 탭해서 바로 이름을 바꿀 때 쓴다. */
  async function renameItemLabel(itemId: string, label: string) {
    if (!selected) return;
    await persistItems(selected.items.map((i) => (i.id === itemId ? { ...i, label } : i)));
  }

  async function addQuickItem() {
    if (!selected) return;
    const n = selected.items.length + 1;
    if (await persistItems([...selected.items, { id: uid(), label: i18n.t('gameSaveOrGive.defaultItem', { n }) }])) {
      notify(t('gameAdmin.itemAddedToast'));
    }
  }

  async function removeLastItem() {
    if (!selected || selected.items.length <= 1) return;
    await persistItems(selected.items.slice(0, -1));
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
      {t('gameSaveOrGive.studentClassTitle', { className: studentClassName })}
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
          {t('gameSaveOrGive.newButton')}
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
        <label htmlFor="sgname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="sgname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameSaveOrGive.namePlaceholder')}
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
        description={t('gameSaveOrGive.infoDescription')}
        steps={t('gameSaveOrGive.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div>
            <GameThemeFrame roster={roster} className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <SaveOrGiveIt items={demoItems} rewardPool={rewardPool} players={demoPlayers} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameSaveOrGive.emptyStaff') : t('gameSaveOrGive.emptyStudent')}
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
            <SaveOrGiveIt
              key={roundKey}
              items={selected.items}
              rewardPool={rewardPool}
              players={players}
              editable={isStaff}
              onEditItem={(id, label) => void renameItemLabel(id, label)}
              templateName={selected.name}
              onRenameTemplate={(name) => void handleRename(name)}
              onAddItem={() => void addQuickItem()}
              onRemoveItem={() => void removeLastItem()}
            />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameSaveOrGive.settingsTitle')}</h4>
                  <button
                    onClick={() => setEditorOpen((v) => !v)}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    {editorOpen ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
                  </button>
                </div>

                {editorOpen && (
                  <div className="space-y-1 divide-y divide-surface-container">
                    <div className="pb-3">
                      <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameSaveOrGive.modeLabel')}</div>
                      <div className="flex bg-surface-container-lowest rounded-lg p-1 w-fit mb-3">
                        <button
                          type="button"
                          onClick={() => void setMode('team')}
                          className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                            mode === 'team' ? 'bg-surface-container-lowest text-primary shadow-sm bg-primary text-on-primary' : 'text-on-surface-variant'
                          }`}
                        >
                          {t('gameSaveOrGive.modeTeam')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void setMode('individual')}
                          className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                            mode === 'individual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                          }`}
                        >
                          {t('gameSaveOrGive.modeIndividual')}
                        </button>
                      </div>

                      {mode === 'team' ? (
                        <div className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 w-fit">
                          <button
                            type="button"
                            onClick={() => void setTeamCount(teamCount - 1)}
                            disabled={teamCount <= MIN_TEAM_COUNT}
                            aria-label={t('gameSaveOrGive.decreaseTeamCount')}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">remove</span>
                          </button>
                          <span className="font-label-md text-label-md text-on-surface-variant tabular-nums px-1">
                            {t('gameSaveOrGive.teamCountLabel', { count: teamCount })}
                          </span>
                          <button
                            type="button"
                            onClick={() => void setTeamCount(teamCount + 1)}
                            disabled={teamCount >= MAX_TEAM_COUNT}
                            aria-label={t('gameSaveOrGive.increaseTeamCount')}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">add</span>
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-start gap-2 mb-2 [&>*]:min-w-[180px] [&>*]:flex-none">
                            <StudentRosterPicker
                              roster={roster}
                              existingLabels={participants.map((p) => p.label)}
                              scope={rosterScope}
                              onScopeChange={setRosterScope}
                              loading={rosterLoading}
                              onAdd={(labels) => void addParticipantsBulk(labels)}
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {participants.length === 0 ? (
                              <span className="font-caption text-caption text-on-surface-variant">
                                {t('gameAdmin.noParticipants')}
                              </span>
                            ) : (
                              participants.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
                                >
                                  {p.label}
                                  <button onClick={() => void removeParticipant(p.id)} className="text-on-surface-variant hover:text-error">
                                    ✕
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                          {participants.length > 0 && (
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
                              value={newParticipantLabel}
                              onChange={(e) => setNewParticipantLabel(e.target.value)}
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
                      )}
                    </div>
                    <div className="pt-3">
                    <div className="flex flex-wrap items-start gap-2 my-3 [&>*]:min-w-[180px] [&>*]:flex-none">
                    <div className="flex-1 [&>div]:my-0">
                      <StudentRosterPicker
                        roster={roster}
                        existingLabels={selected.items.map((i) => i.label)}
                        scope={rosterScope}
                        onScopeChange={setRosterScope}
                        loading={rosterLoading}
                        onAdd={(labels) => void addItemsBulk(labels)}
                      />
                    </div>
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

                    <div className="pt-3">
                      <OpenInOtherGame currentType="saveorgive" itemCount={selected.items.length} onOpen={openInOtherGame} />
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
