import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  adminBulkApply, adminBulkFeaturesPreview, adminBulkRecent, adminBulkUndo, errorText, fmtKst, useAdminQuery,
  type AcademyFilterKey, type BulkBatchRow, type BulkPreview,
} from '../../lib/adminOps';
import { Badge, DataState, ReasonDialog } from './AdminUi';

type Tri = 'keep' | 'open' | 'close';
const KEYS = ['group', 'solo', 'homework'] as const;

/**
 * 대량 기능 열기·닫기(2026-10-18) — 대상(현재 검색 결과 전체 / 고른 학원)을 정하고 → 미리보기(누가 어떻게 바뀌는지) → 사유와 함께 적용.
 * 같은 묶음은 한 번만 적용되고, 일부 실패한 항목은 다시 처리하고, 적용한 묶음은 되돌릴 수 있다. 서버가 모두 검증한다(086r·086s).
 */
export default function BulkFeaturesPanel({
  query, filter, excludeTest, total, selectedIds, onDone,
}: {
  query: string; filter: AcademyFilterKey; excludeTest: boolean; total: number; selectedIds: string[]; onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ko';
  const [mode, setMode] = useState<'filter' | 'ids'>('filter');
  const [vals, setVals] = useState<Record<(typeof KEYS)[number], Tri>>({ group: 'keep', solo: 'keep', homework: 'keep' });
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [apply, setApply] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<BulkBatchRow | null>(null);
  const recent = useAdminQuery(() => adminBulkRecent(), [done]);

  const toBool = (v: Tri) => (v === 'keep' ? null : v === 'open');
  const anyChange = KEYS.some((k) => vals[k] !== 'keep');
  const usingIds = mode === 'ids';
  const count = usingIds ? selectedIds.length : total;

  async function makePreview() {
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      setPreview(
        await adminBulkFeaturesPreview({
          query, filter, ids: usingIds ? selectedIds : null, excludeTest,
          group: toBool(vals.group), solo: toBool(vals.solo), homework: toBool(vals.homework),
        }),
      );
    } catch (e) {
      setErr(errorText(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const triBtn = (k: (typeof KEYS)[number], v: Tri) => (
    <button
      key={v}
      type="button"
      aria-pressed={vals[k] === v}
      onClick={() => { setVals((s) => ({ ...s, [k]: v })); setPreview(null); }}
      className={`rounded-full px-3 py-1 font-label-md text-[13px] ${vals[k] === v ? 'bg-primary font-bold text-white' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}`}
    >
      {t(`adminV2.bulk.tri_${v}`)}
    </button>
  );

  return (
    <div className="space-y-4 rounded-xl border border-outline-variant bg-white p-5 shadow-card">
      <div>
        <h3 className="font-title-md text-[18px] font-extrabold text-deep-navy">{t('adminV2.bulk.title')}</h3>
        <p className="mt-0.5 font-caption text-[13px] text-on-surface-variant">{t('adminV2.bulk.desc')}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-label-md text-label-md font-bold text-deep-navy">{t('adminV2.bulk.scope')}</legend>
        <label className="flex items-start gap-2 font-body-md text-body-md">
          <input type="radio" name="bulk-scope" checked={!usingIds} onChange={() => { setMode('filter'); setPreview(null); }} className="mt-1 accent-primary" />
          <span>{t('adminV2.bulk.scopeFilter', { n: total })}<span className="block font-caption text-[12px] text-on-surface-variant">{t('adminV2.bulk.scopeFilterHint')}</span></span>
        </label>
        <label className="flex items-start gap-2 font-body-md text-body-md">
          <input type="radio" name="bulk-scope" checked={usingIds} onChange={() => { setMode('ids'); setPreview(null); }} className="mt-1 accent-primary" />
          <span>{t('adminV2.bulk.scopeIds', { n: selectedIds.length })}</span>
        </label>
      </fieldset>

      <div className="space-y-2">
        {KEYS.map((k) => (
          <div key={k} className="flex flex-wrap items-center gap-2">
            <span className="w-28 font-label-md text-label-md font-bold text-deep-navy">{t(`adminOps.feature_${k}`)}</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(`adminOps.feature_${k}`)}>
              {(['keep', 'open', 'close'] as const).map((v) => triBtn(k, v))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !anyChange || count === 0}
          onClick={() => void makePreview()}
          className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md font-bold text-white hover:bg-primary-container disabled:opacity-50"
        >
          {busy ? t('adminV2.common.working') : t('adminV2.bulk.previewBtn')}
        </button>
        <span className="font-caption text-[12px] text-on-surface-variant">{count === 0 ? t('adminV2.bulk.noTargets') : t('adminV2.bulk.targetCount', { n: count })}</span>
      </div>
      {err && <p role="alert" className="font-caption text-caption text-error">{err}</p>}

      {preview && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-fixed/40 p-4">
          <div className="font-label-md text-[15px] font-bold text-deep-navy">
            {t('adminV2.bulk.previewResult', { targets: preview.targets, change: preview.will_change, same: preview.unchanged })}
          </div>
          {preview.sample.length > 0 && (
            <ul className="space-y-1 font-caption text-[13px]">
              {preview.sample.map((s, i) => (
                <li key={i} className="break-words">
                  <b>{s.academy}</b>{' '}
                  {KEYS.filter((k) => s.before[k] !== s.after[k]).map((k) => `${t(`adminOps.feature_${k}`)}: ${s.before[k] ? t('adminV2.bulk.on') : t('adminV2.bulk.off')} → ${s.after[k] ? t('adminV2.bulk.on') : t('adminV2.bulk.off')}`).join(' · ')}
                </li>
              ))}
              {preview.will_change > preview.sample.length && <li className="text-on-surface-variant">{t('adminV2.bulk.andMore', { n: preview.will_change - preview.sample.length })}</li>}
            </ul>
          )}
          <button
            type="button"
            disabled={preview.will_change === 0}
            onClick={() => setApply(true)}
            className="rounded-full bg-deep-navy px-5 py-2 font-label-md text-label-md font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {t('adminV2.bulk.applyBtn', { n: preview.will_change })}
          </button>
        </div>
      )}
      {done && <p role="status" className="rounded-lg bg-[#e0f5ea] px-3 py-2 font-label-md text-label-md text-[#0f6b3e]">{done}</p>}

      <div>
        <h4 className="mb-2 font-label-md text-label-md font-bold text-deep-navy">{t('adminV2.bulk.recent')}</h4>
        <DataState state={recent} empty={t('adminV2.bulk.recentEmpty')} compact>
          {(rows) => (
            <ul className="space-y-1.5">
              {rows.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 font-caption text-[13px]">
                  <Badge tone={b.status === 'done' ? 'ok' : b.status === 'partial' ? 'warn' : 'mute'}>{t(`adminV2.bulk.status_${b.status}`)}</Badge>
                  <span className="min-w-0 flex-1 break-words">
                    {fmtKst(b.applied_at ?? b.created_at, lang)} · {t('adminV2.bulk.batchSummary', { ok: b.ok_count, failed: b.failed_count })}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </span>
                  {b.status === 'partial' && (
                    <button type="button" onClick={() => void retry(b)} className="rounded-full border border-primary px-3 py-0.5 font-bold text-primary hover:bg-primary-fixed">{t('adminV2.bulk.retry')}</button>
                  )}
                  {(b.status === 'done' || b.status === 'partial') && (
                    <button type="button" onClick={() => setUndoing(b)} className="rounded-full border border-outline-variant px-3 py-0.5 text-on-surface-variant hover:bg-surface-container">{t('adminV2.bulk.undo')}</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </div>

      {apply && preview && (
        <ReasonDialog
          title={t('adminV2.bulk.applyTitle')}
          body={t('adminV2.bulk.applyBody', { n: preview.will_change })}
          confirmLabel={t('adminV2.bulk.applyConfirm')}
          onClose={() => setApply(false)}
          onConfirm={async (reason) => {
            const r = await adminBulkApply(preview.batch_id, reason);
            setApply(false);
            setPreview(null);
            setDone(r.failed > 0 ? t('adminV2.bulk.donePartial', { ok: r.ok, failed: r.failed }) : t('adminV2.bulk.doneOk', { ok: r.ok }));
            onDone();
          }}
        />
      )}
      {undoing && (
        <ReasonDialog
          title={t('adminV2.bulk.undoTitle')}
          body={t('adminV2.bulk.undoBody')}
          confirmLabel={t('adminV2.bulk.undo')}
          onClose={() => setUndoing(null)}
          onConfirm={async (reason) => {
            const r = await adminBulkUndo(undoing.id, reason);
            setUndoing(null);
            setDone(t('adminV2.bulk.undoDone', { restored: r.restored, skipped: r.skipped }));
            onDone();
          }}
        />
      )}
    </div>
  );

  async function retry(b: BulkBatchRow) {
    setErr(null);
    try {
      const r = await adminBulkApply(b.id, b.reason ?? t('adminV2.bulk.retry'));
      setDone(r.failed > 0 ? t('adminV2.bulk.donePartial', { ok: r.ok, failed: r.failed }) : t('adminV2.bulk.doneOk', { ok: r.ok }));
      onDone();
    } catch (e) {
      setErr(errorText(e));
    }
  }
}
