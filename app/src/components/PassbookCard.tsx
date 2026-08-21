import { useState } from 'react';
import { fmtTime, signed } from '../lib/format';
import type { Attendance, Preset, Transaction } from '../lib/types';

interface Props {
  studentId: string;
  name: string;
  className: string;
  /** 오늘 적립분 — 화면의 주인공 */
  today: number;
  /** 누적 잔액. showTotal 이 켜졌을 때만 보인다. */
  total: number;
  showTotal: boolean;
  /** 오늘 마감되어 더 이상 지급할 수 없는 상태 */
  locked: boolean;
  pointUnit: string;
  presets: Preset[];
  todayTx: Transaction[];
  /** 오늘 출석 기록 (없으면 아직 등원 전) */
  attendance: Attendance | null;
  onGive: (studentId: string, delta: number, reason: string) => Promise<Transaction | null>;
  onUndo: (tx: Transaction) => Promise<boolean>;
  onRemove: (studentId: string, name: string) => void;
  onCheckIn: (studentId: string) => Promise<void>;
  onCheckOut: (studentId: string) => Promise<void>;
}

export default function PassbookCard({
  studentId,
  name,
  className,
  today,
  total,
  showTotal,
  locked,
  pointUnit,
  presets,
  todayTx,
  attendance,
  onGive,
  onUndo,
  onRemove,
  onCheckIn,
  onCheckOut,
}: Props) {
  const [attBusy, setAttBusy] = useState(false);

  async function handleCheckIn() {
    if (attBusy) return;
    setAttBusy(true);
    await onCheckIn(studentId);
    setAttBusy(false);
  }
  async function handleCheckOut() {
    if (attBusy) return;
    setAttBusy(true);
    await onCheckOut(studentId);
    setAttBusy(false);
  }
  const [busy, setBusy] = useState(false);
  const [stampKey, setStampKey] = useState(0);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  async function give(delta: number, why: string) {
    if (busy || locked) return;
    setBusy(true);
    const tx = await onGive(studentId, delta, why);
    if (tx) setStampKey((k) => k + 1);
    setBusy(false);
  }

  async function handleCustom() {
    const amt = parseInt(amount, 10);
    if (!amt) return;
    await give(amt, reason || '직접 입력');
    setAmount('');
  }

  const tone = today > 0 ? 'plus' : today < 0 ? 'minus' : 'zero';

  return (
    <div className={`passbook ${locked ? 'locked' : ''}`}>
      {stampKey > 0 && (
        <div key={stampKey} className="stamp-pop play">
          지급!
        </div>
      )}

      <div className="passbook-head">
        <div>
          <div className="name">{name}</div>
          <div className="class-label">{className}</div>
        </div>
        {!locked && (
          <button className="icon-btn" title="학생 삭제" onClick={() => onRemove(studentId, name)}>
            ✕
          </button>
        )}
      </div>

      <div className="attendance-row">
        <button
          className={`att-btn in ${attendance?.checked_in_at ? 'done' : ''}`}
          disabled={attBusy || !!attendance?.checked_in_at}
          onClick={() => void handleCheckIn()}
        >
          {attendance?.checked_in_at ? `등원 ${fmtTime(attendance.checked_in_at)}` : '등원'}
        </button>
        <button
          className={`att-btn out ${attendance?.checked_out_at ? 'done' : ''}`}
          disabled={attBusy || !attendance?.checked_in_at || !!attendance?.checked_out_at}
          onClick={() => void handleCheckOut()}
        >
          {attendance?.checked_out_at ? `하원 ${fmtTime(attendance.checked_out_at)}` : '하원'}
        </button>
      </div>

      <div className="today-row">
        <div className="today-label">오늘 적립</div>
        <div className={`today-num ${tone}`}>
          {today > 0 ? '+' : ''}
          {today}
          <span className="today-unit">{pointUnit}</span>
        </div>
        {showTotal && (
          <div className="total-line">
            누적 <strong>{total}</strong>
            {pointUnit}
          </div>
        )}
      </div>

      {!locked && (
        <>
          <div className="preset-row">
            {presets.map((p) => (
              <button
                key={p.id}
                className={`chip ${p.delta > 0 ? 'plus' : 'minus'}`}
                disabled={busy}
                onClick={() => void give(p.delta, p.label)}
              >
                {signed(p.delta)} {p.label}
              </button>
            ))}
          </div>

          <div className="custom-row">
            <input
              type="number"
              placeholder="±숫자"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCustom();
              }}
            />
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">직접 입력</option>
              {presets.map((p) => (
                <option key={p.id} value={p.label}>
                  {p.label} ({signed(p.delta)})
                </option>
              ))}
            </select>
            <button disabled={busy} onClick={() => void handleCustom()}>
              지급/차감
            </button>
          </div>
        </>
      )}

      <div className="today-log">
        <div className="today-log-title">오늘 내역</div>
        {todayTx.length === 0 ? (
          <div className="history-empty">아직 오늘 적립이 없어요.</div>
        ) : (
          todayTx.map((t) => (
            <div className="history-line" key={t.id}>
              <span>
                {fmtTime(t.created_at)} · {t.reason}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`delta ${t.delta > 0 ? 'plus' : 'minus'}`}>{signed(t.delta)}</span>
                {!locked && (
                  <button
                    className="undo-btn"
                    title="이 기록 취소"
                    onClick={() => void onUndo(t)}
                  >
                    ✕
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
