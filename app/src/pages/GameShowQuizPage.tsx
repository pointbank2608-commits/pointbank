import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameShowQuiz from '../components/GameShowQuiz';
import GameThemeFrame from '../components/GameThemeFrame';
import GameThemePicker from '../components/GameThemePicker';
import ImportFromClass from '../components/ImportFromClass';
import WordListPicker from '../components/WordListPicker';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig, QuizQuestion } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [];
}

function newQuestion(): QuizQuestion {
  return { id: uid(), question: '', choices: ['', '', '', ''], correctIndex: 0 };
}

const DEFAULT_BONUS_EVERY = 5;
const DEFAULT_LIFELINES = 2;

export default function GameShowQuizPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'gameshowquiz',
    defaultItems,
    defaultConfig: () => ({ questions: [] }),
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
  const [draftQuestions, setDraftQuestions] = useState<QuizQuestion[]>(selected?.config.questions ?? []);

  useEffect(() => {
    setDraftQuestions(selected?.config.questions ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const playableQuestions = draftQuestions.filter(
    (q) => q.question.trim() && q.choices.length >= 2 && q.choices.every((c) => c.trim()),
  );
  const bonusEvery = selected?.config.gameShowBonusEvery ?? DEFAULT_BONUS_EVERY;
  const lifelines = selected?.config.gameShowLifelines ?? DEFAULT_LIFELINES;

  async function persistConfig(nextConfig: GameTemplateConfig) {
    if (!selected) return;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  function addQuestion() {
    const next = [...draftQuestions, newQuestion()];
    setDraftQuestions(next);
    void persistConfig({ ...selected?.config, questions: next });
  }

  function addQuestionsBulk(questions: QuizQuestion[]) {
    const next = [...draftQuestions, ...questions];
    setDraftQuestions(next);
    void persistConfig({ ...selected?.config, questions: next });
  }

  function removeQuestion(qid: string) {
    const next = draftQuestions.filter((q) => q.id !== qid);
    setDraftQuestions(next);
    void persistConfig({ ...selected?.config, questions: next });
  }

  function markCorrect(qid: string, choiceIndex: number) {
    const next = draftQuestions.map((q) => (q.id === qid ? { ...q, correctIndex: choiceIndex } : q));
    setDraftQuestions(next);
    void persistConfig({ ...selected?.config, questions: next });
  }

  function addChoice(qid: string) {
    const next = draftQuestions.map((q) =>
      q.id === qid && q.choices.length < 6 ? { ...q, choices: [...q.choices, ''] } : q,
    );
    setDraftQuestions(next);
    void persistConfig({ ...selected?.config, questions: next });
  }

  function removeChoice(qid: string, choiceIndex: number) {
    const next = draftQuestions.map((q) => {
      if (q.id !== qid || q.choices.length <= 2) return q;
      const choices = q.choices.filter((_, i) => i !== choiceIndex);
      let correctIndex = q.correctIndex;
      if (choiceIndex === correctIndex) correctIndex = 0;
      else if (choiceIndex < correctIndex) correctIndex -= 1;
      return { ...q, choices, correctIndex };
    });
    setDraftQuestions(next);
    void persistConfig({ ...selected?.config, questions: next });
  }

  function updateQuestionTextLocal(qid: string, text: string) {
    setDraftQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, question: text } : q)));
  }

  function updateChoiceTextLocal(qid: string, choiceIndex: number, text: string) {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const choices = [...q.choices];
        choices[choiceIndex] = text;
        return { ...q, choices };
      }),
    );
  }

  function commitOnBlur() {
    void persistConfig({ ...selected?.config, questions: draftQuestions });
  }

  function setBonusEvery(n: number) {
    void persistConfig({ ...selected?.config, gameShowBonusEvery: Math.max(2, n || DEFAULT_BONUS_EVERY) });
  }

  function setLifelines(n: number) {
    void persistConfig({ ...selected?.config, gameShowLifelines: Math.max(0, n) });
  }

  async function handleThemeChange(theme: GameTemplateConfig['theme'] | null) {
    void persistConfig({ ...selected?.config, theme: theme ?? undefined });
  }

  if (isStaff && classes.length === 0) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('gameAdmin.noClasses')}</div>;
  }
  if (!isStaff && !classId) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  const classPicker = isStaff ? (
    <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
  ) : (
    <h2 className="font-title-md text-title-md text-on-surface">
      {t('gameGameShowQuiz.studentClassTitle', { className: studentClassName })}
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
          <button onClick={() => setSelectedId(tpl.id)} className="pl-4 pr-2 py-2 font-label-md text-label-md flex items-center gap-1.5">
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
          {t('gameGameShowQuiz.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div>
        <label htmlFor="gsqname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="gsqname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameGameShowQuiz.namePlaceholder')}
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
      <Link to="/games" className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
        {t('gameAdmin.backToList')}
      </Link>

      <GameInfoPanel
        description={t('gameGameShowQuiz.infoDescription')}
        steps={t('gameGameShowQuiz.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div className="text-center py-16 bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <div className="text-5xl mb-3">🎪</div>
            <div className="font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameGameShowQuiz.emptyStaff') : t('gameGameShowQuiz.emptyStudent')}
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
            className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]"
          >
            <GameShowQuiz questions={playableQuestions} bonusEvery={bonusEvery} lifelines={lifelines} />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameGameShowQuiz.settingsTitle')}</h4>
                  <div className="flex gap-3">
                    <button onClick={() => void handleRename()} className="font-label-md text-label-md text-primary hover:underline">
                      {t('gameAdmin.rename')}
                    </button>
                    <button onClick={() => setEditorOpen((v) => !v)} className="font-label-md text-label-md text-primary hover:underline">
                      {editorOpen ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
                    </button>
                  </div>
                </div>

                {editorOpen && (
                  <div className="space-y-4">
                    <GameThemePicker value={selected.config.theme} onChange={(theme) => void handleThemeChange(theme)} />
                    <ImportFromClass candidates={importCandidates} offerRosterSwap={false} onImport={importFromClass} />
                    <WordListPicker
                      variant="quiz"
                      wordLists={wordLists}
                      loading={wordListsLoading}
                      onImportQuestions={(questions) => addQuestionsBulk(questions)}
                    />

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label htmlFor="gsqbonus" className="font-label-md text-label-md text-on-surface-variant shrink-0">
                          {t('gameGameShowQuiz.bonusEveryLabel')}
                        </label>
                        <input
                          id="gsqbonus"
                          type="number"
                          min={2}
                          max={20}
                          value={bonusEvery}
                          onChange={(e) => setBonusEvery(Number(e.target.value))}
                          className="w-20 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="gsqlifelines" className="font-label-md text-label-md text-on-surface-variant shrink-0">
                          {t('gameGameShowQuiz.lifelinesLabel')}
                        </label>
                        <input
                          id="gsqlifelines"
                          type="number"
                          min={0}
                          max={10}
                          value={lifelines}
                          onChange={(e) => setLifelines(Number(e.target.value))}
                          className="w-20 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>

                    {draftQuestions.map((q, qi) => (
                      <div key={q.id} className="bg-surface-container-low rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-label-md text-label-md text-on-surface-variant">
                            {t('gameGameShowQuiz.questionLabel', { n: qi + 1 })}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeQuestion(q.id)}
                            className="font-caption text-caption text-error hover:underline"
                          >
                            {t('gameGameShowQuiz.removeQuestionButton')}
                          </button>
                        </div>
                        <input
                          value={q.question}
                          onChange={(e) => updateQuestionTextLocal(q.id, e.target.value)}
                          onBlur={commitOnBlur}
                          placeholder={t('gameGameShowQuiz.questionPlaceholder')}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <div className="font-caption text-caption text-on-surface-variant">
                          {t('gameGameShowQuiz.markCorrectHint')}
                        </div>
                        <div className="space-y-1.5">
                          {q.choices.map((choice, ci) => (
                            <div key={ci} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => markCorrect(q.id, ci)}
                                aria-label={t('gameGameShowQuiz.markCorrectHint')}
                                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                  ci === q.correctIndex
                                    ? 'bg-secondary text-on-secondary'
                                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                                }`}
                              >
                                ✓
                              </button>
                              <input
                                value={choice}
                                onChange={(e) => updateChoiceTextLocal(q.id, ci, e.target.value)}
                                onBlur={commitOnBlur}
                                placeholder={t('gameGameShowQuiz.choicePlaceholder', { n: ci + 1 })}
                                className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                              />
                              {q.choices.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeChoice(q.id, ci)}
                                  className="text-on-surface-variant hover:text-error shrink-0"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {q.choices.length < 6 && (
                          <button
                            type="button"
                            onClick={() => addChoice(q.id)}
                            className="font-label-md text-label-md text-primary hover:underline"
                          >
                            {t('gameGameShowQuiz.addChoiceButton')}
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addQuestion}
                      className="w-full px-4 py-2.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-dashed border-outline-variant transition-colors"
                    >
                      {t('gameGameShowQuiz.addQuestionButton')}
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
