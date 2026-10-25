import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildNumberRange, NUMBER_RANGE_MAX } from '../lib/numberRange';

/** 시작·끝 숫자(와 간격)를 적으면 그 사이 숫자를 한꺼번에 항목으로 넣는다. 랜덤 공 뽑기 전용. */
export default function NumberRangeFill({ existingLabels, onFill }: { existingLabels: string[]; onFill: (labels: string[], replace: boolean) => void }) {
  const { t } = useTranslation();
  const [start, setStart] = useState('1');
  const [end, setEnd] = useState('30');
  const [step, setStep] = useState('1');
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'min-h-11 w-20 rounded-lg border border-outline-variant bg-white px-2 text-center text-lg font-bold text-deep-navy';

  function fill() {
    const r = buildNumberRange(start, end, step);
    if ('error' in r) {
      setError(t(`gameOrder.rangeError_${r.error}`, { max: NUMBER_RANGE_MAX }));
      return;
    }
    setError(null);
    const have = new Set(replace ? [] : existingLabels);
    onFill(r.numbers.map(String).filter((s) => !have.has(s)), replace);
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3" data-number-range>
      <div className="mb-2 font-label-md text-label-md text-on-surface">{t('gameOrder.rangeTitle')}</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          {t('gameOrder.rangeStart')}
          <input type="number" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} className={field} data-range-start />
        </label>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          {t('gameOrder.rangeEnd')}
          <input type="number" inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value)} className={field} data-range-end />
        </label>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          {t('gameOrder.rangeStep')}
          <input type="number" inputMode="numeric" min={1} value={step} onChange={(e) => setStep(e.target.value)} className={field} data-range-step />
        </label>
        <button type="button" onClick={fill} className="min-h-11 rounded-xl bg-primary px-5 font-bold text-on-primary shadow-sm hover:bg-primary-container" data-range-fill>
          {t('gameOrder.rangeFill')}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} data-range-replace />
        {t('gameOrder.rangeReplace')}
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-error" data-range-error>
          {error}
        </p>
      )}
    </div>
  );
}
