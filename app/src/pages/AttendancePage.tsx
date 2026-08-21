import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
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

export default function AttendancePage() {
  const { academy, profile } = useAuth();
  const { notify, run } = useToast();
  const { classes, selectedId, select } = useClasses(academy?.id);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1~12

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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

  async function handleCellClick(studentId: string, day: number) {
    if (!academy?.id || !selectedId || !profile) return;
    const key = `${studentId}_${day}`;
    const existing = map.get(key);
    setBusyKey(key);
    if (existing) {
      const ok = await run(() => deleteAttendance(existing.id));
      if (ok) setAttendance((prev) => prev.filter((a) => a.id !== existing.id));
    } else {
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
    }
    setBusyKey(null);
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
          출석부
        </div>
        <div className="board-actions">
          <button className="toggle-btn" onClick={() => shiftMonth(-1)}>
            ◀
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            {year}년 {month}월
          </span>
          <button className="toggle-btn" onClick={() => shiftMonth(1)}>
            ▶
          </button>
        </div>
      </div>

      <p className="hint" style={{ margin: '0 0 14px' }}>
        빈 칸을 누르면 출석 처리, 표시된 칸을 다시 누르면 취소됩니다. 실시간 등원/하원 시각은
        반별 통장 카드에서 확인하세요.
      </p>

      {loading ? (
        <div className="empty-hint">불러오는 중…</div>
      ) : students.length === 0 ? (
        <div className="empty-hint">이 반에 학생이 없습니다.</div>
      ) : (
        <div className="att-grid-wrap">
          <table className="att-grid">
            <thead>
              <tr>
                <th className="att-grid-name">이름</th>
                {days.map((d) => (
                  <th key={d}>{d}</th>
                ))}
                <th>출석</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const count = days.filter((d) => map.has(`${s.id}_${d}`)).length;
                return (
                  <tr key={s.id}>
                    <td className="att-grid-name">{s.name}</td>
                    {days.map((d) => {
                      const key = `${s.id}_${d}`;
                      const present = map.has(key);
                      return (
                        <td key={d}>
                          <button
                            className={`att-cell ${present ? 'present' : ''}`}
                            disabled={busyKey === key}
                            onClick={() => void handleCellClick(s.id, d)}
                          >
                            {present ? '●' : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td className="att-grid-count">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
