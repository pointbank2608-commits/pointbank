import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { createSoloLesson, updateSoloLesson, type SoloLesson } from '../../lib/soloApi';
import { kindOf, lessonProblems, newStep, normalizeStep, STEP_KINDS, stepProblems, stepSummary } from '../../lib/soloEdit';
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
  onClose,
}: {
  lesson: SoloLesson;
  academyId: string;
  assignedCount: number;
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
  const [pasteOpen, setPasteOpen] = useState(false);
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
          <ol className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {steps.map((s, i) => {
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
