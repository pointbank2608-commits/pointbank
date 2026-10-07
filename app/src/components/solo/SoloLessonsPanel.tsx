import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { fetchStudentsOfClass } from '../../lib/api';
import {
  assignSoloLesson,
  createSoloLesson,
  deleteSoloLesson,
  fetchSoloAssignmentCounts,
  fetchSoloLessons,
  fetchSoloStatus,
  renameSoloLesson,
  type SoloLesson,
  type SoloStatusRow,
} from '../../lib/soloApi';
import { buildSoloFromCatalog, gradeSoloLocal, soloCorrectText, SOLO_CATALOG, toPublicStep, type SoloCatalogItem } from '../../lib/soloLessons';
import type { Student } from '../../lib/types';
import { loadWordBank } from '../../lib/wordBankCache';
import SoloPlayer, { type SoloPlayerApi } from './SoloPlayer';

/**
 * 내 수업 → "개별수업" 탭. 개별수업은 화면이 선생님이 되어 학생이 혼자 하는 수업이다(단체수업과 목록·만들기가 따로).
 * 만들기 = "커리큘럼 보기"에서 미리 만든 수업을 골라 이 반 것으로 가져온다 → 학생에게 내기 → 현황 보기.
 */
export default function SoloLessonsPanel({ academyId, classId }: { academyId: string; classId: string | null }) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();
  const [lessons, setLessons] = useState<SoloLesson[]>([]);
  const [counts, setCounts] = useState<Map<string, { total: number; done: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [preview, setPreview] = useState<SoloLesson | null>(null);
  const [assigning, setAssigning] = useState<SoloLesson | null>(null);
  const [statusOf, setStatusOf] = useState<SoloLesson | null>(null);

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
          {lessons.map((l) => {
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
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPreview(l)} className="rounded-full border border-primary px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10">
                    {t('solo.preview')}
                  </button>
                  <button type="button" onClick={() => setAssigning(l)} className="rounded-full bg-primary px-3 py-1.5 font-label-md text-label-md text-on-primary hover:bg-primary-container">
                    {t('solo.assign')}
                  </button>
                  <button type="button" onClick={() => setStatusOf(l)} className="rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary">
                    {t('solo.status')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {catalogOpen && classId && (
        <CatalogModal
          onClose={() => setCatalogOpen(false)}
          onPick={async (item) => {
            try {
              const built = buildSoloFromCatalog(item, await loadWordBank(), i18n.language);
              if (!built) {
                notify(t('solo.buildFailed'), 'error');
                return;
              }
              await createSoloLesson({ academyId, classId, name: built.name, level: item.level, minutes: item.minutes, steps: built.steps, source: item.id });
              notify(t('solo.created', { name: built.name }));
              setCatalogOpen(false);
              void reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : String(e), 'error');
            }
          }}
        />
      )}
      {preview && <PreviewOverlay lesson={preview} onClose={() => setPreview(null)} />}
      {assigning && classId && (
        <AssignModal
          lesson={assigning}
          classId={classId}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null);
            void reload();
          }}
        />
      )}
      {statusOf && <StatusModal lesson={statusOf} onClose={() => setStatusOf(null)} />}
    </div>
  );
}

/* ---------------- 커리큘럼 보기(미리 만든 개별수업) ---------------- */

function CatalogModal({ onClose, onPick }: { onClose: () => void; onPick: (item: SoloCatalogItem) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const ko = i18n.language.startsWith('ko');
  const tracks: { id: SoloCatalogItem['track']; icon: string }[] = [
    { id: 'word', icon: 'abc' },
    { id: 'grammar', icon: 'rule' },
    { id: 'video', icon: 'movie' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-3xl space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px] text-primary">route</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-title-md text-title-md font-bold text-deep-navy">{t('solo.catalogTitle')}</h3>
            <p className="font-caption text-caption text-on-surface-variant">{t('solo.catalogHint')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="font-label-md text-label-md font-bold text-deep-navy">Level 1</div>
        {tracks.map((tr) => (
          <div key={tr.id} className="space-y-2">
            <div className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">{tr.icon}</span>
              {t(`solo.track_${tr.id}`)}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOLO_CATALOG.filter((c) => c.track === tr.id).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!!c.soon || busy !== null}
                  onClick={async () => {
                    setBusy(c.id);
                    await onPick(c);
                    setBusy(null);
                  }}
                  className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px] text-primary">{c.icon}</span>
                    <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{ko ? c.ko : c.en}</span>
                    {c.soon ? (
                      <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('solo.soon')}</span>
                    ) : (
                      <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('recipes.minutes', { n: c.minutes })}</span>
                    )}
                  </div>
                  <div className="font-caption text-caption text-on-surface-variant">{ko ? c.koDesc : c.enDesc}</div>
                  {busy === c.id && <div className="font-caption text-caption text-primary">{t('common.loading')}</div>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 학생 화면 미리보기 ---------------- */

function PreviewOverlay({ lesson, onClose }: { lesson: SoloLesson; onClose: () => void }) {
  const api = useMemo<SoloPlayerApi>(() => {
    const attempts = new Map<number, number>();
    return {
      answer: async (step, value) => {
        attempts.set(step, (attempts.get(step) ?? 0) + 1);
        return gradeSoloLocal(lesson.steps[step], value) ?? true;
      },
      advance: async (step, unsure) => ({ answer: unsure ? soloCorrectText(lesson.steps[step]) : null }),
      reveal: async (step) => soloCorrectText(lesson.steps[step]),
    };
  }, [lesson]);
  const steps = useMemo(() => lesson.steps.map(toPublicStep), [lesson]);
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#16213e]">
      <SoloPlayer steps={steps} api={api} onExit={onClose} preview />
    </div>
  );
}

/* ---------------- 학생에게 내기 ---------------- */

function AssignModal({ lesson, classId, onClose, onDone }: { lesson: SoloLesson; classId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [due, setDue] = useState('');
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
      const n = await assignSoloLesson(lesson.id, [...picked], due ? new Date(`${due}T23:59:59`).toISOString() : null);
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

function StatusModal({ lesson, onClose }: { lesson: SoloLesson; onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [rows, setRows] = useState<SoloStatusRow[] | null>(null);

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
  }, [lesson.id, notify]);

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
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="font-caption text-caption text-on-surface-variant">
                    <th className="pb-2 pr-3">{t('attendance.name')}</th>
                    <th className="pb-2 pr-3">{t('solo.colProgress')}</th>
                    <th className="pb-2 pr-3">{t('solo.colRight')}</th>
                    <th className="pb-2">{t('solo.colUnsure')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.assignment_id} className="border-t border-surface-container">
                      <td className="py-2 pr-3 font-label-md text-label-md text-on-surface">{r.name}</td>
                      <td className="py-2 pr-3">
                        {r.finished_at ? (
                          <span className="rounded-full bg-secondary-container/60 px-2 py-0.5 font-caption text-caption">{t('solo.finished')}</span>
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
                      <td className="py-2 font-caption text-caption text-on-surface">
                        {r.unsure_count > 0 ? t('solo.unsureAt', { steps: r.unsure_steps.join(', ') }) : '-'}
                      </td>
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
