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
            <div className="font-title-md text-title-md text-deep-navy">오늘 통장 정리</div>
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
            <div className="text-center py-6 font-body-md text-on-surface-variant">
              오늘 적립된 포인트가 없습니다.
            </div>
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
                  합계 · {active.length}명
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
            마감하면 오늘 내역이 확정되고 더 이상 수정할 수 없습니다. 마감 후에도 필요하면 취소할 수
            있어요.
          </p>

          <button
            disabled={busy}
            onClick={onConfirm}
            className="w-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-title-md text-title-md py-3 rounded-lg shadow-sm transition-colors"
          >
            {busy ? '적립 중…' : '통장에 적립하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
