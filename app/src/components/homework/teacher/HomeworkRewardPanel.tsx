import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { fetchPresets } from '../../../lib/api';
import { dateKey } from '../../../lib/format';
import { rewardHomework, teacherErrorKey, type HomeworkSummary } from '../../../lib/homework';
import type { Preset } from '../../../lib/types';

/**
 * 숙제 → 통장(2026-10-05, 042) — 숙제를 끝낸 학생에게 통장 프리셋으로 포인트를 한 번에 준다.
 * 같은 숙제로 같은 학생에게 두 번 주지 않는다(서버가 막음). 숙제 프리셋이면 그대로 숙제 캘린더 "완료"(룰 5).
 * 통장과 같은 프리셋만 쓰고, 그날 반 통장이 마감됐으면 막는다.
 */
export default function HomeworkRewardPanel({ assignmentId, summary, onGiven }: { assignmentId: string; summary: HomeworkSummary; onGiven: () => void }) {
  const { t } = useTranslation();
  const { academy, pointUnit } = useAuth();
  const { notify } = useToast();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!academy?.id) return;
    fetchPresets(academy.id).then(
      (ps) => {
        const plus = ps.filter((p) => p.delta > 0);
        setPresets(plus);
        // 숙제 완료 프리셋이 있으면 그걸 먼저
        setPresetId((cur) => cur || (plus.find((p) => p.is_homework) ?? plus[0])?.id || '');
      },
      () => setPresets([]),
    );
  }, [academy?.id]);

  const waiting = useMemo(() => summary.students.filter((s) => s.status === 'done' && !s.archived && !s.rewarded), [summary]);
  const rewardedCount = summary.students.filter((s) => s.rewarded).length;
  const preset = presets.find((p) => p.id === presetId);

  async function give() {
    if (!preset || waiting.length === 0) return;
    setBusy(true);
    try {
      const r = await rewardHomework(assignmentId, preset.id, waiting.map((s) => s.student_id), dateKey());
      if (r.locked) notify(t('studentHw.rewardLocked'), 'error');
      else notify(t('studentHw.rewardGiven', { count: r.given, delta: preset.delta, unit: pointUnit }));
      onGiven();
    } catch (e) {
      notify(t(teacherErrorKey(e)), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (summary.students.every((s) => s.status !== 'done')) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warm-yellow/30 p-3">
      <span className="material-symbols-outlined text-deep-navy">savings</span>
      <div className="min-w-0 flex-1 text-base text-deep-navy">
        {waiting.length > 0 ? (
          <>
            <b>{t('studentHw.rewardWaiting', { count: waiting.length })}</b>
            <span className="ml-1 text-sm text-on-surface-variant">{waiting.map((s) => s.name).join(', ')}</span>
          </>
        ) : (
          <b>{t('studentHw.rewardAllDone', { count: rewardedCount })}</b>
        )}
        <div className="text-sm text-on-surface-variant">{t('studentHw.rewardHint')}</div>
      </div>
      {waiting.length > 0 &&
        (presets.length === 0 ? (
          <span className="text-sm text-on-surface-variant">{t('studentHw.rewardNoPreset')}</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`reward-preset-${assignmentId}`}>
              {t('studentHw.rewardPreset')}
            </label>
            <select
              id={`reward-preset-${assignmentId}`}
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-base"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} (+{p.delta}){p.is_homework ? ` · ${t('studentHw.rewardCalendar')}` : ''}
                </option>
              ))}
            </select>
            <button type="button" disabled={busy || !preset} onClick={() => void give()} className="flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 font-label-md text-label-md text-on-primary disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {busy ? t('common.loading') : t('studentHw.rewardButton', { count: waiting.length })}
            </button>
          </div>
        ))}
    </div>
  );
}
