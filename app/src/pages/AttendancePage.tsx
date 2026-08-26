import { useCallback, useEffect, useMemo, useState } from 'react';
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
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
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
    if (!a) return '클릭하면 출석 처리됩니다.';
    const parts: string[] = [];
    parts.push(a.checked_in_at ? `등원 ${timeOnly(a.checked_in_at)}` : '등원 기록 없음');
    parts.push(a.checked_out_at ? `하원 ${timeOnly(a.checked_out_at)}` : '하원 기록 없음');
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
    const ok = await run(() => clearCheckIn(detailRow.id), '등원 기록을 지웠습니다.');
    if (ok) {
      setAttendance((prev) =>
        prev.map((a) => (a.id === detailRow.id ? { ...a, checked_in_at: null, checked_in_by: null } : a)),
      );
    }
  }

  async function handleClearCheckOut() {
    if (!detailRow) return;
    const ok = await run(() => clearCheckOut(detailRow.id), '하원 기록을 지웠습니다.');
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
    if (!confirm('이 날짜의 출석 기록을 완전히 삭제할까요?')) return;
    const ok = await run(() => deleteAttendance(detailRow.id), '출석 기록을 삭제했습니다.');
    if (ok) {
      setAttendance((prev) => prev.filter((a) => a.id !== detailRow.id));
      setDetail(null);
    }
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
        빈 칸을 누르면 출석 처리됩니다. 이미 표시된 칸을 누르면 등원·하원 시각을 볼 수 있어요.
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
                      const rec = map.get(key);
                      return (
                        <td key={d}>
                          <button
                            className={`att-cell ${rec ? 'present' : ''}`}
                            disabled={busyKey === key}
                            title={cellTooltip(rec)}
                            onClick={() => void handleCellClick(s.id, s.name, d)}
                          >
                            {rec ? '●' : ''}
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

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-card" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">{detail.studentName}</div>
                <div className="modal-sub">
                  {year}년 {month}월 {detail.day}일
                </div>
              </div>
              <button className="icon-btn" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>

            <div className="settle-list">
              <div className="settle-line">
                <span className="sname">등원</span>
                <span className="sdelta plus">
                  {detailRow?.checked_in_at ? timeOnly(detailRow.checked_in_at) : '기록 없음'}
                </span>
              </div>
              <div className="settle-line">
                <span className="sname">하원</span>
                <span className="sdelta minus">
                  {detailRow?.checked_out_at ? timeOnly(detailRow.checked_out_at) : '기록 없음'}
                </span>
              </div>
            </div>

            <div className="field-row" style={{ marginTop: 16 }}>
              {detailRow?.checked_in_at && (
                <button className="ghost" onClick={() => void handleClearCheckIn()}>
                  등원 지우기
                </button>
              )}
              {detailRow?.checked_out_at && (
                <button className="ghost" onClick={() => void handleClearCheckOut()}>
                  하원 지우기
                </button>
              )}
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 8, background: 'var(--brick)' }}
              onClick={() => void handleDeleteDay()}
            >
              이 날짜 기록 전체 삭제
            </button>
          </div>
        </div>
      )}
    </>
  );
}
