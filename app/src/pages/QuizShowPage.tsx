import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import EditOnly from '../components/EditOnly';
import ClassChipRow from '../components/ClassChipRow';
import GameImagePicker from '../components/GameImagePicker';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import QuizShowHost from '../components/QuizShowHost';
import { updateGameTemplate } from '../lib/api';
import { wordListToCards } from '../lib/gameFromWords';
import {
  buildContestQuestions,
  contestAvailability,
  contestRoundNames,
  CONTEST_ROUND_TYPES,
  isLiveQuestionReady,
  LIVE_KINDS,
  mergeCustomQuestions,
  newLiveQuestion,
  newRoundQuestion,
  normalizeContestRounds,
  roundTypeOf,
  scrambleWord,
} from '../lib/liveQuiz';
import { speak } from '../lib/speech';
import { useWordBankEnriched } from '../lib/wordBankCache';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { ContestRoundSetting, ContestRoundType, GameItem, GameTemplateConfig, LiveQuestion, LiveQuestionKind } from '../lib/types';

function defaultItems(): GameItem[] {
  return [];
}

/** 라운드 종류 아이콘(편집 화면·칠판 라운드 소개가 같이 쓴다) */
export const ROUND_ICON: Record<ContestRoundType, string> = {
  choice: 'grid_view',
  ox: 'rule',
  text: 'edit_note',
  buzzer: 'campaign',
  picture: 'image_search',
  listen: 'hearing',
  scramble: 'shuffle',
  blank: 'format_quote',
};
const NEW_ROUND_TYPES: ContestRoundType[] = ['picture', 'listen', 'scramble', 'blank'];

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
    academy,
  } = g;

  const [draft, setDraft] = useState<LiveQuestion[]>(selected?.config.liveQuestions ?? []);
  const [mode, setMode] = useState<'edit' | 'play'>('play');
  const [listId, setListId] = useState('');
  const [rounds, setRounds] = useState<ContestRoundSetting[]>(() => normalizeContestRounds(selected?.config.liveContestRounds));
  // 미리보기: 진짜 대회를 열지 않고(입장 번호·기록 없이) 칠판 + 학생 휴대폰 모형으로 연습
  const [preview, setPreview] = useState(false);
  const listCards = useMemo(() => wordListToCards(wordLists.find((w) => w.id === listId)), [wordLists, listId]);
  // 단어장엔 예문이 없어서 사전에서 예문·그림을 보충한다(빈칸 채우기·그림 라운드용)
  const cards = useWordBankEnriched(listCards);
  const avail = useMemo(() => contestAvailability(cards), [cards]);

  useEffect(() => {
    const qs = selected?.config.liveQuestions ?? [];
    setDraft(qs);
    setMode(qs.some(isLiveQuestionReady) ? 'play' : 'edit');
    setRounds(normalizeContestRounds(selected?.config.liveContestRounds));
    setPreview(false);
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
  function saveRounds(next: ContestRoundSetting[]) {
    setRounds(next);
    void persist({ ...selected?.config, liveQuestions: draft, liveContestRounds: next });
  }
  function setRound(i: number, patch: Partial<ContestRoundSetting>) {
    saveRounds(rounds.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }
  function moveRound(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rounds.length) return;
    const next = [...rounds];
    [next[i], next[j]] = [next[j], next[i]];
    saveRounds(next);
  }
  /** 자동 만들기 — 선생님이 직접 만든 문제는 같은 종류 라운드 끝에 그대로 남긴다 */
  function generate() {
    const usable = rounds.map((r) => ({ ...r, on: r.on && avail[r.type] > 0 }));
    const qs = buildContestQuestions(cards, contestRoundNames(t), usable);
    if (qs.length === 0) {
      alert(t('liveQuiz.needWords'));
      return;
    }
    if (draft.some((q) => !q.custom) && !confirm(t('liveQuiz.replaceConfirm2'))) return;
    save(mergeCustomQuestions(qs, draft));
  }
  /** 직접 만든 문제의 기본 문장(듣기·그림은 안내 문장을 미리 채운다) */
  function prefilled(q: LiveQuestion): LiveQuestion {
    if (q.style === 'listen') return { ...q, prompt: t('liveQuiz.listenPrompt') };
    if (q.style === 'picture') return { ...q, prompt: t('liveQuiz.picturePrompt') };
    return q;
  }
  function addToRound(endIndex: number) {
    const last = draft[endIndex];
    const q = prefilled(newRoundQuestion(roundTypeOf(last), last.round));
    save([...draft.slice(0, endIndex + 1), q, ...draft.slice(endIndex + 1)]);
  }
  function addCustomRound(type: ContestRoundType) {
    const name = t('liveQuiz.roundNumbered', { n: groups.length + 1, name: t(`liveQuiz.roundName_${type}`) });
    save([...draft, prefilled(newRoundQuestion(type, name))]);
  }
  // 편집 화면은 이어진 같은 라운드 이름끼리 묶어 보여 준다
  const groups: { round: string; start: number; end: number }[] = [];
  draft.forEach((q, i) => {
    const r = q.round?.trim() ?? '';
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.round === r) lastGroup.end = i;
    else groups.push({ round: r, start: i, end: i });
  });

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

          {isStaff && preview && playable.length > 0 && (
            <GameThemeFrame gameType="quizshow" className="rounded-[28px]">
              <QuizShowHost key={`preview-${playable.map((q) => q.id).join(',')}`} preview title={selected.name} questions={playable} classId={null} templateId={null} speedBonus={speedBonus} />
            </GameThemeFrame>
          )}

          {(!isStaff || mode === 'play') && !preview && (
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
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => void handleRename()} className="font-label-md text-label-md text-primary hover:underline">
                      {t('gameAdmin.rename')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreview((v) => !v)}
                      disabled={playable.length === 0}
                      className={`flex items-center gap-1 rounded-full px-4 py-1.5 font-label-md text-label-md disabled:opacity-40 ${
                        preview ? 'bg-secondary text-on-secondary' : 'border border-primary text-primary hover:bg-primary-fixed/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{preview ? 'close' : 'preview'}</span>
                      {preview ? t('liveQuiz.closePreview') : t('liveQuiz.previewOpen')}
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
                    {/* 단어장으로 종합 대회 만들기 — 라운드 켜기·문제 수·순서 */}
                    <div className="rounded-xl border-2 border-primary/25 bg-primary-fixed/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 font-label-md text-label-md text-primary">
                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                        {t('liveQuiz.fromListTitle')}
                      </div>
                      <p className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.fromListHint2')}</p>
                      <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${input} w-auto min-w-48`} disabled={wordListsLoading}>
                        <option value="">{wordListsLoading ? t('common.loading') : t('liveQuiz.pickList')}</option>
                        {wordLists.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.items.length})
                          </option>
                        ))}
                      </select>

                      <div className="rounded-lg bg-surface-container-lowest p-2">
                        <div className="px-2 pb-1 font-caption text-caption text-on-surface-variant">{t('liveQuiz.roundsTitle')}</div>
                        <ol className="space-y-1">
                          {rounds.map((r, ri) => {
                            const can = listId ? avail[r.type] : null;
                            const blocked = can === 0;
                            return (
                              <li
                                key={r.type}
                                className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 ${r.on && !blocked ? 'bg-primary-fixed/40' : ''}`}
                              >
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={r.on && !blocked}
                                    disabled={blocked}
                                    onChange={(e) => setRound(ri, { on: e.target.checked })}
                                    className="h-4 w-4"
                                  />
                                  <span className="material-symbols-outlined text-[20px] text-primary">{ROUND_ICON[r.type]}</span>
                                  <span className="font-label-md text-label-md text-on-surface">{t(`liveQuiz.roundName_${r.type}`)}</span>
                                  {NEW_ROUND_TYPES.includes(r.type) && (
                                    <span className="rounded-full bg-warm-yellow px-1.5 py-0.5 text-[10px] font-bold text-deep-navy">NEW</span>
                                  )}
                                  <span className="truncate font-caption text-caption text-on-surface-variant">
                                    {blocked ? t(`liveQuiz.unavailable_${r.type}`, { defaultValue: t('liveQuiz.unavailable') }) : t(`liveQuiz.roundDesc_${r.type}`)}
                                  </span>
                                </label>
                                <select
                                  value={r.count}
                                  onChange={(e) => setRound(ri, { count: Number(e.target.value) })}
                                  disabled={!r.on || blocked}
                                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 font-caption text-caption disabled:opacity-40"
                                  aria-label={t('liveQuiz.perRound')}
                                >
                                  {[3, 4, 5, 6, 8, 10].map((n) => (
                                    <option key={n} value={n}>
                                      {t('liveQuiz.countQuestions', { count: n })}
                                    </option>
                                  ))}
                                </select>
                                {can != null && !blocked && can < r.count && r.on && (
                                  <span className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.onlyAvailable', { count: can })}</span>
                                )}
                                <div className="flex">
                                  <button type="button" disabled={ri === 0} onClick={() => moveRound(ri, -1)} className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30" aria-label={t('liveQuiz.moveUp')}>
                                    <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                                  </button>
                                  <button type="button" disabled={ri === rounds.length - 1} onClick={() => moveRound(ri, 1)} className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container disabled:opacity-30" aria-label={t('liveQuiz.moveDown')}>
                                    <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!listId || !rounds.some((r) => r.on)}
                          onClick={() => generate()}
                          className="rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm disabled:opacity-40"
                        >
                          {t('liveQuiz.generate')}
                        </button>
                        {draft.some((q) => q.custom) && (
                          <span className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.keepsCustom', { count: draft.filter((q) => q.custom).length })}</span>
                        )}
                      </div>
                    </div>

                    {/* 라운드별 묶음 — 묶음마다 직접 문제 추가 */}
                    {groups.map((grp) => (
                      <div key={grp.start} className="space-y-2 rounded-xl border border-outline-variant/50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="material-symbols-outlined text-[20px] text-primary">{ROUND_ICON[roundTypeOf(draft[grp.start])]}</span>
                          <span className="font-title-md text-[16px] text-on-surface">{grp.round || t('liveQuiz.noRound')}</span>
                          <span className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.countQuestions', { count: grp.end - grp.start + 1 })}</span>
                        </div>
                        {draft.slice(grp.start, grp.end + 1).map((q, k) => {
                          const qi = grp.start + k;
                          return (
                            <QuestionEditor
                              key={q.id}
                              q={q}
                              n={qi + 1}
                              academyId={academy?.id ?? null}
                              isFirst={qi === 0}
                              isLast={qi === draft.length - 1}
                              onLocal={(p) => patchLocal(q.id, p)}
                              onSave={(p) => patchSave(q.id, p)}
                              onCommit={commit}
                              onKind={(kd) => changeKind(q, kd)}
                              onMove={(d) => move(q.id, d)}
                              onRemove={() => save(draft.filter((x) => x.id !== q.id))}
                            />
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => addToRound(grp.end)}
                          className="flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary-fixed/40"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          {t('liveQuiz.addToRound')}
                        </button>
                      </div>
                    ))}

                    {/* 새 라운드를 직접 만들기 */}
                    <div className="space-y-2">
                      <div className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.newCustomRound')}</div>
                      <div className="flex flex-wrap gap-2">
                        {CONTEST_ROUND_TYPES.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => addCustomRound(k)}
                            className="flex items-center gap-1 rounded-full border border-dashed border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-[18px]">{ROUND_ICON[k]}</span>
                            {t(`liveQuiz.roundName_${k}`)}
                          </button>
                        ))}
                      </div>
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
  academyId,
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
  academyId: string | null;
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
        {q.custom && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-on-secondary">{t('liveQuiz.customBadge')}</span>}
        {q.style ? (
          // 새 라운드(그림·듣기·글자 섞기·빈칸)는 답 방식이 정해져 있어 종류를 바꾸지 않는다
          <span className="flex items-center gap-1 font-caption text-caption text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">{ROUND_ICON[q.style]}</span>
            {t(`liveQuiz.roundName_${q.style}`)}
          </span>
        ) : (
          <select value={q.kind} onChange={(e) => onKind(e.target.value as LiveQuestionKind)} className={small}>
            {LIVE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`liveQuiz.kind_${k}`)}
              </option>
            ))}
          </select>
        )}
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
        <input
          value={q.prompt}
          onChange={(e) => onLocal({ prompt: e.target.value })}
          onBlur={onCommit}
          placeholder={t(`liveQuiz.promptPh_${q.style ?? q.kind}`)}
          className={input}
        />
      </div>
      {q.style === 'listen' && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-caption text-caption text-on-surface-variant">{t('liveQuiz.speakLabel')}</span>
          <input value={q.speak ?? ''} onChange={(e) => onLocal({ speak: e.target.value })} onBlur={onCommit} placeholder={t('liveQuiz.speakPh')} className={input} />
          <button
            type="button"
            disabled={!q.speak?.trim()}
            onClick={() => speak(q.speak ?? '')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
            aria-label={t('liveQuiz.listenAgain')}
          >
            <span className="material-symbols-outlined text-[20px]">volume_up</span>
          </button>
        </div>
      )}
      {q.style === 'picture' && academyId && (
        <div className="space-y-1">
          <div className="font-caption text-caption text-on-surface-variant">{t('liveQuiz.pictureLabel')}</div>
          <GameImagePicker academyId={academyId} value={q.revealImage ?? null} onChange={(url) => onSave({ revealImage: url })} previewHeight={96} />
        </div>
      )}
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
          <input
            value={q.answer ?? ''}
            onChange={(e) => onLocal({ answer: e.target.value })}
            // 글자 섞기: 정답을 적으면 섞인 글자(문제)를 자동으로 만든다
            onBlur={() => {
              if (q.style === 'scramble' && q.answer?.trim() && !q.prompt.trim()) onSave({ prompt: scrambleWord(q.answer) });
              else onCommit();
            }}
            placeholder={t('liveQuiz.answerPh')}
            className={input}
          />
          {q.style === 'scramble' && (
            <button
              type="button"
              disabled={!q.answer?.trim()}
              onClick={() => onSave({ prompt: scrambleWord(q.answer ?? '') })}
              className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-3 py-1.5 font-caption text-caption text-primary disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">shuffle</span>
              {t('liveQuiz.reshuffle')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
