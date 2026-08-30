import { useState } from 'react';
import { fmtTime, signed } from '../lib/format';
import type { Attendance, Preset, Transaction } from '../lib/types';

interface Props {
  studentId: string;
  name: string;
  className: string;
  /** 학급 안에서 이 학생의 순번 (1부터 시작하는 표시용) */
  number: number;
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
  /** 일괄 지급용 체크박스 선택 상태 */
  selected: boolean;
  onToggleSelect: (studentId: string) => void;
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
  number,
  today,
  total,
  showTotal,
  locked,
  pointUnit,
  presets,
  todayTx,
  attendance,
  selected,
  onToggleSelect,
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

  const toneClass = today > 0 ? 'text-secondary' : today < 0 ? 'text-error' : 'text-on-surface-variant';

  return (
    <div
      className={`relative bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] p-5 ${
        locked ? 'opacity-70' : ''
      }`}
    >
      {stampKey > 0 && (
        <div
          key={stampKey}
          className="stamp-pop-badge absolute top-3 right-3 w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-on-secondary font-title-md text-xs bg-secondary shadow-lg pointer-events-none z-10"
        >
          지급!
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(studentId)}
            className="w-4 h-4 rounded accent-primary"
          />
        </label>
        {!locked && (
          <button
            title="학생 삭제"
            onClick={() => onRemove(studentId, name)}
            className="text-on-surface-variant hover:bg-error-container hover:text-on-error-container w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      <div className="flex flex-col items-center text-center mb-3 -mt-2">
        <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-title-md mb-2">
          {name.slice(0, 1)}
        </div>
        <div className="font-title-md text-title-md text-on-surface">{name}</div>
        <div className="font-caption text-caption text-on-surface-variant">
          {className} · No. {number}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          disabled={attBusy || !!attendance?.checked_in_at}
          onClick={() => void handleCheckIn()}
          className={`flex-1 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
            attendance?.checked_in_at
              ? 'bg-secondary-container text-on-secondary-container'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
          } disabled:cursor-default`}
        >
          {attendance?.checked_in_at ? `등원 ${fmtTime(attendance.checked_in_at)}` : '등원'}
        </button>
        <button
          disabled={attBusy || !attendance?.checked_in_at || !!attendance?.checked_out_at}
          onClick={() => void handleCheckOut()}
          className={`flex-1 py-1.5 rounded-lg font-label-md text-label-md transition-colors ${
            attendance?.checked_out_at
              ? 'bg-surface-container text-on-surface-variant'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
          } disabled:opacity-50 disabled:cursor-default`}
        >
          {attendance?.checked_out_at ? `하원 ${fmtTime(attendance.checked_out_at)}` : '하원'}
        </button>
      </div>

      <div className="flex flex-col items-center mb-4 pb-4 border-b border-surface-container">
        <div className="font-caption text-caption text-on-surface-variant mb-1">오늘 적립</div>
        <div
          className={`inline-flex items-center gap-1.5 px-5 py-1.5 rounded-full bg-warm-yellow/20 font-display-lg text-[24px] ${toneClass}`}
        >
          <span className="material-symbols-outlined text-[20px]">monetization_on</span>
          {today > 0 ? '+' : ''}
          {today}
          <span className="font-caption text-caption">{pointUnit}</span>
        </div>
        {showTotal && (
          <div className="font-body-md text-body-md text-on-surface-variant mt-2">
            누적 <strong className="text-on-surface">{total}</strong>
            {pointUnit}
          </div>
        )}
      </div>

      {!locked && (
        <>
          <div className="flex flex-wrap justify-center gap-1.5 mb-3">
            {presets.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => void give(p.delta, p.label)}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors disabled:opacity-50 ${
                  p.delta > 0
                    ? 'bg-secondary-container text-on-secondary-container hover:opacity-80'
                    : 'bg-error-container text-on-error-container hover:opacity-80'
                }`}
              >
                {signed(p.delta)} {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 mb-4">
            <input
              type="number"
              placeholder="±숫자"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCustom();
              }}
              className="w-20 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">직접 입력</option>
              {presets.map((p) => (
                <option key={p.id} value={p.label}>
                  {p.label} ({signed(p.delta)})
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={() => void handleCustom()}
              className="bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-label-md text-label-md px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              지급/차감
            </button>
          </div>
        </>
      )}

      <div>
        <div className="font-caption text-caption text-on-surface-variant mb-1.5">오늘 내역</div>
        {todayTx.length === 0 ? (
          <div className="font-caption text-caption text-on-surface-variant/70 py-2">
            아직 오늘 적립이 없어요.
          </div>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {todayTx.map((t) => (
              <div key={t.id} className="flex justify-between items-center py-1 font-caption text-caption">
                <span className="text-on-surface-variant truncate mr-2">
                  {fmtTime(t.created_at)} · {t.reason}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={t.delta > 0 ? 'text-secondary' : 'text-error'}>{signed(t.delta)}</span>
                  {!locked && (
                    <button
                      title="이 기록 취소"
                      onClick={() => void onUndo(t)}
                      className="text-on-surface-variant hover:text-error w-4 h-4 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
