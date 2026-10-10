import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchPresets, fetchStudentsOfClass } from '../../lib/api';
import { dateKey } from '../../lib/format';
import type { Preset } from '../../lib/types';
import {
  assignSoloLesson,
  createSoloLesson,
  deleteSoloLesson,
  fetchSoloAssignmentCounts,
  fetchSoloLessons,
  fetchSoloStatus,
  renameSoloLesson,
  rewardSoloLesson,
  type SoloLesson,
  type SoloStatusRow,
} from '../../lib/soloApi';
import type { Student } from '../../lib/types';
import RecordingsModal from './RecordingsModal';
import SoloCatalogModal from './SoloCatalogModal';
import SoloLessonEditor from './SoloLessonEditor';
import SoloPreview from './SoloPreview';

/**
 * 내 수업 → "개별수업" 탭. 개별수업은 화면이 선생님이 되어 학생이 혼자 하는 수업이다(단체수업과 목록·만들기가 따로).
 * 만들기 = "커리큘럼 보기"에서 미리 만든 수업을 골라 이 반 것으로 가져온다 → 학생에게 내기 → 현황 보기.
 */
/** 목록 정렬: 최근 것이 위 — 다만 "이름 (1/3)(2/3)(3/3)" 처럼 한꺼번에 만든 묶음은 번호 순서로 */
function orderLessons(list: SoloLesson[]): SoloLesson[] {
  const part = (name: string) => {
    const m = name.match(/^(.*)\((\d+)\/(\d+)\)\s*$/);
    return m ? { base: m[1].trim(), n: Number(m[2]), of: Number(m[3]) } : null;
  };
  const out: SoloLesson[] = [];
  const used = new Set<string>();
  for (const l of list) {
    if (used.has(l.id)) continue;
    const p = part(l.name);
    if (!p) {
      out.push(l);
      used.add(l.id);
      continue;
    }
    const group = list.filter((x) => {
      const q = part(x.name);
      return q && q.base === p.base && q.of === p.of && !used.has(x.id);
    });
    group.sort((a, b) => (part(a.name)?.n ?? 0) - (part(b.name)?.n ?? 0));
    for (const g of group) {
      out.push(g);
      used.add(g.id);
    }
  }
  return out;
}

export default function SoloLessonsPanel({ academyId, classId }: { academyId: string; classId: string | null }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [lessons, setLessons] = useState<SoloLesson[]>([]);
  const [counts, setCounts] = useState<Map<string, { total: number; done: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [preview, setPreview] = useState<SoloLesson | null>(null);
  const [editing, setEditing] = useState<SoloLesson | null>(null);
  const [startPaste, setStartPaste] = useState(false);
  const [assigning, setAssigning] = useState<{ lesson: SoloLesson; kind: 'lesson' | 'homework' } | null>(null);
  const [statusOf, setStatusOf] = useState<SoloLesson | null>(null);
  const [recordsOf, setRecordsOf] = useState<{ lesson: SoloLesson; row: SoloStatusRow } | null>(null);

  const reload = useCallback(async () => {
    if (!classId) {
      setLessons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchSoloLessons(academyId, classId);
      setLessons(list);
      setCounts(await fetchSoloAssignmentCounts(list.map((l) => l.id)));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [academyId, classId, notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function rename(l: SoloLesson) {
    const next = window.prompt(t('solo.renamePrompt'), l.name);
    if (!next?.trim() || next.trim() === l.name) return;
    try {
      await renameSoloLesson(l.id, next.trim());
      void reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  async function remove(l: SoloLesson) {
    if (!window.confirm(t('solo.deleteConfirm', { name: l.name }))) return;
    try {
      await deleteSoloLesson(l.id);
      void reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-primary-fixed/25 p-4">
        <p className="font-body-md text-body-md text-on-surface">{t('solo.intro')}</p>
      </div>

      <button
        type="button"
        onClick={() => setCatalogOpen(true)}
        disabled={!classId}
        className="rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
      >
        + {t('solo.createButton')}
      </button>

      {loading ? (
        <div className="py-10 text-center font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant py-12 text-center font-body-md text-on-surface-variant">{t('solo.empty')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orderLessons(lessons).map((l) => {
            const c = counts.get(l.id);
            return (
              <div key={l.id} className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-title-md text-title-md font-bold text-deep-navy">{l.name}</div>
                    <div className="font-caption text-caption text-on-surface-variant">
                      {t('solo.cardMeta', { minutes: l.minutes, steps: l.steps.length })}
                      {l.level ? ` · ${l.level}` : ''}
                    </div>
                  </div>
                  <button type="button" onClick={() => void rename(l)} aria-label={t('solo.rename')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button type="button" onClick={() => void remove(l)} aria-label={t('common.delete')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-error">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
                <div className="font-caption text-caption text-on-surface-variant">
                  {c ? t('solo.assignedCount', { total: c.total, done: c.done }) : t('solo.notAssigned')}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setAssigning({ lesson: l, kind: 'homework' })} className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary hover:bg-primary-container">
                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                    {t('solo.assignHomework')}
                  </button>
                  <button type="button" onClick={() => setStatusOf(l)} className="rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
                    {t('solo.status')}
                  </button>
                  <button type="button" onClick={() => setEditing(l)} className="flex items-center gap-1 rounded-full border border-primary px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    {t('solo.editLesson')}
                  </button>
                  <details className="relative">
                    <summary
                      className="flex cursor-pointer list-none items-center rounded-full border border-outline-variant px-2 py-1.5 text-on-surface-variant hover:border-primary hover:text-primary [&::-webkit-details-marker]:hidden"
                      aria-label={t('solo.more')}
                    >
                      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                    </summary>
                    <div className="absolute left-0 top-full z-10 mt-1 w-48 space-y-0.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg">
                      <button type="button" onClick={(e) => { (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); setPreview(l); }} className="block w-full rounded-lg px-3 py-2 text-left font-label-md text-label-md text-on-surface hover:bg-surface-container-low">
                        {t('solo.preview')}
                      </button>
                      <button type="button" onClick={(e) => { (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); setAssigning({ lesson: l, kind: 'lesson' }); }} className="block w-full rounded-lg px-3 py-2 text-left font-label-md text-label-md text-on-surface hover:bg-surface-container-low">
                        {t('solo.assign')}
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {catalogOpen && classId && (
        <SoloCatalogModal
          academyId={academyId}
          onClose={() => setCatalogOpen(false)}
          onBatch={async (lessons, level, source) => {
            try {
              for (const l of lessons) {
                await createSoloLesson({ academyId, classId, name: l.name, level, minutes: l.minutes, steps: l.steps, source });
              }
              notify(t('solo.createdMany', { count: lessons.length }));
              setCatalogOpen(false);
              void reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : String(e), 'error');
            }
          }}
          onScratch={async (name, withPaste) => {
            try {
              const created = await createSoloLesson({
                academyId,
                classId,
                name,
                level: null,
                minutes: 10,
                steps: [{ t: 'intro', title: name, text: t('solo.scratchIntro') }],
                source: 'scratch',
              });
              setCatalogOpen(false);
              void reload();
              setStartPaste(withPaste);
              setEditing(created);
            } catch (e) {
              notify(e instanceof Error ? e.message : String(e), 'error');
            }
          }}
        />
      )}
      {preview && <SoloPreview steps={preview.steps} onClose={() => setPreview(null)} />}
      {editing && (
        <SoloLessonEditor
          lesson={editing}
          academyId={academyId}
          startWithPaste={startPaste}
          assignedCount={counts.get(editing.id)?.total ?? 0}
          onClose={(saved) => {
            setEditing(null);
            if (saved) void reload();
          }}
        />
      )}
      {assigning && classId && (
        <AssignModal
          lesson={assigning.lesson}
          initialKind={assigning.kind}
          classId={classId}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null);
            void reload();
          }}
        />
      )}
      {statusOf && <StatusModal lesson={statusOf} onClose={() => setStatusOf(null)} onRecords={(row) => setRecordsOf({ lesson: statusOf, row })} />}
      {recordsOf && <RecordingsModal lesson={recordsOf.lesson} row={recordsOf.row} onClose={() => setRecordsOf(null)} />}
    </div>
  );
}

/* ---------------- 학생에게 내기 ---------------- */

function AssignModal({ lesson, classId, initialKind, onClose, onDone }: { lesson: SoloLesson; classId: string; initialKind: 'lesson' | 'homework'; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // 숙제는 기한이 있어야 해서 기본을 3일 뒤로 둔다(바꿀 수 있다)
  const defaultDue = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [kind, setKind] = useState<'lesson' | 'homework'>(initialKind);
  const [due, setDue] = useState(initialKind === 'homework' ? defaultDue() : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchStudentsOfClass(classId)
      .then((s) => {
        setStudents(s);
        setPicked(new Set(s.map((x) => x.id)));
      })
      .catch((e) => notify(e instanceof Error ? e.message : String(e), 'error'));
  }, [classId, notify]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function send() {
    if (picked.size === 0 || busy) return;
    setBusy(true);
    try {
      const n = await assignSoloLesson(lesson.id, [...picked], due ? new Date(`${due}T23:59:59`).toISOString() : null, kind);
      notify(t('solo.assignedToast', { count: n }));
      onDone();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('solo.assignTitle', { name: lesson.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('solo.kindLabel')}>
          {(['lesson', 'homework'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                if (k === 'homework' && !due) setDue(defaultDue());
              }}
              className={`rounded-xl border-2 px-3 py-2 text-left ${kind === k ? 'border-primary bg-primary/10' : 'border-outline-variant hover:bg-surface-container-low'}`}
            >
              <span className="block font-label-md text-label-md font-bold text-deep-navy">{t(`solo.kind_${k}`)}</span>
              <span className="block font-caption text-caption text-on-surface-variant">{t(`solo.kindHint_${k}`)}</span>
            </button>
          ))}
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('solo.assignHint')}</p>
        <div className="flex gap-3 font-caption text-caption">
          <button type="button" onClick={() => setPicked(new Set(students.map((s) => s.id)))} className="text-primary hover:underline">{t('solo.selectAll')}</button>
          <button type="button" onClick={() => setPicked(new Set())} className="text-on-surface-variant hover:underline">{t('solo.selectNone')}</button>
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {students.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
                <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                <span className="font-label-md text-label-md text-on-surface">{s.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <label className="block space-y-1">
          <span className="font-caption text-caption text-on-surface-variant">{t('solo.dueLabel')}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm" />
        </label>
        <div className="flex items-center gap-2">
          <button type="button" disabled={picked.size === 0 || busy} onClick={() => void send()} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {t('solo.sendTo', { count: picked.size })}
          </button>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 현황 ---------------- */

function StatusModal({ lesson, onClose, onRecords }: { lesson: SoloLesson; onClose: () => void; onRecords: (row: SoloStatusRow) => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const { academy, pointUnit } = useAuth();
  const [rows, setRows] = useState<SoloStatusRow[] | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState('');
  const [rewarding, setRewarding] = useState(false);
  const [tick, setTick] = useState(0);
  const hasSing = lesson.steps.some((st) => st.t === 'lineSing' || st.t === 'fadeRead' || st.t === 'roleplay');

  useEffect(() => {
    if (!academy?.id) return;
    fetchPresets(academy.id).then(
      (ps) => {
        const plus = ps.filter((p) => p.delta > 0);
        setPresets(plus);
        setPresetId((cur) => cur || (plus.find((p) => p.is_homework) ?? plus[0])?.id || '');
      },
      () => setPresets([]),
    );
  }, [academy?.id]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchSoloStatus(lesson.id)
        .then((r) => alive && setRows(r))
        .catch((e) => alive && notify(e instanceof Error ? e.message : String(e), 'error'));
    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [lesson.id, notify, tick]);

  const waiting = (rows ?? []).filter((r) => r.finished_at && !r.rewarded);
  const rewardedCount = (rows ?? []).filter((r) => r.rewarded).length;
  const preset = presets.find((p) => p.id === presetId);

  async function give() {
    if (!preset || waiting.length === 0 || rewarding) return;
    setRewarding(true);
    try {
      const r = await rewardSoloLesson(lesson.id, preset.id, waiting.map((w) => w.student_id), dateKey());
      if (r.locked) notify(t('solo.rewardLocked'), 'error');
      else notify(t('solo.rewardGiven', { count: r.given, delta: preset.delta, unit: pointUnit }));
      setTick((n) => n + 1);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setRewarding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-2xl space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('solo.statusTitle', { name: lesson.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {rows === null ? (
          <div className="py-8 text-center text-on-surface-variant">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">{t('solo.statusEmpty')}</div>
        ) : (
          <>
            {(() => {
              const stuck = rows.filter((r) => r.unsure_count > 0);
              if (stuck.length === 0) return null;
              return (
                <div className="rounded-lg bg-warm-yellow/25 px-3 py-2 font-caption text-caption text-on-surface">
                  {t('solo.stuckSummary', { count: stuck.length })}
                </div>
              );
            })()}
            {rows.some((r) => r.finished_at) && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warm-yellow/30 p-3">
                <span className="material-symbols-outlined text-deep-navy">savings</span>
                <div className="min-w-0 flex-1 font-label-md text-label-md text-deep-navy">
                  {waiting.length > 0 ? (
                    <>
                      <b>{t('solo.rewardWaiting', { count: waiting.length })}</b>
                      <span className="ml-1 font-caption text-caption text-on-surface-variant">{waiting.map((w) => w.name).join(', ')}</span>
                    </>
                  ) : (
                    <b>{t('solo.rewardAllDone', { count: rewardedCount })}</b>
                  )}
                </div>
                {waiting.length > 0 &&
                  (presets.length === 0 ? (
                    <span className="font-caption text-caption text-on-surface-variant">{t('solo.rewardNoPreset')}</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={presetId}
                        onChange={(e) => setPresetId(e.target.value)}
                        aria-label={t('solo.rewardPreset')}
                        className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm"
                      >
                        {presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} (+{p.delta})
                          </option>
                        ))}
                      </select>
                      <button type="button" disabled={rewarding} onClick={() => void give()} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-40">
                        {t('solo.rewardGive')}
                      </button>
                    </div>
                  ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="font-caption text-caption text-on-surface-variant">
                    <th className="pb-2 pr-3">{t('attendance.name')}</th>
                    <th className="pb-2 pr-3">{t('solo.colProgress')}</th>
                    <th className="pb-2 pr-3">{t('solo.colRight')}</th>
                    <th className="pb-2 pr-3">{t('solo.colUnsure')}</th>
                    {hasSing && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.assignment_id} className="border-t border-surface-container">
                      <td className="py-2 pr-3 font-label-md text-label-md text-on-surface">{r.name}</td>
                      <td className="py-2 pr-3">
                        {r.finished_at ? (
                          <span className="rounded-full bg-secondary-container/60 px-2 py-0.5 font-caption text-caption">{t('solo.finished')}{r.rewarded ? ` · ${t('solo.rewardedBadge')}` : ''}</span>
                        ) : r.started_at ? (
                          <span className="font-caption text-caption tabular-nums text-on-surface">
                            {r.progress}/{r.total}
                          </span>
                        ) : (
                          <span className="font-caption text-caption text-on-surface-variant">{t('solo.notStarted')}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-caption text-caption tabular-nums text-on-surface">
                        {r.right_count + r.wrong_count > 0 ? `${r.right_count}/${r.right_count + r.wrong_count}` : '-'}
                      </td>
                      <td className="py-2 pr-3 font-caption text-caption text-on-surface">
                        {r.unsure_count > 0 ? t('solo.unsureAt', { steps: r.unsure_steps.join(', ') }) : '-'}
                      </td>
                      {hasSing && (
                        <td className="py-2">
                          <button type="button" onClick={() => onRecords(r)} className="whitespace-nowrap rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/10">
                            {t('solo.listenRecordings')}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
