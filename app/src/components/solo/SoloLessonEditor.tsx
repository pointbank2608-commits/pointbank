import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { createSoloLesson, updateSoloLesson, type SoloLesson } from '../../lib/soloApi';
import { kindOf, lessonProblems, newStep, normalizeStep, STEP_KINDS, stepProblems, stepRuns, stepSummary, wordsFromSteps } from '../../lib/soloEdit';
import { buildWordBlock, WORD_BLOCK_TYPES, type WordBlockType } from '../../lib/soloLessons';
import type { SoloStep } from '../../lib/soloLessons';
import SoloPasteWords from './SoloPasteWords';
import SoloPreview from './SoloPreview';
import SoloStepForm from './SoloStepForm';

/**
 * 개별수업 편집기 — 내 수업 만들기처럼 왼쪽에 단계 목록, 오른쪽에 고치는 칸.
 * 순서 바꾸기(끌기/버튼)·복사·삭제·단계 추가·되돌리기·학생 화면 미리보기를 지원하고, 저장 전에 문제의 정답·보기가 맞는지 검사한다.
 * 이미 학생에게 낸 수업이면 "사본으로 저장"을 권한다(진행 중인 학생의 단계 번호가 어긋나지 않게).
 */
export default function SoloLessonEditor({
  lesson,
  academyId,
  assignedCount,
  startWithPaste = false,
  onClose,
}: {
  lesson: SoloLesson;
  academyId: string;
  assignedCount: number;
  /** 새 수업이면 단어 붙여넣기 창부터 연다 */
  startWithPaste?: boolean;
  /** saved 가 true 면 목록을 다시 불러온다 */
  onClose: (saved: boolean) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [name, setName] = useState(lesson.name);
  const [minutes, setMinutes] = useState(lesson.minutes);
  const [steps, setSteps] = useState<SoloStep[]>(lesson.steps);
  const [sel, setSel] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(startWithPaste);
  const [view, setView] = useState<'blocks' | 'steps'>('blocks');
  const [openRuns, setOpenRuns] = useState<Set<number>>(new Set());
  const [problems, setProblems] = useState<{ index: number; keys: string[] }[]>([]);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  // 되돌리기: 구조를 바꿀 땐 바로, 글자 고치기는 0.8초 안이면 한 번으로 묶어 기록
  const past = useRef<SoloStep[][]>([]);
  const future = useRef<SoloStep[][]>([]);
  const lastEdit = useRef<{ idx: number; at: number }>({ idx: -1, at: 0 });

  const commit = useCallback(
    (next: SoloStep[], opts?: { field?: number }) => {
      setSteps((cur) => {
        const coalesce = opts?.field !== undefined && lastEdit.current.idx === opts.field && Date.now() - lastEdit.current.at < 800;
        if (!coalesce) {
          past.current.push(cur);
          if (past.current.length > 60) past.current.shift();
        }
        lastEdit.current = { idx: opts?.field ?? -1, at: Date.now() };
        future.current = [];
        return next;
      });
      setDirty(true);
      setProblems([]);
    },
    [],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setSteps((cur) => {
      future.current.push(cur);
      return prev;
    });
    setSel((s) => Math.min(s, prev.length - 1));
    lastEdit.current = { idx: -1, at: 0 };
  }, []);
  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt) return;
    setSteps((cur) => {
      past.current.push(cur);
      return nxt;
    });
    lastEdit.current = { idx: -1, at: 0 };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // 저장 안 하고 창을 닫으려 할 때
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const step = steps[sel];
  const problemSet = new Set(problems.map((p) => p.index));

  const renderStep = (i: number) => {
    const s = steps[i];
    const k = kindOf(s.t);
    const bad = problemSet.has(i);
    const summary = stepSummary(s);
    return (
                <li
                  key={i}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom !== null) move(dragFrom, i);
                    setDragFrom(null);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                >
                  <button
                    type="button"
                    onClick={() => setSel(i)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${sel === i ? 'border-primary bg-primary/10' : 'border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50'} ${dragFrom === i ? 'opacity-50' : ''}`}
                  >
                    <span className="w-5 shrink-0 text-center font-caption text-caption tabular-nums text-on-surface-variant">{i + 1}</span>
                    <span className={`material-symbols-outlined shrink-0 text-[20px] ${bad ? 'text-error' : 'text-primary'}`}>{bad ? 'error' : k.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-label-md text-label-md text-on-surface">{t(`soloEdit.stepType_${s.t}`)}</span>
                      <span className="block truncate font-caption text-caption text-on-surface-variant">{summary || t('soloEdit.emptyStep')}</span>
                    </span>
                  </button>
                </li>
    );
  };

  function move(from: number, to: number) {
    if (to < 0 || to >= steps.length || from === to) return;
    const next = [...steps];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    commit(next);
    setSel(to);
  }
  function remove(i: number) {
    if (steps.length <= 1) return;
    commit(steps.filter((_, j) => j !== i));
    setSel(Math.max(0, Math.min(i, steps.length - 2)));
  }
  function duplicate(i: number) {
    const copy = JSON.parse(JSON.stringify(steps[i])) as SoloStep;
    const next = [...steps];
    next.splice(i + 1, 0, copy);
    commit(next);
    setSel(i + 1);
  }
  function add(t: SoloStep['t']) {
    const next = [...steps];
    next.splice(sel + 1, 0, newStep(t));
    commit(next);
    setSel(sel + 1);
    setPaletteOpen(false);
  }
  function addMany(list: SoloStep[]) {
    const next = [...steps];
    next.splice(sel + 1, 0, ...list);
    commit(next);
    setSel(sel + 1);
    setPasteOpen(false);
    setPaletteOpen(false);
  }
  /* ---------- 블록(같은 종류 단계 묶음) 단위 ---------- */
  const runs = stepRuns(steps);
  const lessonWords = wordsFromSteps(steps);
  const canWordBlocks = lessonWords.length >= 4;
  const runIndexOf = (i: number) => runs.findIndex((r) => i >= r.start && i <= r.end);
  const isWordBlock = (t: SoloStep['t']) => (WORD_BLOCK_TYPES as readonly string[]).includes(t);

  function moveRun(ri: number, dir: -1 | 1) {
    const to = ri + dir;
    if (to < 0 || to >= runs.length) return;
    const groups = runs.map((r) => steps.slice(r.start, r.end + 1));
    const [g] = groups.splice(ri, 1);
    groups.splice(to, 0, g);
    const next = groups.flat();
    commit(next);
    let start = 0;
    for (let k = 0; k < to; k++) start += groups[k].length;
    setSel(start);
  }
  function duplicateRun(ri: number) {
    const r = runs[ri];
    const copy = JSON.parse(JSON.stringify(steps.slice(r.start, r.end + 1))) as SoloStep[];
    // 바로 뒤에 두면 같은 종류끼리 한 블록으로 합쳐 보이므로 맨 끝에 두고, 위로 옮기게 한다
    commit([...steps, ...copy]);
    setSel(steps.length);
    notify(t('soloEdit.blockCopied'));
  }
  function removeRun(ri: number) {
    const r = runs[ri];
    const count = r.end - r.start + 1;
    if (steps.length - count < 1) return;
    if (count > 1 && !window.confirm(t('soloEdit.blockDeleteConfirm', { name: t(`soloEdit.stepType_${r.t}`), count }))) return;
    commit(steps.filter((_, j) => j < r.start || j > r.end));
    setSel(Math.max(0, Math.min(r.start, steps.length - count - 1)));
  }
  function regenerateRun(ri: number) {
    const r = runs[ri];
    if (!isWordBlock(r.t)) return;
    const made = buildWordBlock(r.t as WordBlockType, lessonWords);
    if (made.length === 0) {
      notify(t('soloEdit.blockRegenEmpty'), 'error');
      return;
    }
    if (!window.confirm(t('soloEdit.blockRegenConfirm', { count: r.end - r.start + 1, made: made.length }))) return;
    const next = [...steps.slice(0, r.start), ...made, ...steps.slice(r.end + 1)];
    commit(next);
    setSel(r.start);
  }
  function addWordBlock(type: WordBlockType) {
    const made = buildWordBlock(type, lessonWords);
    if (made.length === 0) {
      notify(t('soloEdit.blockRegenEmpty'), 'error');
      return;
    }
    const ri = runIndexOf(sel);
    const at = ri >= 0 ? runs[ri].end + 1 : steps.length;
    const next = [...steps];
    next.splice(at, 0, ...made);
    commit(next);
    setSel(at);
    setPaletteOpen(false);
  }
  const toggleRun = (start: number) =>
    setOpenRuns((cur) => {
      const n = new Set(cur);
      if (n.has(start)) n.delete(start);
      else n.add(start);
      return n;
    });

  function edit(s: SoloStep) {
    commit(steps.map((x, j) => (j === sel ? s : x)), { field: sel });
  }

  function validate(): SoloStep[] | null {
    const normalized = steps.map(normalizeStep);
    const found = lessonProblems(normalized);
    if (found.length > 0) {
      setProblems(found);
      const first = found.find((f) => f.index >= 0);
      if (first) setSel(first.index);
      notify(t('soloEdit.problemsFound', { count: found.length }), 'error');
      return null;
    }
    return normalized;
  }

  async function save(mode: 'overwrite' | 'copy') {
    const normalized = validate();
    if (!normalized) {
      setAsking(false);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'copy') {
        await createSoloLesson({
          academyId,
          classId: lesson.class_id,
          name: `${name.trim() || lesson.name} ${t('soloEdit.copySuffix')}`,
          level: lesson.level,
          minutes,
          steps: normalized,
          source: lesson.source,
        });
        notify(t('soloEdit.savedCopy'));
      } else {
        await updateSoloLesson(lesson.id, { name: name.trim() || lesson.name, minutes, steps: normalized });
        notify(t('soloEdit.saved'));
      }
      setDirty(false);
      onClose(true);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
      setSaving(false);
    }
  }

  function tryClose() {
    if (dirty && !window.confirm(t('soloEdit.discardConfirm'))) return;
    onClose(false);
  }

  const groups: ('learn' | 'quiz' | 'speak' | 'grammar' | 'video')[] = ['learn', 'quiz', 'speak', 'grammar', 'video'];
  const stepProblemKeys = (i: number) => problems.find((p) => p.index === i)?.keys ?? [];

  return (
    <div className="fixed inset-0 z-[58] flex flex-col bg-background" role="dialog" aria-modal="true">
      {/* 위 줄 */}
      <header className="flex flex-wrap items-center gap-2 border-b border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5">
        <button type="button" onClick={tryClose} aria-label={t('soloEdit.back')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-title-md text-title-md font-bold text-deep-navy outline-none focus:border-primary focus:bg-surface-container-low sm:max-w-md" aria-label={t('soloEdit.nameLabel')} />
        <label className="flex items-center gap-1 font-caption text-caption text-on-surface-variant">
          <input type="number" min={3} max={120} value={minutes} onChange={(e) => { setMinutes(Math.max(3, Number(e.target.value) || 3)); setDirty(true); }} className="w-16 rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-sm text-on-surface" />
          {t('soloEdit.minutesUnit')}
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={undo} disabled={past.current.length === 0} aria-label={t('soloEdit.undo')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30">
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button type="button" onClick={redo} disabled={future.current.length === 0} aria-label={t('soloEdit.redo')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30">
            <span className="material-symbols-outlined">redo</span>
          </button>
          <button type="button" onClick={() => setPreview(true)} className="flex items-center gap-1 rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10">
            <span className="material-symbols-outlined text-[18px]">smartphone</span>
            {t('soloEdit.preview')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => (assignedCount > 0 ? setAsking(true) : void save('overwrite'))}
            className="rounded-full bg-primary px-5 py-1.5 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-50"
          >
            {t('soloEdit.save')}
          </button>
        </div>
      </header>

      {assignedCount > 0 && (
        <div className="bg-warm-yellow/25 px-4 py-1.5 font-caption text-caption text-on-surface">{t('soloEdit.assignedBanner', { count: assignedCount })}</div>
      )}
      {problems.length > 0 && (
        <div className="bg-error/10 px-4 py-1.5 font-caption text-caption text-error">{t('soloEdit.problemsFound', { count: problems.length })}</div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 왼쪽: 단계 목록 */}
        <aside className="flex max-h-[34vh] shrink-0 flex-col border-b border-outline-variant/40 bg-surface-container-low/50 lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-1 border-b border-outline-variant/40 px-2 py-1.5">
            <div className="flex rounded-full bg-surface-container p-0.5" role="radiogroup" aria-label={t('soloEdit.viewLabel')}>
              {(['blocks', 'steps'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 font-label-md text-label-md ${view === v ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                >
                  {t(`soloEdit.view_${v}`)}
                </button>
              ))}
            </div>
            {view === 'blocks' && (
              <button
                type="button"
                onClick={() => setOpenRuns((cur) => (cur.size > 0 ? new Set() : new Set(runs.filter((r) => r.end > r.start).map((r) => r.start))))}
                className="ml-auto font-caption text-caption text-primary hover:underline"
              >
                {openRuns.size > 0 ? t('soloEdit.collapseAll') : t('soloEdit.expandAll')}
              </button>
            )}
          </div>
          <ol className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {view === 'steps'
              ? steps.map((_, i) => renderStep(i))
              : runs.map((r, ri) => {
                  const count = r.end - r.start + 1;
                  const open = r.t === 'intro' ? false : openRuns.has(r.start) || (sel >= r.start && sel <= r.end);
                  const single = count === 1;
                  const k = kindOf(r.t);
                  const bad = problems.some((p) => p.index >= r.start && p.index <= r.end);
                  const btn = 'rounded p-0.5 text-on-surface-variant hover:bg-surface-container hover:text-primary disabled:opacity-30';
                  return (
                    <li key={`run-${r.start}`} className="space-y-1">
                      <div className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 ${sel >= r.start && sel <= r.end ? 'border-primary/60 bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest'}`}>
                        <button
                          type="button"
                          onClick={() => (single ? setSel(r.start) : toggleRun(r.start))}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          aria-expanded={open}
                        >
                          <span className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant">
                            {single ? 'chevron_right' : open ? 'expand_more' : 'chevron_right'}
                          </span>
                          <span className={`material-symbols-outlined shrink-0 text-[20px] ${bad ? 'text-error' : 'text-primary'}`}>{bad ? 'error' : k.icon}</span>
                          <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-on-surface">{t(`soloEdit.stepType_${r.t}`)}</span>
                          <span className="shrink-0 rounded-full bg-surface-container px-1.5 py-0.5 font-caption text-caption tabular-nums text-on-surface-variant">
                            {r.start + 1}{count > 1 ? `–${r.end + 1}` : ''}
                          </span>
                        </button>
                        {r.t !== 'intro' && (
                          <span className="flex shrink-0 items-center">
                            {canWordBlocks && isWordBlock(r.t) && (
                              <button type="button" onClick={() => regenerateRun(ri)} title={t('soloEdit.blockRegen')} aria-label={t('soloEdit.blockRegen')} className={btn}>
                                <span className="material-symbols-outlined text-[18px]">autorenew</span>
                              </button>
                            )}
                            <button type="button" disabled={ri <= 1} onClick={() => moveRun(ri, -1)} title={t('soloEdit.blockUp')} aria-label={t('soloEdit.blockUp')} className={btn}>
                              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                            </button>
                            <button type="button" disabled={ri >= runs.length - 1} onClick={() => moveRun(ri, 1)} title={t('soloEdit.blockDown')} aria-label={t('soloEdit.blockDown')} className={btn}>
                              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                            </button>
                            <button type="button" onClick={() => duplicateRun(ri)} title={t('soloEdit.blockCopy')} aria-label={t('soloEdit.blockCopy')} className={btn}>
                              <span className="material-symbols-outlined text-[18px]">content_copy</span>
                            </button>
                            <button type="button" onClick={() => removeRun(ri)} title={t('soloEdit.blockDelete')} aria-label={t('soloEdit.blockDelete')} className={`${btn} hover:text-error`}>
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </span>
                        )}
                      </div>
                      {(open || single) && (
                        <ol className="space-y-1.5 pl-3">
                          {Array.from({ length: count }, (_, j) => r.start + j).map((i) => renderStep(i))}
                        </ol>
                      )}
                    </li>
                  );
                })}
          </ol>
          <div className="relative border-t border-outline-variant/40 p-2">
            <button type="button" onClick={() => setPaletteOpen((o) => !o)} className="flex w-full items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container">
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t('soloEdit.addStep')}
            </button>
            {paletteOpen && (
              <div className="absolute bottom-full left-2 right-2 z-10 mb-2 max-h-[60vh] space-y-2 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xl">
                <button type="button" onClick={() => setPasteOpen(true)} className="flex w-full items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-left font-label-md text-label-md font-bold text-primary hover:bg-primary/20">
                  <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
                  {t('soloEdit.pasteOpen')}
                </button>
                <div>
                  <div className="mb-1 font-caption text-caption font-bold text-on-surface-variant">{t('soloEdit.addBlockGroup')}</div>
                  {!canWordBlocks && <p className="mb-1 font-caption text-caption text-on-surface-variant">{t('soloEdit.addBlockNeed')}</p>}
                  <div className="grid grid-cols-2 gap-1">
                    {WORD_BLOCK_TYPES.map((bt) => (
                      <button
                        key={bt}
                        type="button"
                        disabled={!canWordBlocks}
                        onClick={() => addWordBlock(bt)}
                        className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-2 py-1.5 text-left font-label-md text-label-md text-on-surface hover:border-primary hover:bg-primary/5 disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">{kindOf(bt).icon}</span>
                        <span className="truncate">{t(`soloEdit.stepType_${bt}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {groups.map((g) => (
                  <div key={g}>
                    <div className="mb-1 font-caption text-caption font-bold text-on-surface-variant">{t(`soloEdit.group_${g}`)}</div>
                    <div className="grid grid-cols-2 gap-1">
                      {STEP_KINDS.filter((k) => k.group === g).map((k) => (
                        <button key={k.t} type="button" onClick={() => add(k.t)} className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-2 py-1.5 text-left font-label-md text-label-md text-on-surface hover:border-primary hover:bg-primary/5">
                          <span className="material-symbols-outlined text-[18px] text-primary">{k.icon}</span>
                          <span className="truncate">{t(`soloEdit.stepType_${k.t}`)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* 오른쪽: 고치는 칸 */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {step ? (
            <div className="mx-auto max-w-2xl space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-primary">{kindOf(step.t).icon}</span>
                <h2 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">
                  {sel + 1}. {t(`soloEdit.stepType_${step.t}`)}
                </h2>
                <button type="button" onClick={() => move(sel, sel - 1)} disabled={sel === 0} aria-label={t('soloEdit.moveUp')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30">
                  <span className="material-symbols-outlined">arrow_upward</span>
                </button>
                <button type="button" onClick={() => move(sel, sel + 1)} disabled={sel === steps.length - 1} aria-label={t('soloEdit.moveDown')} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30">
                  <span className="material-symbols-outlined">arrow_downward</span>
                </button>
                <button type="button" onClick={() => duplicate(sel)} className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  {t('soloEdit.duplicate')}
                </button>
                <button type="button" onClick={() => remove(sel)} disabled={steps.length <= 1} className="flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-error hover:text-error disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  {t('common.delete')}
                </button>
              </div>

              {stepProblemKeys(sel).length > 0 && (
                <ul className="list-disc space-y-0.5 rounded-lg bg-error/10 py-2 pl-7 pr-3 font-caption text-caption text-error">
                  {stepProblemKeys(sel).map((k) => (
                    <li key={k}>{t(`soloEdit.err_${k}`)}</li>
                  ))}
                </ul>
              )}
              {problems.length === 0 && stepProblems(step).length > 0 && (
                <p className="font-caption text-caption text-on-surface-variant">{t('soloEdit.fillHint')}</p>
              )}

              <SoloStepForm key={`${sel}-${step.t}`} step={step} academyId={academyId} onChange={edit} />

              <div className="rounded-xl bg-surface-container-low p-3 font-caption text-caption text-on-surface-variant">{t(`soloEdit.stepHelp_${step.t}`)}</div>
            </div>
          ) : (
            <p className="py-10 text-center text-on-surface-variant">{t('soloEdit.noSteps')}</p>
          )}
        </main>
      </div>

      {asking && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
            <h3 className="font-title-md text-title-md font-bold text-deep-navy">{t('soloEdit.askTitle', { count: assignedCount })}</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">{t('soloEdit.askText')}</p>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={saving} onClick={() => void save('copy')} className="rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary disabled:opacity-50">
                {t('soloEdit.askCopy')}
              </button>
              <button type="button" disabled={saving} onClick={() => void save('overwrite')} className="rounded-full border border-outline-variant px-5 py-2.5 font-label-md text-label-md text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50">
                {t('soloEdit.askOverwrite')}
              </button>
              <button type="button" onClick={() => setAsking(false)} className="rounded-full px-5 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pasteOpen && <SoloPasteWords hasSteps={steps.length > 0} onAdd={addMany} onClose={() => setPasteOpen(false)} />}
      {preview && <SoloPreview steps={steps.map(normalizeStep)} startAt={sel} onClose={() => setPreview(false)} />}
    </div>
  );
}
