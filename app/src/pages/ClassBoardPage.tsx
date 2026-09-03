import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
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
  const { t, i18n } = useTranslation();
  const { classes, selectedId, selected, loading: classesLoading, select, reorder } = useClasses(academy?.id);

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
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  }, [rows, sortByName, i18n.language]);

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
      notify(t('board.bulkGiveToast', { count: okCount, amount: `${signed(delta)}${pointUnit}` }));
      setSelectedIds(new Set());
    }
  }

  async function handleBulkCustom() {
    const amt = parseInt(bulkAmount, 10);
    if (!amt) return;
    const matched = presets.find((p) => p.label === bulkReason);
    await handleBulkGive(amt, bulkReason || t('board.customReasonDefault'), matched?.is_homework);
    setBulkAmount('');
  }

  const handleUndo = useCallback(
    async (tx: Transaction): Promise<boolean> => {
      if (!confirm(t('board.undoConfirm', { reason: tx.reason }))) return false;
      const ok = await run(() => deleteTransaction(tx.id), t('board.undoToast'));
      if (ok) {
        setTodayTx((prev) => prev.filter((x) => x.id !== tx.id));
        setStudents((prev) =>
          prev.map((s) =>
            s.student_id === tx.student_id ? { ...s, balance: s.balance - tx.delta } : s,
          ),
        );
      }
      return ok;
    },
    [run, t],
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
    }, t('board.checkInToast'));
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
    }, t('board.checkOutToast'));
  }

  async function handleAddStudent() {
    if (!academy?.id || !selectedId) return;
    const name = prompt(t('board.addStudentPrompt'));
    if (!name?.trim()) return;
    const ok = await run(async () => {
      await createStudent(academy.id, selectedId, name.trim());
    }, t('board.addStudentToast', { name: name.trim() }));
    if (ok) await loadBoard();
  }

  async function handleRemoveStudent(studentId: string, name: string) {
    if (!confirm(t('board.removeStudentConfirm', { name }))) return;
    const ok = await run(() => deleteStudent(studentId), t('board.removeStudentToast'));
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
    }, t('board.settleToast'));
    setSettling(false);
    if (ok) setModalOpen(false);
  }

  async function handleUnsettle() {
    if (!settlement) return;
    if (!confirm(t('board.unsettleConfirm'))) return;
    const ok = await run(() => deleteSettlement(settlement.id), t('board.unsettleToast'));
    if (ok) setSettlement(null);
  }

  if (classesLoading) return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>;

  if (classes.length === 0) {
    return (
      <div className="text-center py-16 font-body-md text-on-surface-variant">
        {t('board.noClasses')}{' '}
        {t('board.noClassesBefore')}
        <Link to="/settings" className="text-primary underline">
          {t('nav.settings')}
        </Link>
        {t('board.noClassesAfter')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ClassChipRow classes={classes} selectedId={selectedId} onSelect={select} onReorder={reorder} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
            {t('board.title', { name: selected?.name })}{' '}
            <span className="font-caption text-caption bg-surface-container-low text-on-surface-variant rounded-full px-2.5 py-1 align-middle ml-1">
              {t('board.countBadge', { count: rows.length })}
            </span>
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {t('board.totalEconomy')} <strong className="text-primary">{totalEconomy}{pointUnit}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/attendance"
            className="px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-colors"
          >
            {t('board.attendanceLink')}
          </Link>
          <Link
            to="/results"
            className="px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-colors"
          >
            {t('board.resultsLink')}
          </Link>
          <button
            onClick={() => setShowTotal((v) => !v)}
            title={t('board.showTotalHint')}
            className={`px-4 py-2 rounded-lg font-label-md text-label-md border transition-colors ${
              showTotal
                ? 'bg-secondary-container text-on-secondary-container border-transparent'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-low'
            }`}
          >
            {showTotal ? t('board.hideTotal') : t('board.showTotal')}
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
            {t('board.sortByName')}
          </button>
          {!locked && rows.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">select_all</span>
              {selectedIds.size === rows.length ? t('board.deselectAll') : t('board.selectAll')}
            </button>
          )}
          {locked ? (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container font-label-md text-label-md">
              {t('board.settleDone')}
              <button onClick={() => void handleUnsettle()} className="underline hover:opacity-80">
                {t('board.settleCancel')}
              </button>
            </span>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-lg font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-colors"
            >
              {t('board.settleButton')}
            </button>
          )}
        </div>
      </div>

      <div className="font-body-md text-body-md text-on-surface-variant">
        {t('board.todaySummary', {
          day: fmtDay(today),
          count: activeCount,
          amount: `${todayTotal > 0 ? '+' : ''}${todayTotal}${pointUnit}`,
        })}
      </div>

      {!locked && selectedIds.size > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-wrap items-center gap-3">
          <span className="font-label-md text-label-md text-on-surface-variant shrink-0">
            {t('board.bulkGiveLabel', { count: selectedIds.size })}
          </span>
          {presets.map((p) => (
            <button
              key={p.id}
              disabled={bulkBusy}
              onClick={() => void handleBulkGive(p.delta, p.label, p.is_homework)}
              title={p.is_homework ? t('board.bulkHomeworkTitle') : undefined}
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
              placeholder={t('board.amountPlaceholder')}
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleBulkCustom();
              }}
              className="w-20 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
            <input
              type="text"
              placeholder={t('board.reasonPlaceholder')}
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
              {t('board.apply')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
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
              {t('board.addStudent')}
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
