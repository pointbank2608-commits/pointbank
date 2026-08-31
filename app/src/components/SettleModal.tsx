import { useTranslation } from 'react-i18next';
import { signed } from '../lib/format';

interface Row {
  studentId: string;
  name: string;
  today: number;
}

interface Props {
  className: string;
  dayLabel: string;
  rows: Row[];
  pointUnit: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 오늘 마감 전에 "무엇이 통장에 찍히는지" 확인시켜 주는 화면. */
export default function SettleModal({
  className,
  dayLabel,
  rows,
  pointUnit,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const active = rows.filter((r) => r.today !== 0).sort((a, b) => b.today - a.today);
  const totalDelta = active.reduce((sum, r) => sum + r.today, 0);

  return (
    <div
      className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-[400px] rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-surface-variant flex justify-between items-center bg-surface-bright">
          <div>
            <div className="font-title-md text-title-md text-deep-navy">{t('settleModal.title')}</div>
            <div className="font-caption text-caption text-on-surface-variant">
              {className} · {dayLabel}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5">
          {active.length === 0 ? (
            <div className="text-center py-6 font-body-md text-on-surface-variant">{t('settleModal.noEntries')}</div>
          ) : (
            <div className="mb-4">
              <div className="max-h-64 overflow-y-auto space-y-1">
                {active.map((r) => (
                  <div key={r.studentId} className="flex justify-between items-center py-1.5">
                    <span className="font-body-md text-body-md text-on-surface">{r.name}</span>
                    <span
                      className={`font-title-md text-title-md ${r.today > 0 ? 'text-secondary' : 'text-error'}`}
                    >
                      {signed(r.today)}
                      {pointUnit}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-3 mt-2 border-t border-surface-container">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  {t('settleModal.totalLabel', { count: active.length })}
                </span>
                <span
                  className={`font-title-md text-title-md ${totalDelta >= 0 ? 'text-secondary' : 'text-error'}`}
                >
                  {signed(totalDelta)}
                  {pointUnit}
                </span>
              </div>
            </div>
          )}

          <p className="font-caption text-caption text-on-surface-variant mb-4 leading-relaxed">
            {t('settleModal.note')}
          </p>

          <button
            disabled={busy}
            onClick={onConfirm}
            className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-title-md text-title-md py-3 rounded-lg shadow-sm transition-colors"
          >
            {busy ? t('settleModal.confirming') : t('settleModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
