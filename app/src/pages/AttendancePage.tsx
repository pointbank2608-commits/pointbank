import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  clearCheckIn,
  clearCheckOut,
  deleteAttendance,
  fetchAttendance,
  fetchStudentsOfClass,
  markPresent,
} from '../lib/api';
import { useClasses } from '../lib/useClasses';
import type { Attendance, Student } from '../lib/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 시:분만 뽑는다 (날짜는 모달 제목에 이미 있으므로). */
function timeOnly(iso: string): string {
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR';
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export default function AttendancePage() {
  const { academy, profile } = useAuth();
  const { notify, run } = useToast();
  const { t } = useTranslation();
  const { classes, selectedId, select } = useClasses(academy?.id);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1~12

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** 상세 팝업 대상: 셀을 눌렀을 때 등원/하원 시각을 보여주는 용도 */
  const [detail, setDetail] = useState<{ studentId: string; studentName: string; day: number } | null>(
    null,
  );

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const load = useCallback(async () => {
    if (!selectedId) {
      setStudents([]);
      setAttendance([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetchStudentsOfClass(selectedId),
        fetchAttendance(selectedId, from, to),
      ]);
      setStudents(s);
      setAttendance(a);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedId, from, to, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  // 반이나 월이 바뀌면 열려 있던 상세 팝업은 닫는다.
  useEffect(() => {
    setDetail(null);
  }, [selectedId, year, month]);

  const map = useMemo(() => {
    const m = new Map<string, Attendance>(); // `${studentId}_${day}`
    for (const a of attendance) {
      const day = Number(a.attended_on.slice(8, 10));
      m.set(`${a.student_id}_${day}`, a);
    }
    return m;
  }, [attendance]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  function cellTooltip(a: Attendance | undefined): string {
    if (!a) return t('attendance.tooltipEmpty');
    const parts: string[] = [];
    parts.push(
      a.checked_in_at ? t('attendance.tooltipCheckedIn', { time: timeOnly(a.checked_in_at) }) : t('attendance.tooltipNoCheckIn'),
    );
    parts.push(
      a.checked_out_at ? t('attendance.tooltipCheckedOut', { time: timeOnly(a.checked_out_at) }) : t('attendance.tooltipNoCheckOut'),
    );
    return parts.join(' · ');
  }

  async function handleCellClick(studentId: string, studentName: string, day: number) {
    const key = `${studentId}_${day}`;
    const existing = map.get(key);
    if (existing) {
      // 이미 기록이 있으면 바로 지우지 않고, 시각을 보여주는 상세 팝업을 연다.
      setDetail({ studentId, studentName, day });
      return;
    }
    if (!academy?.id || !selectedId || !profile) return;
    setBusyKey(key);
    const attendedOn = `${year}-${pad(month)}-${pad(day)}`;
    try {
      const row = await markPresent({
        academyId: academy.id,
        classId: selectedId,
        studentId,
        attendedOn,
        teacherId: profile.id,
      });
      setAttendance((prev) => [...prev, row]);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
    setBusyKey(null);
  }

  const detailRow = detail ? map.get(`${detail.studentId}_${detail.day}`) : null;

  async function handleClearCheckIn() {
    if (!detailRow) return;
    const ok = await run(() => clearCheckIn(detailRow.id), t('attendance.toastClearedCheckIn'));
    if (ok) {
      setAttendance((prev) =>
        prev.map((a) => (a.id === detailRow.id ? { ...a, checked_in_at: null, checked_in_by: null } : a)),
      );
    }
  }

  async function handleClearCheckOut() {
    if (!detailRow) return;
    const ok = await run(() => clearCheckOut(detailRow.id), t('attendance.toastClearedCheckOut'));
    if (ok) {
      setAttendance((prev) =>
        prev.map((a) =>
          a.id === detailRow.id ? { ...a, checked_out_at: null, checked_out_by: null } : a,
        ),
      );
    }
  }

  async function handleDeleteDay() {
    if (!detailRow) return;
    if (!confirm(t('attendance.confirmDeleteDay'))) return;
    const ok = await run(() => deleteAttendance(detailRow.id), t('attendance.toastDeletedDay'));
    if (ok) {
      setAttendance((prev) => prev.filter((a) => a.id !== detailRow.id));
      setDetail(null);
    }
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
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
          {t('attendance.title')}
        </h2>
        <div className="flex items-center bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm px-2 py-1.5">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-1.5 rounded-md hover:bg-surface-container-low text-on-surface-variant transition-colors"
            aria-label={t('attendance.prevMonth')}
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="font-title-md text-title-md text-on-surface px-3">
            {t('attendance.monthLabel', { year, month })}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="p-1.5 rounded-md hover:bg-surface-container-low text-on-surface-variant transition-colors"
            aria-label={t('attendance.nextMonth')}
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <p className="font-caption text-caption text-on-surface-variant">{t('attendance.hint')}</p>

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('attendance.noStudents')}</div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] p-4 md:p-6 overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="font-caption text-caption text-on-surface-variant">
                <th className="text-left pb-3 pr-3 sticky left-0 bg-surface-container-lowest">{t('attendance.name')}</th>
                {days.map((d) => (
                  <th key={d} className="pb-3 px-1 min-w-[28px]">
                    {d}
                  </th>
                ))}
                <th className="pb-3 pl-2">{t('attendance.total')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const count = days.filter((d) => map.has(`${s.id}_${d}`)).length;
                return (
                  <tr key={s.id} className="border-t border-surface-container">
                    <td className="text-left py-2 pr-3 font-label-md text-label-md text-on-surface whitespace-nowrap sticky left-0 bg-surface-container-lowest">
                      {s.name}
                    </td>
                    {days.map((d) => {
                      const key = `${s.id}_${d}`;
                      const rec = map.get(key);
                      return (
                        <td key={d} className="py-1 px-0.5">
                          <button
                            disabled={busyKey === key}
                            title={cellTooltip(rec)}
                            onClick={() => void handleCellClick(s.id, s.name, d)}
                            className={`w-6 h-6 rounded-full text-xs transition-colors ${
                              rec
                                ? 'bg-secondary text-on-secondary'
                                : 'bg-surface-container-low hover:bg-surface-container text-transparent'
                            } disabled:opacity-50`}
                          >
                            {rec ? '●' : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-2 pl-2 font-title-md text-title-md text-primary">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-surface-container-lowest w-full max-w-[360px] rounded-xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-surface-variant flex justify-between items-center bg-surface-bright">
              <div>
                <div className="font-title-md text-title-md text-deep-navy">{detail.studentName}</div>
                <div className="font-caption text-caption text-on-surface-variant">
                  {t('attendance.dateLabel', { year, month, day: detail.day })}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-surface-container">
                <span className="font-label-md text-label-md text-on-surface-variant">{t('attendance.checkIn')}</span>
                <span className="font-title-md text-title-md text-secondary">
                  {detailRow?.checked_in_at ? timeOnly(detailRow.checked_in_at) : t('attendance.noRecord')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-label-md text-label-md text-on-surface-variant">{t('attendance.checkOut')}</span>
                <span className="font-title-md text-title-md text-error">
                  {detailRow?.checked_out_at ? timeOnly(detailRow.checked_out_at) : t('attendance.noRecord')}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                {detailRow?.checked_in_at && (
                  <button
                    onClick={() => void handleClearCheckIn()}
                    className="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-low transition-colors"
                  >
                    {t('attendance.clearCheckIn')}
                  </button>
                )}
                {detailRow?.checked_out_at && (
                  <button
                    onClick={() => void handleClearCheckOut()}
                    className="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-low transition-colors"
                  >
                    {t('attendance.clearCheckOut')}
                  </button>
                )}
              </div>
              <button
                onClick={() => void handleDeleteDay()}
                className="w-full py-2.5 rounded-lg bg-error text-on-error font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                {t('attendance.deleteDay')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
