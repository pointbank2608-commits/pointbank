import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import EditOnly from '../components/EditOnly';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import LadderBoard from '../components/LadderBoard';
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
      // 참가자 수만큼 결과 칸이 있어야 샘플이 바로 시작된다(예전엔 3칸이라 "결과를 적거나 꽝으로 표시해 주세요"가 먼저 떴다)
      results: defaultParticipants().map((_, i) => ({ id: uid(), label: i18n.t('gameLadder.defaultResult', { n: i + 1 }) })),
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
    reload,
  } = g;

  const [roundKey, setRoundKey] = useState(0);
  const demoParticipants = useMemo(defaultParticipants, []);
  const demoResults = useMemo(
    () => [1, 2, 3].map((n) => ({ id: uid(), label: i18n.t('gameLadder.defaultResult', { n }) })),
    [],
  );

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

  async function removeParticipant(index: number) {
    if (!selected) return;
    await persist(
      selected.items.filter((_, i) => i !== index),
      results.filter((_, i) => i !== index),
    );
  }

  async function renameResultLabel(id: string, label: string) {
    if (!selected) return;
    await persist(
      selected.items,
      results.map((r) => (r.id === id ? { ...r, label } : r)),
    );
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

  if (g.noClasses) {
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
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card space-y-4">
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
      <EditOnly>
      <Link
        to="/games"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('gameAdmin.backToList')}
      </Link>
      </EditOnly>

      <GameInfoPanel
        description={t('gameLadder.infoDescription')}
        steps={t('gameLadder.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          <EditOnly>{classPicker}</EditOnly>
          <div>
            <GameThemeFrame bg="ladder" roster={roster} className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <LadderBoard participants={demoParticipants} results={demoResults} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameLadder.emptyStaff') : t('gameLadder.emptyStudent')}
            </div>
          </div>
          <EditOnly>{templateRow}</EditOnly>
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          {!isStaff && (
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
              {selected.name}
            </h2>
          )}

          <GameThemeFrame bg="ladder"
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <LadderBoard key={roundKey}
              participants={selected.items}
              results={results}
              resultOrder={selected.config.ladderResultOrder}
              music={LADDER_PROGRESS_MUSIC}
              resultSound={DEFAULT_RESULT_SOUND}
              editable={isStaff}
              onEditParticipant={(id, label) => void renameParticipant(id, label)}
              onEditResult={(id, label) => void renameResultLabel(id, label)}
              onAddColumn={() => void addColumn()}
              onRemoveColumn={() => void removeColumn()}
              onRemoveAt={(i) => {
                if (selected.items.length > 2) void removeParticipant(i);
              }}
              templateName={selected.name}
              onRenameTemplate={(name) => void handleRename(name)}
            />
          </GameThemeFrame>

          <div className="space-y-4">
            <EditOnly>{classPicker}</EditOnly>
            <EditOnly>{templateRow}</EditOnly>
            {createForm}

          </div>
        </div>
      )}
    </div>
  );
}
