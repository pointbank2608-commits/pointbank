import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PassbookCard from '../components/PassbookCard';
import SettleModal from '../components/SettleModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  checkIn,
  checkOut,
  createSettlement,
  createStudent,
  deleteSettlement,
  deleteStudent,
  deleteTransaction,
  fetchAttendance,
  fetchBalancesOfClass,
  fetchPresets,
  fetchSettlement,
  fetchTransactionsSince,
  givePoints,
} from '../lib/api';
import { dateKey, fmtDay, signed, todayStart } from '../lib/format';
import { useClasses } from '../lib/useClasses';
import type { Attendance, Preset, Settlement, StudentBalance, Transaction } from '../lib/types';

export default function ClassBoardPage() {
  const { academy, profile, pointUnit } = useAuth();
  const { notify, run } = useToast();
  const { classes, selectedId, selected, loading: classesLoading, select } = useClasses(academy?.id);

  const [students, setStudents] = useState<StudentBalance[]>([]);
  const [todayTx, setTodayTx] = useState<Transaction[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [showTotal, setShowTotal] = useState(false);
  const [sortByName, setSortByName] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = dateKey();
  const locked = settlement !== null;

  // 프리셋은 학원 단위라 반이 바뀌어도 다시 읽지 않는다.
  useEffect(() => {
    if (!academy?.id) return;
    fetchPresets(academy.id)
      .then(setPresets)
      .catch((err) => notify(String(err?.message ?? err), 'error'));
  }, [academy?.id, notify]);

  const loadBoard = useCallback(async () => {
    if (!selectedId) {
      setStudents([]);
      setTodayTx([]);
      setSettlement(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [balances, txs, settled, att] = await Promise.all([
        fetchBalancesOfClass(selectedId),
        fetchTransactionsSince(selectedId, todayStart()),
        fetchSettlement(selectedId, today),
        fetchAttendance(selectedId, today, today),
      ]);
      setStudents(balances);
      setTodayTx(txs);
      setSettlement(settled);
      setAttendance(att);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedId, today, notify]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  // 반이 바뀌면 이전 반에서 선택했던 체크박스는 의미가 없으니 비운다.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedId]);

  /** 학생별로 오늘 거래를 묶어 카드가 쓸 형태로 만든다. */
  const rows = useMemo(() => {
    const byStudent = new Map<string, Transaction[]>();
    for (const t of todayTx) {
      const list = byStudent.get(t.student_id);
      if (list) list.push(t);
      else byStudent.set(t.student_id, [t]);
    }
    return students.map((s) => {
      const mine = byStudent.get(s.student_id) ?? [];
      return {
        studentId: s.student_id,
        name: s.name,
        total: s.balance,
        today: mine.reduce((sum, t) => sum + t.delta, 0),
        todayTx: mine,
      };
    });
  }, [students, todayTx]);

  // "No." 는 정렬과 무관하게 원래 순서를 그대로 따르는 고정 출석 번호처럼 쓴다.
  const numberByStudentId = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.studentId, i + 1));
    return m;
  }, [rows]);

  const displayRows = useMemo(() => {
    if (!sortByName) return rows;
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [rows, sortByName]);

  const todayTotal = rows.reduce((sum, r) => sum + r.today, 0);
  const activeCount = rows.filter((r) => r.today !== 0).length;
  const totalEconomy = rows.reduce((sum, r) => sum + r.total, 0);

  const handleGive = useCallback(
    async (
      studentId: string,
      delta: number,
      reason: string,
      isHomework?: boolean,
    ): Promise<Transaction | null> => {
      if (!academy?.id || !selectedId || !profile) return null;
      try {
        const tx = await givePoints({
          academyId: academy.id,
          classId: selectedId,
          studentId,
          delta,
          reason,
          teacherId: profile.id,
          teacherName: profile.display_name,
          isHomework,
        });
        // 지급 즉시 DB 에 저장된다. 화면은 낙관적으로 갱신.
        setTodayTx((prev) => [tx, ...prev]);
        setStudents((prev) =>
          prev.map((s) =>
            s.student_id === studentId ? { ...s, balance: s.balance + delta } : s,
          ),
        );
        return tx;
      } catch (err) {
        notify(err instanceof Error ? err.message : String(err), 'error');
        return null;
      }
    },
    [academy?.id, selectedId, profile, notify],
  );

  function toggleSelect(studentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.studentId))));
  }

  /** 체크박스로 선택된 학생 전원에게 같은 사유/점수를 한 번에 지급한다. */
  async function handleBulkGive(delta: number, reason: string, isHomework?: boolean) {
    if (selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    const results = await Promise.all(
      [...selectedIds].map((id) => handleGive(id, delta, reason, isHomework)),
    );
    setBulkBusy(false);
    const okCount = results.filter(Boolean).length;
    if (okCount > 0) {
      notify(`${okCount}명에게 ${signed(delta)}${pointUnit}를 지급했습니다.`);
      setSelectedIds(new Set());
    }
  }

  async function handleBulkCustom() {
    const amt = parseInt(bulkAmount, 10);
    if (!amt) return;
    const matched = presets.find((p) => p.label === bulkReason);
    await handleBulkGive(amt, bulkReason || '직접 입력', matched?.is_homework);
    setBulkAmount('');
  }

  const handleUndo = useCallback(
    async (tx: Transaction): Promise<boolean> => {
      if (!confirm(`"${tx.reason}" 기록을 취소할까요?`)) return false;
      const ok = await run(() => deleteTransaction(tx.id), '기록을 취소했습니다.');
      if (ok) {
        setTodayTx((prev) => prev.filter((t) => t.id !== tx.id));
        setStudents((prev) =>
          prev.map((s) =>
            s.student_id === tx.student_id ? { ...s, balance: s.balance - tx.delta } : s,
          ),
        );
      }
      return ok;
    },
    [run],
  );

  const attendanceByStudent = useMemo(() => {
    const m = new Map<string, Attendance>();
    for (const a of attendance) m.set(a.student_id, a);
    return m;
  }, [attendance]);

  async function handleCheckIn(studentId: string) {
    if (!academy?.id || !selectedId || !profile) return;
    const ok = await run(async () => {
      const row = await checkIn({
        academyId: academy.id,
        classId: selectedId,
        studentId,
        attendedOn: today,
        teacherId: profile.id,
      });
      setAttendance((prev) => [...prev.filter((a) => a.student_id !== studentId), row]);
    }, '등원 체크했습니다.');
    if (!ok) return;
  }

  async function handleCheckOut(studentId: string) {
    if (!academy?.id || !selectedId || !profile) return;
    await run(async () => {
      const row = await checkOut({
        academyId: academy.id,
        classId: selectedId,
        studentId,
        attendedOn: today,
        teacherId: profile.id,
      });
      setAttendance((prev) => [...prev.filter((a) => a.student_id !== studentId), row]);
    }, '하원 체크했습니다.');
  }

  async function handleAddStudent() {
    if (!academy?.id || !selectedId) return;
    const name = prompt('학생 이름을 입력하세요');
    if (!name?.trim()) return;
    const ok = await run(async () => {
      await createStudent(academy.id, selectedId, name.trim());
    }, `${name.trim()} 학생을 추가했습니다.`);
    if (ok) await loadBoard();
  }

  async function handleRemoveStudent(studentId: string, name: string) {
    if (!confirm(`${name} 학생의 통장과 모든 거래 기록을 삭제할까요?\n되돌릴 수 없습니다.`)) return;
    const ok = await run(() => deleteStudent(studentId), '학생을 삭제했습니다.');
    if (ok) {
      setStudents((prev) => prev.filter((s) => s.student_id !== studentId));
      setTodayTx((prev) => prev.filter((t) => t.student_id !== studentId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  }

  async function handleSettle() {
    if (!academy?.id || !selectedId || !profile) return;
    setSettling(true);
    const ok = await run(async () => {
      const s = await createSettlement({
        academyId: academy.id,
        classId: selectedId,
        settledOn: today,
        teacherId: profile.id,
        teacherName: profile.display_name,
        totalDelta: todayTotal,
        studentCount: activeCount,
      });
      setSettlement(s);
    }, '오늘 내역을 통장에 적립했습니다.');
    setSettling(false);
    if (ok) setModalOpen(false);
  }

  async function handleUnsettle() {
    if (!settlement) return;
    if (!confirm('오늘 마감을 취소하고 다시 지급할 수 있게 할까요?')) return;
    const ok = await run(() => deleteSettlement(settlement.id), '마감을 취소했습니다.');
    if (ok) setSettlement(null);
  }

  if (classesLoading) return <div className="text-center py-16 font-body-md text-on-surface-variant">불러오는 중…</div>;

  if (classes.length === 0) {
    return (
      <div className="text-center py-16 font-body-md text-on-surface-variant">
        등록된 반이 없습니다.{' '}
        <Link to="/settings" className="text-primary underline">
          설정
        </Link>
        에서 반을 추가해 주세요.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button
            key={c.id}
            onClick={() => select(c.id)}
            className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
              c.id === selectedId
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
            {selected?.name} 학생 통장{' '}
            <span className="font-caption text-caption bg-surface-container-low text-on-surface-variant rounded-full px-2.5 py-1 align-middle ml-1">
              {rows.length}명
            </span>
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            총 반 경제 <strong className="text-primary">{totalEconomy}{pointUnit}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/attendance"
            className="px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-colors"
          >
            출석부
          </Link>
          <button
            onClick={() => setShowTotal((v) => !v)}
            title="학생들 앞에서는 꺼두세요"
            className={`px-4 py-2 rounded-lg font-label-md text-label-md border transition-colors ${
              showTotal
                ? 'bg-secondary-container text-on-secondary-container border-transparent'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-low'
            }`}
          >
            {showTotal ? '누적 숨기기' : '누적 보기'}
          </button>
          <button
            onClick={() => setSortByName((v) => !v)}
            className={`px-4 py-2 rounded-lg font-label-md text-label-md border transition-colors flex items-center gap-1.5 ${
              sortByName
                ? 'bg-secondary-container text-on-secondary-container border-transparent'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            이름순 정렬
          </button>
          {!locked && rows.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">select_all</span>
              {selectedIds.size === rows.length ? '선택 해제' : '전체 선택'}
            </button>
          )}
          {locked ? (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-label-md text-label-md">
              오늘 마감 완료
              <button onClick={() => void handleUnsettle()} className="underline hover:opacity-80">
                취소
              </button>
            </span>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-lg font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-colors"
            >
              오늘 마감
            </button>
          )}
        </div>
      </div>

      <div className="font-body-md text-body-md text-on-surface-variant">
        {fmtDay(today)} · 오늘 {activeCount}명에게{' '}
        <strong className="text-on-surface">
          {todayTotal > 0 ? '+' : ''}
          {todayTotal}
          {pointUnit}
        </strong>{' '}
        적립
      </div>

      {!locked && selectedIds.size > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-wrap items-center gap-3">
          <span className="font-label-md text-label-md text-on-surface-variant shrink-0">
            선택된 {selectedIds.size}명에게 일괄 지급:
          </span>
          {presets.map((p) => (
            <button
              key={p.id}
              disabled={bulkBusy}
              onClick={() => void handleBulkGive(p.delta, p.label, p.is_homework)}
              title={p.is_homework ? '숙제 캘린더에 기록됩니다' : undefined}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors disabled:opacity-50 flex items-center gap-1 ${
                p.delta > 0
                  ? 'bg-secondary-container text-on-secondary-container hover:opacity-80'
                  : 'bg-error-container text-on-error-container hover:opacity-80'
              }`}
            >
              {p.is_homework && <span className="material-symbols-outlined text-[14px]">calendar_month</span>}
              {signed(p.delta)} {p.label}
            </button>
          ))}
          <div className="flex gap-1.5 ml-auto">
            <input
              type="number"
              placeholder="±숫자"
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleBulkCustom();
              }}
              className="w-20 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <input
              type="text"
              placeholder="사유"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleBulkCustom();
              }}
              className="w-28 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <button
              disabled={bulkBusy}
              onClick={() => void handleBulkCustom()}
              className="px-3 py-1.5 rounded-lg border-2 border-primary text-primary font-label-md text-label-md hover:bg-primary/10 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              적용
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">불러오는 중…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayRows.map((r) => (
            <PassbookCard
              key={r.studentId}
              studentId={r.studentId}
              name={r.name}
              className={selected?.name ?? ''}
              number={numberByStudentId.get(r.studentId) ?? 0}
              today={r.today}
              total={r.total}
              showTotal={showTotal}
              locked={locked}
              pointUnit={pointUnit}
              presets={presets}
              todayTx={r.todayTx}
              attendance={attendanceByStudent.get(r.studentId) ?? null}
              selected={selectedIds.has(r.studentId)}
              onToggleSelect={toggleSelect}
              onGive={handleGive}
              onUndo={handleUndo}
              onRemove={handleRemoveStudent}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />
          ))}
          {!locked && (
            <button
              onClick={() => void handleAddStudent()}
              className="border-2 border-dashed border-outline-variant rounded-xl min-h-[150px] flex items-center justify-center font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:border-primary transition-colors"
            >
              + 학생 추가
            </button>
          )}
        </div>
      )}

      {modalOpen && (
        <SettleModal
          className={selected?.name ?? ''}
          dayLabel={fmtDay(today)}
          rows={rows}
          pointUnit={pointUnit}
          busy={settling}
          onConfirm={() => void handleSettle()}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
