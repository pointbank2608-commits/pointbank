import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import MathGenerator from '../components/MathGenerator';
import GameThemeFrame from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig, MathOperation } from '../lib/types';

function defaultItems(): GameItem[] {
  return [];
}

const DEFAULT_OPERATIONS: MathOperation[] = ['add', 'sub'];
const DEFAULT_MIN = 1;
const DEFAULT_MAX = 20;
const DEFAULT_COUNT = 10;

const OPERATIONS: MathOperation[] = ['add', 'sub', 'mul', 'div'];

export default function MathGeneratorPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'mathgen',
    defaultItems,
    defaultConfig: () => ({
      mathOperations: DEFAULT_OPERATIONS,
      mathMin: DEFAULT_MIN,
      mathMax: DEFAULT_MAX,
      mathQuestionCount: DEFAULT_COUNT,
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
    roster,
  } = g;

  const [editorOpen, setEditorOpen] = useState(true);
  const [roundKey, setRoundKey] = useState(0);
  const operations = selected?.config.mathOperations ?? DEFAULT_OPERATIONS;
  const min = selected?.config.mathMin ?? DEFAULT_MIN;
  const max = selected?.config.mathMax ?? DEFAULT_MAX;
  const count = selected?.config.mathQuestionCount ?? DEFAULT_COUNT;

  const [minInput, setMinInput] = useState(String(min));
  const [maxInput, setMaxInput] = useState(String(max));
  const [countInput, setCountInput] = useState(String(count));

  useEffect(() => {
    setMinInput(String(min));
    setMaxInput(String(max));
    setCountInput(String(count));
  }, [min, max, count]);

  async function persistConfig(patch: Partial<GameTemplateConfig>) {
    if (!selected) return;
    const nextConfig = { ...selected.config, ...patch };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  function toggleOperation(op: MathOperation) {
    const has = operations.includes(op);
    const next = has ? operations.filter((o) => o !== op) : [...operations, op];
    if (next.length === 0) return;
    void persistConfig({ mathOperations: next });
  }

  function commitMin() {
    const n = Math.max(0, Math.round(Number(minInput)) || DEFAULT_MIN);
    void persistConfig({ mathMin: n });
  }

  function commitMax() {
    const n = Math.max(1, Math.round(Number(maxInput)) || DEFAULT_MAX);
    void persistConfig({ mathMax: n });
  }

  function commitCount() {
    const n = Math.min(30, Math.max(1, Math.round(Number(countInput)) || DEFAULT_COUNT));
    void persistConfig({ mathQuestionCount: n });
  }

  async function handleStyleChange(style: 'slate' | 'blocks') {
    await persistConfig({ mathgenStyle: style });
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
      {t('gameMathGen.studentClassTitle', { className: studentClassName })}
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
          {t('gameMathGen.newButton')}
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
        <label htmlFor="mgname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="mgname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameMathGen.namePlaceholder')}
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
        description={t('gameMathGen.infoDescription')}
        steps={t('gameMathGen.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div>
            <GameThemeFrame roster={roster} className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <MathGenerator operations={operations} min={min} max={max} questionCount={count} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameMathGen.emptyStaff') : t('gameMathGen.emptyStudent')}
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
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <MathGenerator
              key={roundKey}
              operations={operations}
              min={min}
              max={max}
              questionCount={count}
              boardStyle={selected.config.mathgenStyle === 'blocks' ? 'blocks' : 'slate'}
            />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameMathGen.settingsTitle')}</h4>
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
                    {t('gameMathGen.styleLabel')}
                  </span>
                  {(['slate', 'blocks'] as const).map((style) => {
                    const on = (selected.config.mathgenStyle ?? 'slate') === style;
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
                        {style === 'slate' ? t('gameMathGen.styleSlate') : t('gameMathGen.styleBlocks')}
                      </button>
                    );
                  })}
                </div>

                {editorOpen && (
                  <div className="space-y-4">
                    <ImportFromClass candidates={importCandidates} offerRosterSwap={false} onImport={importFromClass} />

                    <div>
                      <div className="font-caption text-caption text-on-surface-variant mb-2">
                        {t('gameMathGen.operationsLabel')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {OPERATIONS.map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => toggleOperation(op)}
                            className={`px-4 py-2 rounded-full font-label-md text-label-md border-2 transition-colors ${
                              operations.includes(op)
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'
                            }`}
                          >
                            {t(`gameMathGen.op${op}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6">
                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">
                          {t('gameMathGen.rangeLabel')}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={minInput}
                            onChange={(e) => setMinInput(e.target.value)}
                            onBlur={commitMin}
                            className="w-[80px] bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                          <span className="font-body-md text-on-surface-variant">~</span>
                          <input
                            type="number"
                            value={maxInput}
                            onChange={(e) => setMaxInput(e.target.value)}
                            onBlur={commitMax}
                            className="w-[80px] bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">
                          {t('gameMathGen.countLabel')}
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={countInput}
                          onChange={(e) => setCountInput(e.target.value)}
                          onBlur={commitCount}
                          className="w-[80px] bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
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
