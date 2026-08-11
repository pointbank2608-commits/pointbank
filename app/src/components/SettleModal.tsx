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
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">오늘 통장 정리</div>
            <div className="modal-sub">
              {className} · {dayLabel}
            </div>
          </div>
          <button className="icon-btn" onClick={onCancel}>
            ✕
          </button>
        </div>

        {active.length === 0 ? (
          <div className="empty-hint">오늘 적립된 포인트가 없습니다.</div>
        ) : (
          <div className="settle-list">
            {active.map((r) => (
              <div className="settle-line" key={r.studentId}>
                <span className="sname">{r.name}</span>
                <span className={`sdelta ${r.today > 0 ? 'plus' : 'minus'}`}>
                  {signed(r.today)}
                  {pointUnit}
                </span>
              </div>
            ))}
            <div className="settle-total">
              <span>
                합계 · {active.length}명
              </span>
              <span className={totalDelta >= 0 ? 'plus' : 'minus'}>
                {signed(totalDelta)}
                {pointUnit}
              </span>
            </div>
          </div>
        )}

        <p className="modal-note">
          마감하면 오늘 내역이 확정되고 더 이상 수정할 수 없습니다. 마감 후에도 필요하면 취소할 수
          있어요.
        </p>

        <button className="btn-primary gold" disabled={busy} onClick={onConfirm}>
          {busy ? '적립 중…' : '통장에 적립하기'}
        </button>
      </div>
    </div>
  );
}
