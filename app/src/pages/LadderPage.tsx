import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import LadderBoard from '../components/LadderBoard';
import OpenInOtherGame from '../components/OpenInOtherGame';
import StudentRosterPicker from '../components/StudentRosterPicker';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import { updateGameTemplate } from '../lib/api';
import { DEFAULT_RESULT_SOUND } from '../lib/gameMusic';
import i18n from '../i18n';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, MusicSelection } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultParticipants(): GameItem[] {
  return [1, 2, 3].map((n) => ({ id: uid(), label: i18n.t('gameLadder.defaultParticipant', { n }) }));
}

/** 사다리 진행 음악은 커스터마이즈 UI 없이 이 파일로 고정한다(돌림판 회전음과 같은 이유).
 * 사다리가 참가자에서 결과까지 내려가는 애니메이션(RUN_MS) 동안만 재생되다가 끊기므로,
 * 원본이 훨씬 길어도(51초) 실제로는 앞부분 몇 초만 들린다 — 그래서 그 구간만 잘라서 담아둔다. */
const LADDER_PROGRESS_MUSIC: MusicSelection = {
  kind: 'upload',
  path: '',
  name: '사다리 진행음',
  url: '/sounds/ladder-progress.m4a?v=1',
};

export default function LadderPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'ladder',
    defaultItems: defaultParticipants,
    defaultConfig: () => ({
      results: [1, 2, 3].map((n) => ({ id: uid(), label: i18n.t('gameLadder.defaultResult', { n }) })),
    }),
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

  const [editorOpen, setEditorOpen] = useState(true);
  const [roundKey, setRoundKey] = useState(0);
  const demoParticipants = useMemo(defaultParticipants, []);
  const demoResults = useMemo(
    () => [1, 2, 3].map((n) => ({ id: uid(), label: i18n.t('gameLadder.defaultResult', { n }) })),
    [],
  );
  const [newParticipant, setNewParticipant] = useState('');

  const results = selected?.config.results ?? selected?.items ?? [];

  async function persist(nextItems: GameItem[], nextResults: GameItem[]) {
    if (!selected) return;
    const nextConfig = { ...selected.config, results: nextResults };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, items: nextItems, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { items: nextItems, config: nextConfig });
    } catch {
      await reload();
    }
  }

  async function addParticipant() {
    const label = newParticipant.trim();
    if (!label || !selected) return;
    await persist(
      [...selected.items, { id: uid(), label }],
      [...results, { id: uid(), label: t('gameLadder.defaultResult', { n: results.length + 1 }) }],
    );
    setNewParticipant('');
  }

  async function addParticipantsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    const newItems = labels.map((label) => ({ id: uid(), label }));
    const newResults = labels.map((_, i) => ({ id: uid(), label: t('gameLadder.defaultResult', { n: results.length + i + 1 }) }));
    await persist([...selected.items, ...newItems], [...results, ...newResults]);
  }

  async function removeParticipant(index: number) {
    if (!selected) return;
    await persist(
      selected.items.filter((_, i) => i !== index),
      results.filter((_, i) => i !== index),
    );
  }

  async function clearAllParticipants() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameLadder.clearAllConfirm'))) return;
    await persist([], []);
  }

  async function renameResultLabel(id: string, label: string) {
    if (!selected) return;
    await persist(
      selected.items,
      results.map((r) => (r.id === id ? { ...r, label } : r)),
    );
  }

  async function renameResult(index: number) {
    if (!selected) return;
    const target = results[index];
    const next = prompt(t('gameLadder.renameResultPrompt'), target?.label ?? '');
    if (next == null || !next.trim()) return;
    await renameResultLabel(target.id, next.trim());
  }

  async function renameParticipant(id: string, label: string) {
    if (!selected) return;
    await persist(
      selected.items.map((it) => (it.id === id ? { ...it, label } : it)),
      results,
    );
  }

  async function addColumn() {
    if (!selected) return;
    const n = selected.items.length + 1;
    await persist(
      [...selected.items, { id: uid(), label: t('gameLadder.defaultParticipant', { n }) }],
      [...results, { id: uid(), label: t('gameLadder.defaultResult', { n }) }],
    );
  }

  async function removeColumn() {
    if (!selected || selected.items.length <= 2) return;
    await persist(selected.items.slice(0, -1), results.slice(0, -1));
  }

  async function resetResultsToParticipants() {
    if (!selected) return;
    await persist(
      selected.items,
      selected.items.map((it) => ({ id: uid(), label: it.label })),
    );
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
      {t('gameLadder.studentClassTitle', { className: studentClassName })}
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
          {t('gameLadder.newButton')}
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
        <label htmlFor="lname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="lname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameLadder.namePlaceholder')}
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
        description={t('gameLadder.infoDescription')}
        steps={t('gameLadder.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div>
            <GameThemeFrame roster={roster} className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <LadderBoard participants={demoParticipants} results={demoResults} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameLadder.emptyStaff') : t('gameLadder.emptyStudent')}
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
            <LadderBoard key={roundKey}
              participants={selected.items}
              results={results}
              music={LADDER_PROGRESS_MUSIC}
              resultSound={DEFAULT_RESULT_SOUND}
              editable={isStaff}
              onEditParticipant={(id, label) => void renameParticipant(id, label)}
              onEditResult={(id, label) => void renameResultLabel(id, label)}
              onAddColumn={() => void addColumn()}
              onRemoveColumn={() => void removeColumn()}
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
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameLadder.settingsTitle')}</h4>
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
                    <div className="flex flex-wrap items-start gap-2 my-3 [&>*]:min-w-[180px] [&>*]:flex-none">
                    <div className="flex-1 [&>div]:my-0">
                      <StudentRosterPicker
                        roster={roster}
                        existingLabels={selected.items.map((i) => i.label)}
                        scope={rosterScope}
                        onScopeChange={setRosterScope}
                        loading={rosterLoading}
                        onAdd={(labels) => void addParticipantsBulk(labels)}
                      />
                    </div>
                    <WordListPicker
                      variant="label"
                      wordLists={wordLists}
                      loading={wordListsLoading}
                      onImportLabels={(labels) => void addParticipantsBulk(labels)}
                    />
                    <DictionaryPicker
                      variant="label"
                      onImportLabels={(labels) => void addParticipantsBulk(labels)}
                    />
                    </div>
                    <div className="font-caption text-caption text-on-surface-variant mb-1">{t('gameLadder.participantsLabel')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.items.map((item, i) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
                        >
                          {item.label}
                          <button
                            onClick={() => void removeParticipant(i)}
                            className="text-on-surface-variant hover:text-error"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
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
                        {t('gameLadder.resultsLabel')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {results.map((r, i) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => void renameResult(i)}
                            className="px-3 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors"
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => void resetResultsToParticipants()}
                        className="mt-3 font-label-md text-label-md text-primary hover:underline"
                      >
                        {t('gameLadder.resetResultsButton')}
                      </button>
                    </div>

                    <div className="pt-3">
                      <OpenInOtherGame currentType="ladder" itemCount={selected.items.length} onOpen={openInOtherGame} />
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
