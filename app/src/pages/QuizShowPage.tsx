import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import EditOnly from '../components/EditOnly';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import QuizShowHost from '../components/QuizShowHost';
import { updateGameTemplate } from '../lib/api';
import { wordListToCards } from '../lib/gameFromWords';
import { buildContestQuestions, contestRoundNames, isLiveQuestionReady, LIVE_KINDS, newLiveQuestion } from '../lib/liveQuiz';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, GameTemplateConfig, LiveQuestion, LiveQuestionKind } from '../lib/types';

function defaultItems(): GameItem[] {
  return [];
}

const input =
  'w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none';

export default function QuizShowPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({ gameType: 'quizshow', defaultItems, defaultConfig: () => ({ liveQuestions: [] }) });
  const {
    isStaff,
    classes,
    staffClassId,
    selectClass,
    reorderClasses,
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
    handleCreate,
    handleRename,
    handleDeleteTemplate,
    scopeLabel,
    reload,
    wordLists,
    wordListsLoading,
  } = g;

  const [draft, setDraft] = useState<LiveQuestion[]>(selected?.config.liveQuestions ?? []);
  const [mode, setMode] = useState<'edit' | 'play'>('play');
  const [listId, setListId] = useState('');
  const [perRound, setPerRound] = useState(5);

  useEffect(() => {
    const qs = selected?.config.liveQuestions ?? [];
    setDraft(qs);
    setMode(qs.some(isLiveQuestionReady) ? 'play' : 'edit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const demo = useMemo(
    () =>
      buildContestQuestions(
        [
          { id: 'd1', word: 'apple', meaning: '사과', imageUrl: null },
          { id: 'd2', word: 'cat', meaning: '고양이', imageUrl: null },
          { id: 'd3', word: 'sun', meaning: '해', imageUrl: null },
          { id: 'd4', word: 'book', meaning: '책', imageUrl: null },
        ],
        contestRoundNames(t),
        2,
      ),
    [t],
  );

  const playable = draft.filter(isLiveQuestionReady);
  const speedBonus = selected?.config.liveSpeedBonus ?? true;

  async function persist(nextConfig: GameTemplateConfig) {
    if (!selected) return;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }
  function save(next: LiveQuestion[]) {
    setDraft(next);
    void persist({ ...selected?.config, liveQuestions: next });
  }
  function patchLocal(id: string, patch: Partial<LiveQuestion>) {
    setDraft((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function patchSave(id: string, patch: Partial<LiveQuestion>) {
    save(draft.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function commit() {
    void persist({ ...selected?.config, liveQuestions: draft });
  }
  function move(id: string, dir: -1 | 1) {
    const i = draft.findIndex((q) => q.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  }
  function changeKind(q: LiveQuestion, kind: LiveQuestionKind) {
    const fresh = newLiveQuestion(kind, q.round);
    patchSave(q.id, { ...fresh, id: q.id, prompt: q.prompt, imageUrl: q.imageUrl, answer: fresh.answer !== undefined ? q.answer ?? '' : undefined });
  }
  function generate(replace: boolean) {
    const list = wordLists.find((w) => w.id === listId);
    if (!list) return;
    const qs = buildContestQuestions(wordListToCards(list), contestRoundNames(t), perRound);
    if (qs.length === 0) {
      alert(t('liveQuiz.needWords'));
      return;
    }
    if (replace && draft.length > 0 && !confirm(t('liveQuiz.replaceConfirm'))) return;
    save(replace ? qs : [...draft, ...qs]);
  }

  if (g.noClasses) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('gameAdmin.noClasses')}</div>;
  }

  const classPicker = isStaff && (
    <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
  );

  const templateRow = (
    <div className="flex flex-wrap gap-2">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className={`flex items-center rounded-full overflow-hidden ${
            tpl.id === selectedId ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40'
          }`}
        >
          <button onClick={() => setSelectedId(tpl.id)} className="pl-4 pr-2 py-2 font-label-md text-label-md flex items-center gap-1.5">
            {tpl.name}
            <span className="font-caption text-caption opacity-70">{scopeLabel(tpl)}</span>
          </button>
          {isStaff && (
            <button type="button" title={t('gameAdmin.delete')} onClick={() => void handleDeleteTemplate(tpl.id)} className="pr-3 pl-1 py-2 opacity-70 hover:opacity-100">
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
          {t('liveQuiz.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-3">
      <label className="font-label-md text-label-md text-on-surface-variant block">{t('gameAdmin.nameFieldLabel')}</label>
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder={t('liveQuiz.namePlaceholder')}
        onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
        className={input}
      />
      <div className="flex gap-2">
        <button
          onClick={() => void handleCreate()}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container"
        >
          {submitting ? t('gameAdmin.creating') : t('gameAdmin.create')}
        </button>
        <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
          {t('gameAdmin.cancel')}
        </button>
      </div>
    </div>
  );

  const hostClassId = staffClassId ?? classId ?? null;

  return (
    <div className="space-y-6">
      <EditOnly>
        <Link to="/games" className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
          {t('gameAdmin.backToList')}
        </Link>
      </EditOnly>

      <GameInfoPanel description={t('liveQuiz.infoDescription')} steps={t('liveQuiz.infoSteps', { returnObjects: true }) as string[]} />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          <EditOnly>{classPicker}</EditOnly>
          <GameThemeFrame gameType="quizshow" className="rounded-[28px]">
            <QuizShowHost title={t('liveQuiz.demoTitle')} questions={demo} classId={hostClassId} templateId={null} speedBonus />
          </GameThemeFrame>
          <div className="text-center font-body-md text-body-md text-on-surface-variant">{t('liveQuiz.emptyStaff')}</div>
          <EditOnly>{templateRow}</EditOnly>
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{selected.name}</h2>

          {(!isStaff || mode === 'play') && (
            <GameThemeFrame gameType="quizshow" className="rounded-[28px]">
              <QuizShowHost
                key={selected.id}
                title={selected.name}
                questions={playable}
                classId={hostClassId}
                templateId={selected.id}
                speedBonus={speedBonus}
              />
            </GameThemeFrame>
          )}

          <div className="space-y-4">
            <EditOnly>{classPicker}</EditOnly>
            <EditOnly>{templateRow}</EditOnly>
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('liveQuiz.settingsTitle', { count: draft.length })}</h4>
                  <div className="flex gap-3">
                    <button onClick={() => void handleRename()} className="font-label-md text-label-md text-primary hover:underline">
                      {t('gameAdmin.rename')}
                    </button>
                    <button
                      onClick={() => setMode(mode === 'play' ? 'edit' : 'play')}
                      disabled={mode === 'edit' && playable.length === 0}
                      className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-40"
                    >
                      {mode === 'play' ? t('gameAdmin.editQuestionsButton') : t('liveQuiz.toPlay')}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
                  <input type="checkbox" checked={speedBonus} onChange={(e) => void persist({ ...selected.config, liveSpeedBonus: e.target.checked })} />
                  {t('liveQuiz.speedBonus')}
                </label>

                {mode === 'edit' && (
                  <>
                    {/* 단어장으로 종합 대회 만들기 */}
                    <div className="rounded-xl border-2 border-primary/25 bg-primary-fixed/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 font-label-md text-label-md text-primary">
                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                        {t('liveQuiz.fromListTitle')}
                      </div>
                      <p className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.fromListHint')}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${input} w-auto min-w-48`} disabled={wordListsLoading}>
                          <option value="">{wordListsLoading ? t('common.loading') : t('liveQuiz.pickList')}</option>
                          {wordLists.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.items.length})
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                          {t('liveQuiz.perRound')}
                          <select value={perRound} onChange={(e) => setPerRound(Number(e.target.value))} className={`${input} w-auto`}>
                            {[3, 4, 5, 6, 8, 10].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={!listId}
                          onClick={() => generate(true)}
                          className="rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm disabled:opacity-40"
                        >
                          {t('liveQuiz.generate')}
                        </button>
                        <button
                          type="button"
                          disabled={!listId || draft.length === 0}
                          onClick={() => generate(false)}
                          className="rounded-full border border-primary px-4 py-2 font-label-md text-label-md text-primary disabled:opacity-40"
                        >
                          {t('liveQuiz.generateAppend')}
                        </button>
                      </div>
                    </div>

                    {draft.map((q, qi) => (
                      <QuestionEditor
                        key={q.id}
                        q={q}
                        n={qi + 1}
                        isFirst={qi === 0}
                        isLast={qi === draft.length - 1}
                        onLocal={(p) => patchLocal(q.id, p)}
                        onSave={(p) => patchSave(q.id, p)}
                        onCommit={commit}
                        onKind={(k) => changeKind(q, k)}
                        onMove={(d) => move(q.id, d)}
                        onRemove={() => save(draft.filter((x) => x.id !== q.id))}
                      />
                    ))}

                    <div className="flex flex-wrap gap-2">
                      {LIVE_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => save([...draft, newLiveQuestion(k, draft[draft.length - 1]?.round)])}
                          className="flex items-center gap-1 rounded-full border border-dashed border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          {t(`liveQuiz.kind_${k}`)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  q,
  n,
  isFirst,
  isLast,
  onLocal,
  onSave,
  onCommit,
  onKind,
  onMove,
  onRemove,
}: {
  q: LiveQuestion;
  n: number;
  isFirst: boolean;
  isLast: boolean;
  onLocal: (p: Partial<LiveQuestion>) => void;
  onSave: (p: Partial<LiveQuestion>) => void;
  onCommit: () => void;
  onKind: (k: LiveQuestionKind) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const ready = isLiveQuestionReady(q);
  const small = 'bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1 font-caption text-caption text-on-surface outline-none focus:border-primary';
  return (
    <div className={`rounded-lg p-4 space-y-2 ${ready ? 'bg-surface-container-low' : 'bg-error-container/30 ring-1 ring-error/30'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant">{t('liveQuiz.questionN', { n })}</span>
        <select value={q.kind} onChange={(e) => onKind(e.target.value as LiveQuestionKind)} className={small}>
          {LIVE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`liveQuiz.kind_${k}`)}
            </option>
          ))}
        </select>
        <input
          value={q.round ?? ''}
          onChange={(e) => onLocal({ round: e.target.value })}
          onBlur={onCommit}
          placeholder={t('liveQuiz.roundPlaceholder')}
          className={`${small} min-w-0 flex-1`}
        />
        {q.kind !== 'buzzer' && (
          <label className="flex items-center gap-1 font-caption text-caption text-on-surface-variant">
            <input
              type="number"
              min={5}
              max={120}
              value={q.seconds ?? 20}
              onChange={(e) => onLocal({ seconds: Math.max(5, Math.min(120, Number(e.target.value) || 20)) })}
              onBlur={onCommit}
              className={`${small} w-14`}
            />
            {t('liveQuiz.secondsUnit')}
          </label>
        )}
        <label className="flex items-center gap-1 font-caption text-caption text-on-surface-variant">
          <input
            type="number"
            min={0}
            step={100}
            value={q.points ?? 1000}
            onChange={(e) => onLocal({ points: Math.max(0, Number(e.target.value) || 0) })}
            onBlur={onCommit}
            className={`${small} w-20`}
          />
          {t('liveQuiz.pointsUnit')}
        </label>
        <div className="ml-auto flex items-center">
          <button type="button" disabled={isFirst} onClick={() => onMove(-1)} className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30" aria-label={t('liveQuiz.moveUp')}>
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          </button>
          <button type="button" disabled={isLast} onClick={() => onMove(1)} className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30" aria-label={t('liveQuiz.moveDown')}>
            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
          </button>
          <button type="button" onClick={onRemove} className="rounded-full p-1 text-on-surface-variant hover:bg-error/10 hover:text-error" aria-label={t('liveQuiz.remove')}>
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
      <div className="flex items-start gap-2">
        {q.imageUrl && (
          <div className="relative shrink-0">
            <img src={q.imageUrl} alt="" className="h-14 w-14 rounded-lg bg-white object-contain" />
            <button
              type="button"
              onClick={() => onSave({ imageUrl: null })}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[12px] text-on-error"
              aria-label={t('liveQuiz.removeImage')}
            >
              ✕
            </button>
          </div>
        )}
        <input value={q.prompt} onChange={(e) => onLocal({ prompt: e.target.value })} onBlur={onCommit} placeholder={t(`liveQuiz.promptPh_${q.kind}`)} className={input} />
      </div>
      {q.kind === 'choice' && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(q.choices ?? []).map((c, ci) => (
            <div key={ci} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSave({ correctIndex: ci })}
                aria-label={t('liveQuiz.markCorrect')}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ci === q.correctIndex ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}
              >
                ✓
              </button>
              <input
                value={c}
                onChange={(e) => {
                  const choices = [...(q.choices ?? [])];
                  choices[ci] = e.target.value;
                  onLocal({ choices });
                }}
                onBlur={onCommit}
                placeholder={t('liveQuiz.choicePh', { n: ci + 1 })}
                className={input}
              />
            </div>
          ))}
        </div>
      )}
      {q.kind === 'ox' && (
        <div className="flex items-center gap-2">
          <span className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.oxAnswer')}</span>
          {['O', 'X'].map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => onSave({ correctIndex: i })}
              className={`h-9 w-12 rounded-lg text-lg font-black ${q.correctIndex === i ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant'}`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      {(q.kind === 'text' || q.kind === 'buzzer') && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-caption text-caption text-on-surface-variant">{t('liveQuiz.answerLabel')}</span>
          <input value={q.answer ?? ''} onChange={(e) => onLocal({ answer: e.target.value })} onBlur={onCommit} placeholder={t('liveQuiz.answerPh')} className={input} />
        </div>
      )}
    </div>
  );
}
