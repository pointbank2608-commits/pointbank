import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import GameThemePicker from '../components/GameThemePicker';
import ImportFromClass from '../components/ImportFromClass';
import TypeAnswer from '../components/TypeAnswer';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig, TypeAnswerEntry } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [];
}

function newEntry(): TypeAnswerEntry {
  return { id: uid(), prompt: '', answer: '' };
}

export default function TypeAnswerPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'typeanswer',
    defaultItems,
    defaultConfig: () => ({ typeAnswerEntries: [], typeAnswerMode: 'question' }),
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
  } = g;

  const [editorOpen, setEditorOpen] = useState(false);
  const [draftEntries, setDraftEntries] = useState<TypeAnswerEntry[]>(selected?.config.typeAnswerEntries ?? []);
  const mode = selected?.config.typeAnswerMode ?? 'question';

  useEffect(() => {
    setDraftEntries(selected?.config.typeAnswerEntries ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const playableEntries = draftEntries.filter((e) => e.prompt.trim() && e.answer.trim());

  async function persistEntries(next: TypeAnswerEntry[]) {
    if (!selected) return;
    const nextConfig: GameTemplateConfig = { ...selected.config, typeAnswerEntries: next };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  async function persistMode(nextMode: 'question' | 'cloze') {
    if (!selected) return;
    const nextConfig: GameTemplateConfig = { ...selected.config, typeAnswerMode: nextMode };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  function addEntry() {
    const next = [...draftEntries, newEntry()];
    setDraftEntries(next);
    void persistEntries(next);
  }

  function removeEntry(eid: string) {
    const next = draftEntries.filter((e) => e.id !== eid);
    setDraftEntries(next);
    void persistEntries(next);
  }

  function updatePromptLocal(eid: string, text: string) {
    setDraftEntries((prev) => prev.map((e) => (e.id === eid ? { ...e, prompt: text } : e)));
  }

  function updateAnswerLocal(eid: string, text: string) {
    setDraftEntries((prev) => prev.map((e) => (e.id === eid ? { ...e, answer: text } : e)));
  }

  function commitOnBlur() {
    void persistEntries(draftEntries);
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
      {t('gameTypeAnswer.studentClassTitle', { className: studentClassName })}
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
          {t('gameTypeAnswer.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div>
        <label htmlFor="taname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="taname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameTypeAnswer.namePlaceholder')}
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
        description={t('gameTypeAnswer.infoDescription')}
        steps={t('gameTypeAnswer.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div className="text-center py-16 bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <div className="text-5xl mb-3">⌨️</div>
            <div className="font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameTypeAnswer.emptyStaff') : t('gameTypeAnswer.emptyStudent')}
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
            <TypeAnswer entries={playableEntries} mode={mode} />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameTypeAnswer.settingsTitle')}</h4>
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
                    <GameThemePicker value={selected.config.theme} onChange={(theme) => void handleThemeChange(theme)} />
                    <ImportFromClass candidates={importCandidates} offerRosterSwap={false} onImport={importFromClass} />

                    <div>
                      <div className="font-caption text-caption text-on-surface-variant mb-2">
                        {t('gameTypeAnswer.modeLabel')}
                      </div>
                      <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
                        <button
                          type="button"
                          onClick={() => void persistMode('question')}
                          className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                            mode === 'question' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                          }`}
                        >
                          {t('gameTypeAnswer.modeQuestion')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void persistMode('cloze')}
                          className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                            mode === 'cloze' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                          }`}
                        >
                          {t('gameTypeAnswer.modeCloze')}
                        </button>
                      </div>
                      <div className="font-caption text-caption text-on-surface-variant mt-1.5">
                        {mode === 'cloze' ? t('gameTypeAnswer.modeClozeHint') : t('gameTypeAnswer.modeQuestionHint')}
                      </div>
                    </div>

                    {draftEntries.map((entry, ei) => (
                      <div key={entry.id} className="bg-surface-container-low rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-label-md text-label-md text-on-surface-variant">
                            {t('gameTypeAnswer.entryLabel', { n: ei + 1 })}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id)}
                            className="font-caption text-caption text-error hover:underline"
                          >
                            {t('gameTypeAnswer.removeEntryButton')}
                          </button>
                        </div>
                        <input
                          value={entry.prompt}
                          onChange={(e) => updatePromptLocal(entry.id, e.target.value)}
                          onBlur={commitOnBlur}
                          placeholder={mode === 'cloze' ? t('gameTypeAnswer.promptClozePlaceholder') : t('gameTypeAnswer.promptQuestionPlaceholder')}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <input
                          value={entry.answer}
                          onChange={(e) => updateAnswerLocal(entry.id, e.target.value)}
                          onBlur={commitOnBlur}
                          placeholder={t('gameTypeAnswer.answerFieldPlaceholder')}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addEntry}
                      className="w-full px-4 py-2.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-dashed border-outline-variant transition-colors"
                    >
                      {t('gameTypeAnswer.addEntryButton')}
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
