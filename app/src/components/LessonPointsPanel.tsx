import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchBalancesOfClass, fetchPresets, fetchSettlement, fetchTransactionsSince, givePoints } from '../lib/api';
import { dateKey, todayStart } from '../lib/format';
import type { Preset, StudentBalance } from '../lib/types';

/**
 * 발표 중 진행바의 "포인트 주기" — 수업 화면을 떠나지 않고 통장(/board)과 같은 프리셋으로 지급한다.
 * 학생을 여러 명 눌러 고른 뒤 프리셋을 누르면 고른 학생 모두에게 준다(통장의 일괄 지급과 같은 흐름).
 * 오늘 적립만 크게 보여주고(CLAUDE.md 룰 7), 숙제 프리셋은 is_homework 를 그대로 넘겨 숙제 캘린더에
 * 반영된다(룰 5). 오늘 마감(settlements)된 반이면 통장과 똑같이 지급을 막는다.
 */
export default function LessonPointsPanel({ classId, onClose }: { classId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { academy, profile, pointUnit } = useAuth();
  const { notify } = useToast();
  const [students, setStudents] = useState<StudentBalance[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [todayByStudent, setTodayByStudent] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!academy?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchBalancesOfClass(classId),
      fetchPresets(academy.id),
      fetchTransactionsSince(classId, todayStart()),
      fetchSettlement(classId, dateKey()),
    ])
      .then(([bal, pre, txs, settlement]) => {
        if (cancelled) return;
        setStudents(bal);
        setPresets(pre);
        const sums: Record<string, number> = {};
        for (const tx of txs) sums[tx.student_id] = (sums[tx.student_id] ?? 0) + tx.delta;
        setTodayByStudent(sums);
        setLocked(settlement !== null);
      })
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [academy?.id, classId, notify]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const allSelected = students.length > 0 && selected.size === students.length;
  const selectedNames = useMemo(
    () => students.filter((s) => selected.has(s.student_id)).map((s) => s.name),
    [students, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function give(preset: Preset) {
    if (!academy?.id || !profile || locked || selected.size === 0 || busy) return;
    const targets = [...selected];
    setBusy(true);
    // 낙관적으로 먼저 올리고, 실패한 학생만 되돌린다.
    setTodayByStudent((prev) => {
      const next = { ...prev };
      for (const id of targets) next[id] = (next[id] ?? 0) + preset.delta;
      return next;
    });
    const results = await Promise.allSettled(
      targets.map((studentId) =>
        givePoints({
          academyId: academy.id,
          classId,
          studentId,
          delta: preset.delta,
          reason: preset.label,
          teacherId: profile.id,
          teacherName: profile.display_name,
          isHomework: preset.is_homework,
        }),
      ),
    );
    const failed = targets.filter((_, i) => results[i].status === 'rejected');
    if (failed.length > 0) {
      setTodayByStudent((prev) => {
        const next = { ...prev };
        for (const id of failed) next[id] = (next[id] ?? 0) - preset.delta;
        return next;
      });
      notify(t('curriculum.play.pointsFailed', { count: failed.length }), 'error');
    } else {
      notify(
        t('curriculum.play.pointsGiven', {
          names: selectedNames.join(', '),
          delta: preset.delta > 0 ? `+${preset.delta}` : String(preset.delta),
          unit: pointUnit,
        }),
      );
      setSelected(new Set());
    }
    setBusy(false);
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('curriculum.play.pointsTitle')}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant/40 px-5 py-3">
          <span className="material-symbols-outlined text-primary">payments</span>
          <h2 className="flex-1 font-title-md text-title-md text-deep-navy">{t('curriculum.play.pointsTitle')}</h2>
          {students.length > 0 && !locked && (
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(students.map((s) => s.student_id)))}
              className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
            >
              {allSelected ? t('curriculum.play.pointsClearAll') : t('curriculum.play.pointsSelectAll')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.cancel')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</div>
          ) : students.length === 0 ? (
            <div className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.pointsNoStudents')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {students.map((s) => {
                const on = selected.has(s.student_id);
                const today = todayByStudent[s.student_id] ?? 0;
                return (
                  <button
                    key={s.student_id}
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(s.student_id)}
                    aria-pressed={on}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-4 transition-colors disabled:cursor-not-allowed ${
                      on
                        ? 'border-primary bg-primary-container text-on-primary-container'
                        : 'border-outline-variant/50 bg-surface-container-low text-on-surface hover:border-primary/60'
                    }`}
                  >
                    <span className="font-title-md text-[clamp(18px,2vw,24px)] font-bold">{s.name}</span>
                    <span className="font-label-md text-label-md tabular-nums">
                      {t('curriculum.play.pointsToday', { value: today > 0 ? `+${today}` : String(today), unit: pointUnit })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-outline-variant/40 px-5 py-4">
          {locked ? (
            <p className="font-body-md text-body-md text-error">{t('curriculum.play.pointsLocked')}</p>
          ) : presets.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.play.pointsNoPresets')}</p>
          ) : (
            <>
              <p className="mb-2 font-caption text-caption text-on-surface-variant">
                {selected.size === 0
                  ? t('curriculum.play.pointsPickStudents')
                  : t('curriculum.play.pointsSelectedCount', { count: selected.size })}
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={selected.size === 0 || busy}
                    onClick={() => void give(p)}
                    className={`rounded-full px-4 py-2.5 font-label-md text-label-md transition-opacity disabled:opacity-40 ${
                      p.delta > 0 ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {p.label} {p.delta > 0 ? `+${p.delta}` : p.delta}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
