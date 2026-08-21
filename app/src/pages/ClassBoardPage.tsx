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
import { dateKey, fmtDay, todayStart } from '../lib/format';
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

  const todayTotal = rows.reduce((sum, r) => sum + r.today, 0);
  const activeCount = rows.filter((r) => r.today !== 0).length;

  const handleGive = useCallback(
    async (studentId: string, delta: number, reason: string): Promise<Transaction | null> => {
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

  if (classesLoading) return <div className="empty-hint">불러오는 중…</div>;

  if (classes.length === 0) {
    return (
      <div className="empty-hint">
        등록된 반이 없습니다. <Link to="/settings">설정</Link>에서 반을 추가해 주세요.
      </div>
    );
  }

  return (
    <>
      <div className="class-tabs">
        {classes.map((c) => (
          <button
            key={c.id}
            className={`class-tab ${c.id === selectedId ? 'active' : ''}`}
            onClick={() => select(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="board-header">
        <div className="section-title" style={{ margin: 0 }}>
          {selected?.name} 학생 통장 <span className="badge">{rows.length}명</span>
        </div>
        <div className="board-actions">
          <Link to="/attendance" className="toggle-btn" style={{ textDecoration: 'none' }}>
            출석부
          </Link>
          <button
            className={`toggle-btn ${showTotal ? 'on' : ''}`}
            onClick={() => setShowTotal((v) => !v)}
            title="학생들 앞에서는 꺼두세요"
          >
            {showTotal ? '누적 숨기기' : '누적 보기'}
          </button>
          {locked ? (
            <span className="settled-badge">
              오늘 마감 완료
              <button className="linkish dark" onClick={() => void handleUnsettle()}>
                취소
              </button>
            </span>
          ) : (
            <button className="settle-btn" onClick={() => setModalOpen(true)}>
              오늘 마감
            </button>
          )}
        </div>
      </div>

      <div className="today-summary">
        {fmtDay(today)} · 오늘 {activeCount}명에게{' '}
        <strong>
          {todayTotal > 0 ? '+' : ''}
          {todayTotal}
          {pointUnit}
        </strong>{' '}
        적립
      </div>

      {loading ? (
        <div className="empty-hint">불러오는 중…</div>
      ) : (
        <div className="student-grid">
          {rows.map((r) => (
            <PassbookCard
              key={r.studentId}
              studentId={r.studentId}
              name={r.name}
              className={selected?.name ?? ''}
              today={r.today}
              total={r.total}
              showTotal={showTotal}
              locked={locked}
              pointUnit={pointUnit}
              presets={presets}
              todayTx={r.todayTx}
              attendance={attendanceByStudent.get(r.studentId) ?? null}
              onGive={handleGive}
              onUndo={handleUndo}
              onRemove={handleRemoveStudent}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />
          ))}
          {!locked && (
            <div className="add-student-card" onClick={() => void handleAddStudent()}>
              + 학생 추가
            </div>
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
    </>
  );
}
