import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import TrueFalse from '../components/TrueFalse';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig, TrueFalseStatement } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [];
}

function newStatement(): TrueFalseStatement {
  return { id: uid(), text: '', isTrue: true };
}

export default function TrueFalsePage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'truefalse',
    defaultItems,
    defaultConfig: () => ({ statements: [] }),
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
    roster,
  } = g;

  const [roundKey, setRoundKey] = useState(0);
  const demoStatements = useMemo(
    () => [
      { id: uid(), text: '"apple"는 "사과"라는 뜻이에요.', isTrue: true },
      { id: uid(), text: '"cat"는 "바나나"라는 뜻이에요.', isTrue: false, explanation: '정답은 "고양이"예요.' },
      { id: uid(), text: '"sun"은 "해"라는 뜻이에요.', isTrue: true },
    ],
    [],
  );
  const [draftStatements, setDraftStatements] = useState<TrueFalseStatement[]>(selected?.config.statements ?? []);
  const [mode, setMode] = useState<'edit' | 'play'>('play');

  useEffect(() => {
    setDraftStatements(selected?.config.statements ?? []);
    const hasPlayable = (selected?.config.statements ?? []).some((s) => s.text.trim());
    setMode(hasPlayable ? 'play' : 'edit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const playableStatements = draftStatements.filter((s) => s.text.trim());

  async function persistStatements(next: TrueFalseStatement[]) {
    if (!selected) return;
    const nextConfig: GameTemplateConfig = { ...selected.config, statements: next };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  function addStatement() {
    const next = [...draftStatements, newStatement()];
    setDraftStatements(next);
    void persistStatements(next);
  }

  function addStatementsBulk(statements: TrueFalseStatement[]) {
    const next = [...draftStatements, ...statements];
    setDraftStatements(next);
    void persistStatements(next);
  }

  function removeStatement(sid: string) {
    const next = draftStatements.filter((s) => s.id !== sid);
    setDraftStatements(next);
    void persistStatements(next);
  }

  function setAnswer(sid: string, isTrue: boolean) {
    const next = draftStatements.map((s) => (s.id === sid ? { ...s, isTrue } : s));
    setDraftStatements(next);
    void persistStatements(next);
  }

  function updateTextLocal(sid: string, text: string) {
    setDraftStatements((prev) => prev.map((s) => (s.id === sid ? { ...s, text } : s)));
  }

  function updateExplanationLocal(sid: string, explanation: string) {
    setDraftStatements((prev) => prev.map((s) => (s.id === sid ? { ...s, explanation } : s)));
  }

  function commitOnBlur() {
    void persistStatements(draftStatements);
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
      {t('gameTrueFalse.studentClassTitle', { className: studentClassName })}
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
          {t('gameTrueFalse.newButton')}
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
        <label htmlFor="tfname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="tfname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameTrueFalse.namePlaceholder')}
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
        description={t('gameTrueFalse.infoDescription')}
        steps={t('gameTrueFalse.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div>
            <GameThemeFrame roster={roster} className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <TrueFalse statements={demoStatements} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameTrueFalse.emptyStaff') : t('gameTrueFalse.emptyStudent')}
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

          {(!isStaff || mode === 'play') && (
            <GameThemeFrame
              roster={roster}
              onRestart={() => setRoundKey((k) => k + 1)}
              className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
            >
              <TrueFalse key={roundKey} statements={playableStatements} />
            </GameThemeFrame>
          )}

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameTrueFalse.settingsTitle')}</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => void handleRename()}
                      className="font-label-md text-label-md text-primary hover:underline"
                    >
                      {t('gameAdmin.rename')}
                    </button>
                    {mode === 'play' && (
                      <button
                        onClick={() => setMode('edit')}
                        className="font-label-md text-label-md text-primary hover:underline"
                      >
                        {t('gameAdmin.editQuestionsButton')}
                      </button>
                    )}
                  </div>
                </div>

                {mode === 'edit' && (
                  <div className="space-y-4">
                    <ImportFromClass candidates={importCandidates} offerRosterSwap={false} onImport={importFromClass} />
                    <div className="flex flex-wrap items-start gap-3 my-3">
                    <WordListPicker
                      variant="truefalse"
                      wordLists={wordLists}
                      loading={wordListsLoading}
                      onImportStatements={(statements) => addStatementsBulk(statements)}
                    />
                    <DictionaryPicker
                      variant="truefalse"
                      onImportStatements={(statements) => addStatementsBulk(statements)}
                    />
                    </div>

                    {draftStatements.map((s, si) => (
                      <div key={s.id} className="bg-surface-container-low rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-label-md text-label-md text-on-surface-variant">
                            {t('gameTrueFalse.statementLabel', { n: si + 1 })}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeStatement(s.id)}
                            className="font-caption text-caption text-error hover:underline"
                          >
                            {t('gameTrueFalse.removeStatementButton')}
                          </button>
                        </div>
                        <input
                          value={s.text}
                          onChange={(e) => updateTextLocal(s.id, e.target.value)}
                          onBlur={commitOnBlur}
                          placeholder={t('gameTrueFalse.statementPlaceholder')}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <div>
                          <label className="font-caption text-caption text-on-surface-variant block mb-1">
                            {t('gameTrueFalse.explanationLabel')}
                          </label>
                          <textarea
                            value={s.explanation ?? ''}
                            rows={2}
                            onChange={(e) => updateExplanationLocal(s.id, e.target.value)}
                            onBlur={(e) => {
                              const next = draftStatements.map((st) =>
                                st.id === s.id ? { ...st, explanation: e.target.value } : st,
                              );
                              setDraftStatements(next);
                              void persistStatements(next);
                            }}
                            placeholder={t('gameTrueFalse.explanationPlaceholder')}
                            className="w-full resize-y bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-caption text-caption text-on-surface-variant">
                            {t('gameTrueFalse.answerLabel')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAnswer(s.id, true)}
                            className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
                              s.isTrue
                                ? 'bg-secondary-container/60 text-on-surface'
                                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                          >
                            ⭕ {t('gameTrueFalse.trueLabel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnswer(s.id, false)}
                            className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
                              !s.isTrue
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                          >
                            ❌ {t('gameTrueFalse.falseLabel')}
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addStatement}
                      className="w-full px-4 py-2.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-dashed border-outline-variant transition-colors"
                    >
                      {t('gameTrueFalse.addStatementButton')}
                    </button>

                    <div className="flex flex-col items-center gap-1.5 pt-2">
                      <button
                        type="button"
                        disabled={playableStatements.length === 0}
                        onClick={() => setMode('play')}
                        className="px-6 py-3 rounded-full font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t('gameAdmin.finishEditingButton')}
                      </button>
                      {playableStatements.length === 0 && (
                        <p className="font-caption text-caption text-on-surface-variant">
                          {t('gameAdmin.needAtLeastOneQuestion')}
                        </p>
                      )}
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
